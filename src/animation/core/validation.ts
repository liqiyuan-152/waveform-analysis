import { getEasingFunction } from './easing'
import { equalValues } from './values'
import type {
  AnimationConfig,
  AnimationDirection,
  AnimationScheduler,
  AnimationTrack,
  AnimationValue,
  EasingFunction,
} from './types'

export interface ValidatedAnimationConfig extends AnimationConfig {
  tracks: AnimationTrack[]
  duration: number
  delay: number
  easing: EasingFunction
  /** Infinity represents loop=true internally; numeric Infinity is rejected as input. */
  loop: number
  direction: AnimationDirection
  force: boolean
  additive: boolean
}

/** A future property-group registry supplies this read-only snapshot before registration. */
export interface AnimationTrackContext {
  /** Direction-aware baseEnd + committedOffset + sum(activeEndDelta). */
  additiveFrom: AnimationValue
  baseLoop: number | boolean
}

function object(value: unknown, label: string): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`)
  }
}

function time(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number') throw new TypeError(`${label} must be a number`)
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and nonnegative`)
  }
}

function iterations(value: unknown): number {
  if (value === true) return Infinity
  if (value === false) return 1
  if (typeof value !== 'number') throw new TypeError('loop must be a number or boolean')
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new RangeError('loop must be a finite positive integer')
  }
  return value
}

/** Validate and copy without changing any input array, including empty and nested arrays. */
export function copyAnimationValue(value: unknown, label = 'value'): AnimationValue {
  const number = (item: unknown): number => {
    if (typeof item !== 'number') throw new TypeError(`${label} must contain numbers`)
    if (!Number.isFinite(item)) throw new RangeError(`${label} must contain finite numbers`)
    return item
  }
  if (typeof value === 'number') return number(value)
  if (!Array.isArray(value)) throw new TypeError(`${label} must be numeric`)
  const nested = value.length > 0 && Array.isArray(value[0])
  if (!nested) return Array.from(value, number)
  return Array.from(value, (item: unknown) => {
    if (!Array.isArray(item)) throw new TypeError(`${label} has mixed dimensions`)
    return Array.from(item, number)
  })
}

/** Compare already validated numeric values without allocating another endpoint snapshot. */
export function sameShape(a: AnimationValue, b: AnimationValue): boolean {
  if (typeof a === 'number' || typeof b === 'number') {
    return typeof a === 'number' && typeof b === 'number'
  }
  return a.length === b.length && a.every((item, i) => sameShape(item, b[i]))
}

/**
 * Pure preflight: no target writes, callback execution, ownership changes or scheduling.
 * The caller must finish preflight before cancelling any existing task.
 * Omitted ordinary from remains omitted so replacement can capture the current composite.
 */
export function validateAnimationConfig(
  config: AnimationConfig,
  context?: (track: AnimationTrack) => AnimationTrackContext | undefined,
): ValidatedAnimationConfig {
  object(config, 'config')
  const duration = config.duration === undefined ? 1000 : config.duration
  const delay = config.delay === undefined ? 0 : config.delay
  time(duration, 'duration')
  time(delay, 'delay')
  const loop = iterations(config.loop === undefined ? 1 : config.loop)
  if (duration === 0 && loop === Infinity) {
    throw new RangeError('Zero duration cannot loop infinitely')
  }
  const direction = config.direction === undefined ? 'normal' : config.direction
  if (!['normal', 'reverse', 'alternate', 'alternate-reverse'].includes(direction)) {
    throw new TypeError('Unknown animation direction')
  }
  for (const field of ['force', 'additive'] as const) {
    if (config[field] !== undefined && typeof config[field] !== 'boolean') {
      throw new TypeError(`${field} must be boolean`)
    }
  }
  for (const field of ['initialize', 'during', 'done', 'aborted', 'onError'] as const) {
    if (config[field] !== undefined && typeof config[field] !== 'function') {
      throw new TypeError(`${field} must be a function`)
    }
  }
  const easing = getEasingFunction(config.easing === undefined ? 'linear' : config.easing)
  const additive = config.additive === undefined ? false : config.additive
  if (additive && loop !== 1) throw new RangeError('Additive tracks cannot loop')
  if (config.tracks !== undefined && !Array.isArray(config.tracks)) {
    throw new TypeError('tracks must be an array')
  }
  const seen = new Map<object, Set<string>>()
  const tracks: AnimationTrack[] = []
  for (const track of config.tracks ?? []) {
    object(track, 'track')
    object(track.target, 'track.target')
    if (typeof track.property !== 'string') throw new TypeError('property must be a string')
    const properties = seen.get(track.target) ?? new Set<string>()
    if (properties.has(track.property)) throw new TypeError('Duplicate target/property')
    properties.add(track.property)
    seen.set(track.target, properties)
    const current = copyAnimationValue(track.target[track.property], 'target value')
    const to = copyAnimationValue(track.to, 'to')
    const from = track.from === undefined ? undefined : copyAnimationValue(track.from, 'from')
    if (!sameShape(current, to) || (from !== undefined && !sameShape(from, to))) {
      throw new TypeError('Track values must have identical shapes')
    }
    const group = additive ? context?.(track) : undefined
    if (group) {
      if (iterations(group.baseLoop) !== 1) throw new RangeError('Additive base cannot loop')
      const start = copyAnimationValue(group.additiveFrom, 'additiveFrom')
      if (!sameShape(start, to) || (from !== undefined && !equalValues(from, start))) {
        throw new TypeError('Additive from must match the derived start')
      }
    } else if (additive && from !== undefined && !equalValues(from, current)) {
      throw new TypeError('Additive from must match the fixed base')
    }
    tracks.push({ target: track.target, property: track.property, from, to })
  }
  return {
    ...config,
    tracks,
    duration,
    delay,
    loop,
    direction,
    easing,
    additive,
    force: config.force === undefined ? false : config.force,
  }
}

/** Validate injection without calling the clock, requesting frames or installing timers. */
export function validateAnimationScheduler(scheduler: AnimationScheduler): void {
  object(scheduler, 'scheduler')
  for (const field of ['now', 'setTimer', 'clearTimer'] as const) {
    if (typeof scheduler[field] !== 'function') throw new TypeError(`${field} must be a function`)
  }
  const hasRequest = scheduler.requestFrame !== undefined
  const hasCancel = scheduler.cancelFrame !== undefined
  if (
    hasRequest !== hasCancel ||
    (hasRequest &&
      (typeof scheduler.requestFrame !== 'function' || typeof scheduler.cancelFrame !== 'function'))
  ) {
    throw new TypeError('requestFrame and cancelFrame must be supplied together as functions')
  }
}
