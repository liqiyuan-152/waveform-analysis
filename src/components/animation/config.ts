import { getEasingFunction } from '@/animation/core/easing'
import { annotationEasing, isAnnotationEffect } from '@/animation/presets/shared'
import type {
  WaveformAnimationProps,
  AnnotationAnimationType,
  LineDrawingDirection,
} from '@/animation/types'

export function resolveAnimationProps(
  props: WaveformAnimationProps,
  warn = (message: string) => {
    if (import.meta.env.DEV) console.warn(message)
  },
) {
  function field<T>(value: T | undefined, fallback: T, valid: (v: T) => boolean, key: string): T {
    if (value === undefined) return fallback
    if (valid(value)) return value
    if (import.meta.env.DEV) warn(`Invalid animation configuration: ${key}`)
    return fallback
  }
  const nonnegative = (v: number) => typeof v === 'number' && Number.isFinite(v) && v >= 0
  const boolean = (v: boolean) => typeof v === 'boolean'
  const easing = (v: unknown) => {
    try {
      getEasingFunction(v as never)
      return true
    } catch {
      return false
    }
  }
  const callback = (v: unknown) => typeof v === 'function'
  function options<
    T extends {
      enabled?: boolean
      duration?: number
      easing?: unknown
      onComplete?: () => void
      onAbort?: () => void
    },
  >(input: T | undefined, duration: number, defaultEasing: string) {
    return {
      enabled: field(input?.enabled, true, boolean, 'enabled'),
      duration: field(input?.duration, duration, nonnegative, 'duration'),
      easing: field(input?.easing, defaultEasing, easing, 'easing') as NonNullable<T['easing']>,
      onComplete:
        input?.onComplete === undefined
          ? undefined
          : field(input.onComplete, () => {}, callback, 'onComplete'),
      onAbort:
        input?.onAbort === undefined
          ? undefined
          : field(input.onAbort, () => {}, callback, 'onAbort'),
    }
  }
  const annotationType = field<AnnotationAnimationType>(
    props.animationAnnotation?.type,
    'scale',
    isAnnotationEffect,
    'annotation.type',
  )
  return {
    animationEnabled: field(props.animationEnabled, true, boolean, 'animationEnabled'),
    animationThreshold: field(
      props.animationThreshold,
      200000,
      (v) => nonnegative(v) && Number.isInteger(v),
      'animationThreshold',
    ),
    animation: {
      ...options(props.animation, 1000, 'cubicInOut'),
      delay: field(props.animation?.delay, 0, nonnegative, 'delay'),
      staggerDelay: field(props.animation?.staggerDelay, 100, nonnegative, 'staggerDelay'),
      direction: field<LineDrawingDirection>(
        props.animation?.direction,
        'left-to-right',
        (v) => ['left-to-right', 'right-to-left', 'center-out'].includes(v),
        'direction',
      ),
    },
    animationUpdate: options(props.animationUpdate, 300, 'cubicInOut'),
    animationAnnotation: {
      ...options(props.animationAnnotation, 300, annotationEasing[annotationType]),
      type: annotationType,
    },
  }
}
export type ResolvedAnimationProps = ReturnType<typeof resolveAnimationProps>
