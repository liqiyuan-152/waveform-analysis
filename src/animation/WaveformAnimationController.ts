import { Animator, globalAnimator } from './core/Animator'
import type { AnimationConfig, AnimationHandle, AnimationState } from './core/types'
import { copyAnimationValue, validateAnimationConfig } from './core/validation'
import { animationError, notify, reportAnimationError } from './core/errors'
import { createAnimationOwner } from './core/owner'
import { createAnimationHandle } from './core/handle'
import type {
  AnimationObjectKey,
  WaveformAnimationControllerOptions,
  AnimationBinding,
  ClipAnimationState,
  LineDrawingOptions,
  StaggeredLineDrawingOptions,
  GeometryTransitionInput,
  GeometryTransitionFrame,
  DataUpdateOptions,
  AnnotationAnimationState,
  AnnotationAnimationOptions,
} from './types'
import {
  createLineDrawingAnimation,
  createStaggeredLineDrawingAnimations,
} from './presets/lineDrawing'
import { createPathTransitionAnimation, createYAxisScaleAnimation } from './presets/transitions'
import {
  createAnnotationAppearAnimation,
  createAnnotationDisappearAnimation,
} from './presets/annotation'

interface RecordEntry {
  key: AnimationObjectKey
  config: AnimationConfig
  id: string
  raw?: AnimationHandle
  state?: AnimationState
  handle: AnimationHandle
  release: () => void
  manualPaused: boolean
}
function conflicts(a: AnimationObjectKey, b: AnimationObjectKey): boolean {
  if (a.kind !== b.kind || a.id !== b.id) return false
  if (
    a.kind === 'annotation' &&
    ['enter', 'leave'].includes(a.scope) &&
    ['enter', 'leave'].includes(b.scope)
  )
    return true
  if (
    a.kind === 'series' &&
    ['enter', 'update'].includes(a.scope) &&
    ['enter', 'update'].includes(b.scope)
  )
    return true
  return a.scope === b.scope
}

/** Owner-scoped coordination; it never installs browser listeners or writes DOM. */
export class WaveformAnimationController {
  #records = new Map<string, RecordEntry>()
  #owner = createAnimationOwner()
  #enabled: boolean
  #animator: NonNullable<WaveformAnimationControllerOptions['animator']>
  #barrier = false
  #disposed = false
  #paused = new Set<string>()
  constructor(private options: WaveformAnimationControllerOptions) {
    if (!options || typeof options.commitFinalState !== 'function')
      throw new TypeError('commitFinalState is required')
    this.#enabled = options.enabled ?? true
    this.#animator = options.animator ?? globalAnimator
  }
  #assertOpen(): void {
    if (this.#barrier) throw animationError('animation-terminating')
    if (this.#disposed) throw animationError('animation-disposed')
  }
  animate(key: AnimationObjectKey, config: AnimationConfig): AnimationHandle {
    this.#assertOpen()
    if (
      !key ||
      !['series', 'annotation', 'axis', 'custom'].includes(key.kind) ||
      typeof key.id !== 'string' ||
      !['enter', 'update', 'leave', 'domain'].includes(key.scope)
    )
      throw new TypeError('Invalid animation object key')
    if (this.#animator instanceof Animator) this.#animator.validate(config)
    else validateAnimationConfig(config)
    // Old terminal callbacks may mutate caller-owned arrays before manager registration.
    // Preserve the group-aware preflight contract without sharing those endpoints.
    const snapshot = {
      ...config,
      tracks: config.tracks?.map((track) => ({
        ...track,
        from: track.from === undefined ? undefined : copyAnimationValue(track.from, 'from'),
        to: copyAnimationValue(track.to, 'to'),
      })),
    }
    const id = this.#owner(key)
    const olds = [...this.#records.values()].filter((record) => conflicts(record.key, key))
    const record = { key: { ...key }, config: snapshot, id, manualPaused: false } as RecordEntry
    const { handle, release } = createAnimationHandle(
      id,
      () => record.state ?? record.raw?.state ?? 'PENDING',
      (method) => {
        if (method === 'pause') {
          record.manualPaused = true
          record.raw?.pause()
        } else if (method === 'resume') {
          record.manualPaused = false
          if (this.#animator instanceof Animator || !this.#paused.size) record.raw?.resume()
        } else if (method === 'abort') {
          if (record.raw) record.raw.abort()
          else this.#finishRecord(record, 'ABORTED')
        } else record.raw?.finish()
      },
    )
    record.handle = handle
    record.release = release
    this.#records.set(id, record)
    for (const old of olds) {
      if (key.kind === 'series' && key.scope === 'update' && old.key.scope === 'enter') {
        try {
          old.config.during?.(1, {
            rawProgress: 1,
            directedProgress: 1,
            iteration: 0,
            terminal: true,
          })
        } catch (error) {
          reportAnimationError(old.config, error)
        }
      }
      old.handle.abort()
    }
    if (record.state) return record.handle
    const wrapped: AnimationConfig = {
      ...snapshot,
      initialize:
        this.#animator instanceof Animator
          ? snapshot.initialize
          : () => {
              snapshot.initialize?.()
              if (this.#paused.size) this.#animator.pause(id)
            },
      duration: this.#enabled ? snapshot.duration : 0,
      loop: this.#enabled ? snapshot.loop : 1,
      done: () => {
        if (!this.#barrier) this.#finishRecord(record, 'FINISHED')
      },
      aborted: () => {
        if (!this.#barrier) this.#finishRecord(record, 'ABORTED')
      },
      onError: (error) => {
        reportAnimationError(snapshot, error)
        if (!this.#barrier && !this.#disposed) this.finishAll()
      },
    }
    try {
      record.raw =
        this.#animator instanceof Animator
          ? this.#animator.animatePaused(
              wrapped,
              id,
              [...this.#paused].map((reason) => this.#ownerPause(reason)),
            )
          : this.#animator.animate(wrapped, id)
    } catch (error) {
      this.#finishRecord(record, 'ABORTED')
      throw error
    }
    if (this.#animator instanceof Animator)
      for (const reason of this.#paused) {
        this.#animator.setPauseReason(this.#ownerPause(reason), true, [id])
      }
    else if (this.#paused.size) record.raw.pause()
    return record.handle
  }
  #finishRecord(record: RecordEntry, state: 'FINISHED' | 'ABORTED'): void {
    if (record.state === 'FINISHED' || record.state === 'ABORTED') return
    record.state = state
    if (this.#records.get(record.id) === record) this.#records.delete(record.id)
    record.release()
    notify(record.config, state === 'FINISHED' ? record.config.done : record.config.aborted)
  }
  animateSeriesEnter(
    id: string,
    binding: AnimationBinding<ClipAnimationState>,
    width: number,
    options?: LineDrawingOptions,
  ): AnimationHandle {
    this.#assertOpen()
    return this.animate(
      { kind: 'series', id, scope: 'enter' },
      createLineDrawingAnimation(binding, width, options),
    )
  }
  animateMultiSeriesEnter(
    series: readonly { id: string; binding: AnimationBinding<ClipAnimationState>; width: number }[],
    options?: StaggeredLineDrawingOptions,
  ): AnimationHandle[] {
    this.#assertOpen()
    const configs = createStaggeredLineDrawingAnimations(series, options)
    return configs.map((config, index) =>
      this.animate({ kind: 'series', id: series[index].id, scope: 'enter' }, config),
    )
  }
  animateDataUpdate(
    id: string,
    input: GeometryTransitionInput,
    write: (frame: GeometryTransitionFrame) => void,
    options?: DataUpdateOptions,
  ): AnimationHandle {
    this.#assertOpen()
    return this.animate(
      { kind: 'series', id, scope: 'update' },
      createPathTransitionAnimation(input, write, options),
    )
  }
  animateYAxisScale(
    id: string,
    binding: AnimationBinding<[number, number]>,
    to: [number, number],
    options?: DataUpdateOptions,
  ): AnimationHandle {
    this.#assertOpen()
    return this.animate(
      { kind: 'axis', id, scope: 'domain' },
      createYAxisScaleAnimation(binding, to, options),
    )
  }
  animateAnnotationAppear(
    id: string,
    binding: AnimationBinding<AnnotationAnimationState>,
    options?: AnnotationAnimationOptions,
  ): AnimationHandle {
    this.#assertOpen()
    return this.animate(
      { kind: 'annotation', id, scope: 'enter' },
      createAnnotationAppearAnimation(binding, options),
    )
  }
  animateAnnotationDisappear(
    id: string,
    binding: AnimationBinding<AnnotationAnimationState>,
    options?: AnnotationAnimationOptions,
  ): AnimationHandle {
    this.#assertOpen()
    return this.animate(
      { kind: 'annotation', id, scope: 'leave' },
      createAnnotationDisappearAnimation(binding, options),
    )
  }
  cancel(key: AnimationObjectKey): void {
    this.#records.get(this.#owner(key))?.handle.abort()
  }
  cancelAll(): void {
    this.#bulk(false, false)
  }
  finishAll(): void {
    this.#bulk(true, true)
  }
  /** Adapter category commits are separate from the whole-chart final-state commit. */
  finishWhere(predicate: (key: AnimationObjectKey) => boolean, commit: () => void): void {
    this.#bulk(true, true, predicate, commit)
  }
  #bulk(
    finish: boolean,
    commit: boolean,
    predicate: (key: AnimationObjectKey) => boolean = () => true,
    submit = this.options.commitFinalState,
  ): void {
    if (this.#barrier || this.#disposed) return
    this.#barrier = true
    const records = [...this.#records.values()].filter((record) => predicate(record.key))
    try {
      for (const record of records) {
        if (this.#records.get(record.id) === record) this.#records.delete(record.id)
        record.raw?.abort()
      }
      try {
        if (commit) submit()
      } catch (error) {
        for (const record of records) {
          this.#finishRecord(record, 'ABORTED')
          reportAnimationError(record.config, error)
        }
        throw error
      }
      for (const record of records) this.#finishRecord(record, finish ? 'FINISHED' : 'ABORTED')
    } finally {
      this.#barrier = false
    }
  }
  pauseAll(): void {
    this.setPauseReason('manual-all', true)
  }
  resumeAll(): void {
    this.setPauseReason('manual-all', false)
  }
  #ownerPause(reason: string) {
    return `${this.#owner({ kind: 'custom', id: 'pause', scope: 'domain' })}:${reason}`
  }
  setPauseReason(reason: string, pause: boolean): void {
    if (this.#disposed) return
    if (pause) this.#paused.add(reason)
    else this.#paused.delete(reason)
    if (this.#animator instanceof Animator)
      this.#animator.setPauseReason(this.#ownerPause(reason), pause, [...this.#records.keys()])
    else if (pause) this.#records.forEach((record) => record.raw?.pause())
    else if (!this.#paused.size)
      this.#records.forEach((record) => {
        if (!record.manualPaused) record.raw?.resume()
      })
  }
  setEnabled(enabled: boolean): void {
    if (this.#disposed || this.#enabled === enabled) return
    this.#enabled = enabled
    if (!enabled) this.finishAll()
  }
  getActiveAnimationCount(): number {
    return this.#records.size
  }
  destroy(): void {
    if (this.#disposed || this.#barrier) return
    this.#bulk(false, false)
    this.#disposed = true
    this.#paused.clear()
  }
}
