/** Numeric output only: geometry strings and typed arrays are not animation values. */
export type AnimationValue = number | number[] | number[][]
export type AnimationDirection = 'normal' | 'reverse' | 'alternate' | 'alternate-reverse'
export type AnimationState = 'PENDING' | 'RUNNING' | 'PAUSED' | 'FINISHED' | 'ABORTED'
export type EasingFunction = (progress: number) => number
export type EasingFamily =
  'quad' | 'cubic' | 'quart' | 'quint' | 'sine' | 'expo' | 'circ' | 'back' | 'elastic' | 'bounce'
export type EasingType = 'linear' | `${EasingFamily}${'In' | 'Out' | 'InOut'}`

export interface AnimationFrame {
  rawProgress: number
  directedProgress: number
  /** Zero-based iteration. */
  iteration: number
  /** Natural completion or explicit finish; abort never produces a terminal frame. */
  terminal: boolean
}

export interface AnimationTrack {
  target: Record<string, AnimationValue>
  property: string
  /** Omitted ordinary starts are captured at registration; additive starts are derived. */
  from?: AnimationValue
  to: AnimationValue
}

/** All time values are milliseconds. Validation precedes initialization and replacement. */
export interface AnimationConfig {
  initialize?: () => void
  tracks?: AnimationTrack[]
  /** Defaults to 1000ms; zero completes synchronously without delay. */
  duration?: number
  /** First iteration only, defaults to 0ms. */
  delay?: number
  /** Defaults to linear; custom functions may overshoot. */
  easing?: EasingType | EasingFunction
  /** Defaults to 1; false means once, true means infinite, numbers are positive integers. */
  loop?: number | boolean
  /** Defaults to normal; direction is applied before easing. */
  direction?: AnimationDirection
  /** Defaults to false; does not override component disable/fallback policies. */
  force?: boolean
  /** Defaults to false; additive tracks and their bases must not loop. */
  additive?: boolean
  during?: (easedProgress: number, frame: AnimationFrame) => void
  done?: () => void
  aborted?: () => void
  onError?: (error: unknown) => void
}

export interface AnimationHandle {
  readonly id: string
  readonly state: AnimationState
  pause(): void
  resume(): void
  abort(): void
  finish(): void
}

/** RAF functions must be provided together, or both omitted for static completion. */
export interface AnimationScheduler {
  now(): number
  requestFrame?: (callback: (time: number) => void) => number
  cancelFrame?: (id: number) => void
  setTimer(callback: () => void, delay: number): unknown
  clearTimer(id: unknown): void
}

/** Structural contract for injected Animator implementations (ENG-09). */
export interface Animator {
  animate(config: AnimationConfig, id?: string): AnimationHandle
  remove(id: string): void
  pause(id: string): void
  resume(id: string): void
  pauseAll(): void
  resumeAll(): void
  finishAll(): void
  clear(): void
  getAnimationCount(): number
  destroy(): void
}
