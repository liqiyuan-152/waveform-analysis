import { fadeOpacity } from '../../shared/animation/geometry'
import type { AnimationConfig } from '../core/types'
import type {
  AnimationBinding,
  AnnotationAnimationOptions,
  AnnotationAnimationState,
} from '../types'
import { annotationEasing, isAnnotationEffect, presetConfig, validateBinding } from './shared'

function annotationConfig(
  binding: AnimationBinding<AnnotationAnimationState>,
  options: AnnotationAnimationOptions,
  appear: boolean,
): AnimationConfig {
  validateBinding(binding)
  const type = options.type ?? 'scale'
  if (!isAnnotationEffect(type)) throw new TypeError('Unknown annotation effect')
  const easing = options.easing ?? annotationEasing[type]
  const final = {
    opacity: appear ? 1 : 0,
    scale: !appear && (type === 'scale' || type === 'bounce') ? 0 : 1,
    offsetY: !appear && type === 'slide-in' ? 8 : 0,
  }
  let from: AnnotationAnimationState | undefined
  return presetConfig(
    { ...options, easing },
    {
      initialize: () => {
        from = { ...binding.read() }
        if (!Object.values(from).every(Number.isFinite))
          throw new RangeError('Invalid annotation state')
      },
      during: (p, frame) => {
        if (frame.terminal) {
          binding.write({ ...final })
          return
        }
        const start = from ?? final
        const interpolate = (key: keyof AnnotationAnimationState) =>
          (1 - p) * start[key] + p * final[key]
        binding.write({
          opacity: fadeOpacity(start.opacity, final.opacity, p),
          scale: Math.max(0, interpolate('scale')),
          offsetY: interpolate('offsetY'),
        })
      },
    },
  )
}
export function createAnnotationAppearAnimation(
  binding: AnimationBinding<AnnotationAnimationState>,
  options: AnnotationAnimationOptions = {},
): AnimationConfig {
  return annotationConfig(binding, options, true)
}
export function createAnnotationDisappearAnimation(
  binding: AnimationBinding<AnnotationAnimationState>,
  options: AnnotationAnimationOptions = {},
): AnimationConfig {
  return annotationConfig(binding, options, false)
}
