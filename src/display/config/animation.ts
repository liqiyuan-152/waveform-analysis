import { easings } from '../animation/easing.js'
import type { AnimationEnterOptions, AnimationUpdateOptions } from '../types/animation.js'
import type { WaveformOptions } from '../types/options.js'

export const animationDefaults = {
  animationEnabled: false,
  animationThreshold: 10000,
  animation: {
    enabled: true,
    duration: 1000,
    easing: 'cubicInOut' as const,
    delay: 0,
    staggerDelay: 100,
    direction: 'left-to-right' as const,
  },
  animationUpdate: { enabled: true, duration: 300, easing: 'cubicInOut' as const },
}

function defined<T extends object>(options: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined),
  ) as Partial<T>
}

function validateCategory(options: AnimationEnterOptions, enter: boolean) {
  if (!options || typeof options !== 'object' || Array.isArray(options))
    throw new Error('Invalid animation options')
  if (options.enabled !== undefined && typeof options.enabled !== 'boolean')
    throw new Error('Invalid animation enabled')
  for (const key of enter
    ? (['duration', 'delay', 'staggerDelay'] as const)
    : (['duration'] as const)) {
    const value = options[key]
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0))
      throw new Error(`Invalid animation ${key}`)
  }
  if (
    options.easing !== undefined &&
    typeof options.easing !== 'function' &&
    !(typeof options.easing === 'string' && Object.hasOwnProperty.call(easings, options.easing))
  )
    throw new Error('Invalid animation easing')
  if (
    enter &&
    options.direction !== undefined &&
    !['left-to-right', 'right-to-left', 'center-out'].includes(options.direction)
  )
    throw new Error('Invalid animation direction')
  for (const key of ['onComplete', 'onAbort'] as const)
    if (options[key] !== undefined && typeof options[key] !== 'function')
      throw new Error(`Invalid animation ${key}`)
}

export function resolveAnimation(options: WaveformOptions) {
  if (options.animationEnabled !== undefined && typeof options.animationEnabled !== 'boolean')
    throw new Error('Invalid animationEnabled')
  const threshold = options.animationThreshold
  if (threshold !== undefined && (!Number.isInteger(threshold) || threshold < 0))
    throw new Error('Invalid animationThreshold')
  if (options.animation !== undefined) validateCategory(options.animation, true)
  if (options.animationUpdate !== undefined) validateCategory(options.animationUpdate, false)
  return {
    animationEnabled: options.animationEnabled ?? animationDefaults.animationEnabled,
    animationThreshold: threshold ?? animationDefaults.animationThreshold,
    animation: { ...animationDefaults.animation, ...defined(options.animation ?? {}) } as Required<
      Omit<AnimationEnterOptions, 'onComplete' | 'onAbort'>
    > &
      Pick<AnimationEnterOptions, 'onComplete' | 'onAbort'>,
    animationUpdate: {
      ...animationDefaults.animationUpdate,
      ...defined(options.animationUpdate ?? {}),
    } as Required<Omit<AnimationUpdateOptions, 'onComplete' | 'onAbort'>> &
      Pick<AnimationUpdateOptions, 'onComplete' | 'onAbort'>,
  }
}
