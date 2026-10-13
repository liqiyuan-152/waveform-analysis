import type { AnimationValue, Animator, EasingFunction, EasingType } from './core/types'

export type LineDrawingDirection = 'left-to-right' | 'right-to-left' | 'center-out'
export type AnnotationAnimationType = 'fade-in' | 'scale' | 'slide-in' | 'bounce'
export interface LineDrawingOptions {
  duration?: number
  delay?: number
  easing?: EasingType | EasingFunction
  direction?: LineDrawingDirection
  onComplete?: () => void
  onAbort?: () => void
}
export interface StaggeredLineDrawingOptions extends LineDrawingOptions {
  staggerDelay?: number
}
export interface DataUpdateOptions {
  duration?: number
  easing?: EasingType | EasingFunction
  onComplete?: () => void
  onAbort?: () => void
}
export interface AnnotationAnimationOptions extends DataUpdateOptions {
  type?: AnnotationAnimationType
}
export interface WaveformEnterAnimationOptions extends StaggeredLineDrawingOptions {
  enabled?: boolean
}
export interface WaveformUpdateAnimationOptions extends DataUpdateOptions {
  enabled?: boolean
}
export interface WaveformAnnotationAnimationOptions extends AnnotationAnimationOptions {
  enabled?: boolean
}
/** Default-on presentation animation; immutable business data and queries remain authoritative. */
export interface WaveformAnimationProps {
  animationEnabled?: boolean
  animation?: WaveformEnterAnimationOptions
  animationUpdate?: WaveformUpdateAnimationOptions
  animationAnnotation?: WaveformAnnotationAnimationOptions
  animationThreshold?: number
}
export interface ClipAnimationState {
  x: number
  width: number
}
export interface AnimationBinding<T> {
  read(): T
  write(state: T): void
}
export type NumericGeometry = Record<string, AnimationValue>
export interface GeometryTransitionInput {
  from: NumericGeometry
  to: NumericGeometry
  compatible: boolean
}
export type GeometryTransitionFrame =
  | { kind: 'settled'; values: NumericGeometry }
  | { kind: 'interpolate'; values: NumericGeometry; progress: number }
  | {
      kind: 'crossfade'
      from: NumericGeometry
      to: NumericGeometry
      fromOpacity: number
      toOpacity: number
    }
export interface AnnotationAnimationState {
  opacity: number
  scale: number
  offsetY: number
}
export type AnimationScope = 'enter' | 'update' | 'leave' | 'domain'
export interface AnimationObjectKey {
  kind: 'series' | 'annotation' | 'axis' | 'custom'
  id: string
  scope: AnimationScope
}
export interface WaveformAnimationControllerOptions {
  enabled?: boolean
  animator?: Animator
  commitFinalState: () => void
}
