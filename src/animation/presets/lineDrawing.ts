import type { AnimationConfig } from '../core/types'
import type {
  AnimationBinding,
  ClipAnimationState,
  LineDrawingOptions,
  StaggeredLineDrawingOptions,
} from '../types'
import { clampProgress, presetConfig, validateBinding } from './shared'

export function createLineDrawingAnimation(
  binding: AnimationBinding<ClipAnimationState>,
  width: number,
  options: LineDrawingOptions = {},
): AnimationConfig {
  validateBinding(binding)
  if (!Number.isFinite(width) || width < 0)
    throw new RangeError('Width must be finite and nonnegative')
  const direction = options.direction ?? 'left-to-right'
  if (!['left-to-right', 'right-to-left', 'center-out'].includes(direction))
    throw new TypeError('Invalid drawing direction')
  const state = (p: number): ClipAnimationState => ({
    x:
      direction === 'right-to-left'
        ? width * (1 - p)
        : direction === 'center-out'
          ? (width * (1 - p)) / 2
          : 0,
    width: width * p,
  })
  return presetConfig(
    { ...options, duration: options.duration ?? 1000 },
    {
      delay: options.delay ?? 0,
      initialize: () => binding.write(state(0)),
      during: (p, frame) => binding.write(state(frame.terminal ? 1 : clampProgress(p))),
    },
  )
}
export function createStaggeredLineDrawingAnimations(
  series: readonly { binding: AnimationBinding<ClipAnimationState>; width: number }[],
  options: StaggeredLineDrawingOptions = {},
): AnimationConfig[] {
  const stagger = options.staggerDelay ?? 100
  if (!Number.isFinite(stagger) || stagger < 0) throw new RangeError('Invalid stagger delay')
  return series.map((item, index) =>
    createLineDrawingAnimation(item.binding, item.width, {
      ...options,
      delay: (options.delay ?? 0) + index * stagger,
    }),
  )
}
