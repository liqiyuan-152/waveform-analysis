import type { AnimationConfig, AnimationValue } from '../core/types'
import { copyAnimationValue, validateAnimationConfig } from '../core/validation'
import type {
  AnimationBinding,
  AnnotationAnimationType,
  DataUpdateOptions,
  NumericGeometry,
} from '../types'

export const annotationEasing = {
  'fade-in': 'cubicOut',
  scale: 'backOut',
  'slide-in': 'cubicOut',
  bounce: 'bounceOut',
} as const
export function isAnnotationEffect(value: unknown): value is AnnotationAnimationType {
  return typeof value === 'string' && Object.hasOwn(annotationEasing, value)
}

export { clampProgress } from '../../shared/animation/geometry'
export function validateBinding<T>(binding: AnimationBinding<T>): void {
  if (!binding || typeof binding.read !== 'function' || typeof binding.write !== 'function') {
    throw new TypeError('Animation binding requires read and write functions')
  }
}
export function presetConfig(options: DataUpdateOptions, config: AnimationConfig): AnimationConfig {
  const result = {
    duration: options.duration ?? 300,
    easing: options.easing ?? 'cubicInOut',
    done: options.onComplete,
    aborted: options.onAbort,
    force: true,
    ...config,
  } satisfies AnimationConfig
  validateAnimationConfig(result)
  return result
}
function freezeValue(value: AnimationValue): AnimationValue {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (Array.isArray(item)) Object.freeze(item)
    })
    Object.freeze(value)
  }
  return value
}
export function copyGeometry(input: NumericGeometry): NumericGeometry {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new TypeError('Invalid geometry')
  return Object.freeze(
    Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, freezeValue(copyAnimationValue(value))]),
    ),
  )
}
export function validDomain(domain: readonly number[]): boolean {
  return domain.length === 2 && domain.every(Number.isFinite) && domain[0] < domain[1]
}
