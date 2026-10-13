import type { AnimationFrame, AnimationState } from './types'
import type { ValidatedAnimationConfig } from './validation'
import { directedProgress, equalValues } from './values'
import { PropertyGroups } from './propertyGroups'
import { notify, reportAnimationError } from './errors'

/** Internal timeline; standalone and managed animations share exactly the same semantics. */
export class AnimationTask {
  state: AnimationState = 'PENDING'
  #started = false
  #startTime = 0
  #pauseTime = 0
  #pausedTotal = 0
  #reasons = new Set<string>()
  #previousState: AnimationState = 'PENDING'
  #iteration = 0
  #terminate?: () => void

  constructor(
    readonly config: ValidatedAnimationConfig,
    private groups: PropertyGroups,
  ) {}
  get ended() {
    return this.state === 'FINISHED' || this.state === 'ABORTED'
  }
  get unchanged() {
    return !this.config.force && this.config.tracks.every((t) => equalValues(t.from!, t.to))
  }
  setTermination(callback: () => void) {
    this.#terminate = callback
  }
  start(time: number, synchronous = false): void {
    if (this.#started || this.ended) throw new Error('Animation can only start once')
    this.#started = true
    this.#startTime = time
    if (this.#reasons.size) this.#pauseTime = time
    if (synchronous || this.config.duration === 0 || this.unchanged) {
      this.finish()
      return
    }
    try {
      this.config.initialize?.()
    } catch (error) {
      this.fail(error)
    }
  }
  deadline(time: number): number {
    if (this.ended || this.#reasons.size) return Infinity
    return Math.max(time, this.#startTime + this.config.delay + this.#pausedTotal)
  }
  prepare(time: number): { progress: number; frame: AnimationFrame } | undefined {
    if (!this.#started || this.ended || this.#reasons.size) return
    const elapsed = time - this.#startTime - this.config.delay - this.#pausedTotal
    if (elapsed < 0) return
    this.state = 'RUNNING'
    const { duration, loop, direction } = this.config
    const terminal = elapsed >= duration * loop
    this.#iteration = terminal ? loop - 1 : Math.floor(elapsed / duration)
    const rawProgress = terminal ? 1 : (elapsed % duration) / duration
    const directed = directedProgress(rawProgress, this.#iteration, direction)
    const frame = { rawProgress, directedProgress: directed, iteration: this.#iteration, terminal }
    try {
      const progress = terminal ? directed : this.config.easing(directed)
      if (!Number.isFinite(progress)) throw new RangeError('Easing returned a nonfinite value')
      this.groups.setProgress(this, progress)
      return { progress, frame }
    } catch (error) {
      this.fail(error)
    }
  }
  deliver(progress: number, frame: AnimationFrame): void {
    if (this.ended) return
    try {
      this.config.during?.(progress, frame)
    } catch (error) {
      this.fail(error)
      return
    }
    if (frame.terminal && !this.ended) this.#complete('FINISHED')
  }
  tick(time: number): boolean {
    const next = this.prepare(time)
    if (next) {
      this.groups.flush()
      this.deliver(next.progress, next.frame)
    }
    return this.ended
  }
  pause(time: number, reason = 'manual'): void {
    if (this.ended || this.#reasons.has(reason)) return
    if (!this.#reasons.size) {
      this.#previousState = this.state
      this.#pauseTime = time
      this.state = 'PAUSED'
    }
    this.#reasons.add(reason)
  }
  resume(time: number, reason = 'manual'): void {
    if (this.ended || !this.#reasons.delete(reason) || this.#reasons.size) return
    this.#pausedTotal += time - this.#pauseTime
    this.state = this.#previousState
  }
  finish(time?: number): void {
    if (this.ended) return
    const { loop, direction } = this.config
    if (loop === Infinity && time !== undefined && this.#started) {
      const elapsed = Math.max(
        0,
        (this.#reasons.size ? this.#pauseTime : time) -
          this.#startTime -
          this.config.delay -
          this.#pausedTotal,
      )
      this.#iteration = Math.floor(elapsed / this.config.duration)
    }
    const iteration = loop === Infinity ? this.#iteration : loop - 1
    const progress = directedProgress(1, iteration, direction)
    try {
      this.groups.setProgress(this, progress)
      this.groups.flush()
    } catch (error) {
      this.fail(error)
      return
    }
    this.deliver(progress, {
      rawProgress: 1,
      directedProgress: progress,
      iteration,
      terminal: true,
    })
  }
  abort(): void {
    if (!this.ended) this.#complete('ABORTED')
  }
  /** Detach without callbacks/old terminal frames for owner-level commit barriers. */
  settle(state: 'FINISHED' | 'ABORTED', notifyUser = true): () => void {
    if (this.ended) return () => {}
    this.state = state
    this.groups.detach(this)
    this.#terminate?.()
    const callback = () =>
      notify(this.config, state === 'FINISHED' ? this.config.done : this.config.aborted)
    if (notifyUser) callback()
    return callback
  }
  #complete(state: 'FINISHED' | 'ABORTED') {
    this.settle(state)
  }
  fail(error: unknown) {
    this.abort()
    reportAnimationError(this.config, error)
  }
}
