import type { AnimationConfig, AnimationHandle, AnimationScheduler } from './types'
import { validateAnimationConfig, validateAnimationScheduler } from './validation'
import { PropertyGroups } from './propertyGroups'
import { AnimationTask } from './task'
import { animationError } from './errors'
import { createAnimationHandle } from './handle'

function defaultScheduler(): AnimationScheduler {
  // Constructed only on first animate, never during module import.
  const raf =
    typeof globalThis.requestAnimationFrame === 'function' &&
    typeof globalThis.cancelAnimationFrame === 'function'
  return {
    now: () => globalThis.performance?.now() ?? Date.now(),
    requestFrame: raf ? (callback) => globalThis.requestAnimationFrame(callback) : undefined,
    cancelFrame: raf ? (id) => globalThis.cancelAnimationFrame(id) : undefined,
    setTimer: (callback, delay) => setTimeout(callback, delay),
    clearTimer: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  }
}

/** Shared numeric task scheduler. Empty, delayed-only and paused queues never spin RAF. */
export class Animator {
  #scheduler?: AnimationScheduler
  readonly #injected: boolean
  #tasks = new Map<string, AnimationTask>()
  #groups = new PropertyGroups()
  #reasons = new Set<string>()
  #frameId?: number
  #timerId?: unknown
  #hasTimer = false
  #sequence = 0
  #barrier = false
  #frameRunning = false
  constructor(scheduler?: AnimationScheduler) {
    if (scheduler) validateAnimationScheduler(scheduler)
    this.#scheduler = scheduler
    this.#injected = !!scheduler
  }
  #clock() {
    return (this.#scheduler ??= defaultScheduler())
  }
  validate(config: AnimationConfig): void {
    validateAnimationConfig(config, this.#groups.context)
  }
  animate(config: AnimationConfig, id?: string): AnimationHandle {
    return this.animatePaused(config, id, [])
  }
  /** Adapter registration with inherited owner reasons, before any scheduling occurs. */
  animatePaused(
    config: AnimationConfig,
    id: string | undefined,
    reasons: readonly string[],
  ): AnimationHandle {
    if (this.#barrier) throw animationError('animation-terminating')
    if (id !== undefined && typeof id !== 'string')
      throw new TypeError('Animation id must be string')
    const validated = validateAnimationConfig(config, this.#groups.context)
    const conflicts = this.#groups.conflicts(validated) as Set<AnimationTask>
    if (id !== undefined && this.#tasks.has(id)) conflicts.add(this.#tasks.get(id)!)
    validated.tracks = this.#groups.capture(validated)
    const task = new AnimationTask(validated, this.#groups)
    let key = id
    if (key === undefined) {
      do {
        key = `animation-${++this.#sequence}`
      } while (this.#tasks.has(key))
    }
    const callbacks = [...conflicts].map((old) => old.settle('ABORTED', false))
    this.#tasks.set(key, task)
    this.#groups.bind(task)
    const scheduler = this.#clock()
    const { handle, release } = createAnimationHandle(
      key,
      () => task.state,
      (method) => {
        task[method](scheduler.now())
        this.#schedule()
      },
    )
    task.setTermination(() => {
      if (this.#tasks.get(key) === task) this.#tasks.delete(key)
      release()
      this.#schedule()
    })
    for (const reason of new Set([...this.#reasons, ...reasons]))
      task.pause(scheduler.now(), reason)
    // The new owner is visible to reentrant requests before old user notifications.
    callbacks.forEach((callback) => callback())
    if (!task.ended) task.start(scheduler.now(), !scheduler.requestFrame)
    this.#schedule()
    return handle
  }
  remove(id: string): void {
    this.#tasks.get(id)?.abort()
    this.#schedule()
  }
  pause(id: string): void {
    this.#tasks.get(id)?.pause(this.#clock().now())
    this.#schedule()
  }
  resume(id: string): void {
    this.#tasks.get(id)?.resume(this.#clock().now())
    this.#schedule()
  }
  pauseAll(): void {
    this.setPauseReason('manual-all', true)
  }
  resumeAll(): void {
    this.setPauseReason('manual-all', false)
  }
  /** Independent adapter-owned pause reasons, including document-hidden and owner scopes. */
  setPauseReason(reason: string, paused: boolean, ids?: readonly string[]): void {
    if (!ids) {
      if (paused) this.#reasons.add(reason)
      else this.#reasons.delete(reason)
    }
    const tasks = ids
      ? ids.map((id) => this.#tasks.get(id)).filter((task) => !!task)
      : [...this.#tasks.values()]
    const time = this.#clock().now()
    for (const task of tasks) {
      if (paused) task.pause(time, reason)
      else task.resume(time, reason)
    }
    this.#schedule()
  }
  finishAll(): void {
    this.#bulk('finish')
  }
  clear(): void {
    this.#bulk('abort')
  }
  destroy(): void {
    if (this.#barrier) return
    this.#bulk('abort')
    this.#reasons.clear()
    this.#groups = new PropertyGroups()
    if (!this.#injected) this.#scheduler = undefined
  }
  getAnimationCount(): number {
    return this.#tasks.size
  }
  #bulk(method: 'finish' | 'abort'): void {
    if (this.#barrier) return
    this.#barrier = true
    try {
      // oxlint-disable-next-line unicorn/no-useless-spread -- Callbacks mutate tasks; snapshot membership.
      for (const task of [...this.#tasks.values()]) {
        if (method === 'finish') task.finish(this.#clock().now())
        else task.abort()
      }
    } finally {
      this.#barrier = false
      this.#schedule()
    }
  }
  #stop(): void {
    if (this.#frameId !== undefined) this.#scheduler?.cancelFrame?.(this.#frameId)
    if (this.#hasTimer) this.#scheduler?.clearTimer(this.#timerId)
    this.#frameId = undefined
    this.#timerId = undefined
    this.#hasTimer = false
  }
  #schedule(): void {
    if (this.#frameRunning || this.#barrier) return
    this.#stop()
    if (!this.#tasks.size) return
    const scheduler = this.#clock()
    if (!scheduler.requestFrame) return
    const now = scheduler.now()
    const deadline = Math.min(...[...this.#tasks.values()].map((task) => task.deadline(now)))
    if (deadline === Infinity) return
    if (deadline > now) {
      this.#hasTimer = true
      this.#timerId = scheduler.setTimer(() => {
        this.#hasTimer = false
        this.#schedule()
      }, deadline - now)
    } else this.#frameId = scheduler.requestFrame(() => this.#frame())
  }
  #frame(): void {
    this.#frameId = undefined
    this.#frameRunning = true
    const time = this.#clock().now()
    try {
      const frames = [...this.#tasks].map(([id, task]) => ({ id, task, next: task.prepare(time) }))
      this.#groups.flush()
      for (const { id, task, next } of frames) {
        if (next && this.#tasks.get(id) === task) task.deliver(next.progress, next.frame)
      }
    } finally {
      this.#frameRunning = false
      this.#schedule()
    }
  }
}

/** Construction is side-effect free; browser capabilities are read lazily on animate. */
export const globalAnimator = /* @__PURE__ */ new Animator()
