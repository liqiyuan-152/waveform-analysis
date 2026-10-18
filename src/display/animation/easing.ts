import { getEasingFunction } from '../../animation/core/easing'
export { clampProgress } from '../../shared/animation/geometry'
export const easings = {
  linear: getEasingFunction('linear'),
  cubicInOut: getEasingFunction('cubicInOut'),
}

export type AnimationEasing = keyof typeof easings | ((progress: number) => number)

export function ease(easing: AnimationEasing, progress: number): number {
  const result = (typeof easing === 'function' ? easing : easings[easing])(progress)
  if (!Number.isFinite(result)) throw new Error('Animation easing must return a finite number')
  return result
}
