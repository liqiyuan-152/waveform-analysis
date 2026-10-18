import type { AnimationEasing } from '../animation/easing.js'

export type { AnimationEasing }
export type AnimationDirection = 'left-to-right' | 'right-to-left' | 'center-out'

export interface AnimationUpdateOptions {
  enabled?: boolean
  duration?: number
  easing?: AnimationEasing
  onComplete?: () => void
  onAbort?: () => void
}

export interface AnimationEnterOptions extends AnimationUpdateOptions {
  delay?: number
  staggerDelay?: number
  direction?: AnimationDirection
}

export interface WaveformAnimation {
  pause(): void
  resume(): void
  finish(): void
  isRunning(): boolean
}
