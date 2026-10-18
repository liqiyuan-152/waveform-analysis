import { Animator } from './Animator'

export interface AnimationClock {
  now(): number
  request(callback: (time: number) => void): number
  cancel(handle: number): void
}

/** Elapsed-time adapter. All timing, pause reasons and reentrancy belong to Animator. */
export class ElapsedTimeline {
  private readonly animator: Animator

  constructor(
    clock: AnimationClock,
    private readonly report: (error: unknown) => void,
  ) {
    this.animator = new Animator({
      now: () => clock.now(),
      requestFrame: (callback) => clock.request(callback),
      cancelFrame: (handle) => clock.cancel(handle),
      // This forced looping task has no delay, so it never needs a timer.
      setTimer: () => {
        throw new Error('Elapsed timelines do not use delayed scheduling')
      },
      clearTimer: () => {},
    })
  }

  start(callback: (elapsed: number) => void) {
    this.stop()
    this.animator.animate(
      {
        duration: 1,
        loop: true,
        force: true,
        during: (_, frame) => callback(frame.iteration + frame.rawProgress),
        onError: this.report,
      },
      'elapsed',
    )
  }

  stop() {
    this.animator.remove('elapsed')
  }
  pause(reason: string) {
    this.animator.setPauseReason(reason, true)
  }
  resume(reason: string) {
    this.animator.setPauseReason(reason, false)
  }
  isRunning() {
    return this.animator.getAnimationCount() > 0
  }
}
