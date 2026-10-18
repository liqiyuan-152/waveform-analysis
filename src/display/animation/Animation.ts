import { clampProgress, ease, type AnimationEasing } from './easing.js'

export interface AnimationTiming {
  duration: number
  delay?: number
  easing: AnimationEasing
}

/** Immutable timing snapshot; category ownership is managed by the chart controller. */
export class Animation {
  readonly duration: number
  readonly delay: number
  private readonly easing: AnimationEasing

  constructor(timing: AnimationTiming) {
    this.duration = timing.duration
    this.delay = timing.duration === 0 ? 0 : (timing.delay ?? 0)
    this.easing = timing.easing
  }

  sample(elapsed: number) {
    const progress = this.duration === 0 ? 1 : clampProgress((elapsed - this.delay) / this.duration)
    return {
      done: progress === 1,
      value: progress === 0 || progress === 1 ? progress : ease(this.easing, progress),
    }
  }
}
