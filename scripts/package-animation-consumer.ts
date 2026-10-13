import {
  Animation,
  Animator,
  globalAnimator,
  WaveformAnimationController,
  createLineDrawingAnimation,
  createStaggeredLineDrawingAnimations,
  createPathTransitionAnimation,
  createYAxisScaleAnimation,
  createAnnotationAppearAnimation,
  createAnnotationDisappearAnimation,
  type AnimationBinding,
  type ClipAnimationState,
  type AnnotationAnimationState,
  type GeometryTransitionFrame,
  type AnimationConfig,
  type AnimationFrame,
} from 'waveform-analysis'
const clip: AnimationBinding<ClipAnimationState> = {
  read: () => ({ x: 0, width: 10 }),
  write: () => {},
}
const style: AnimationBinding<AnnotationAnimationState> = {
  read: () => ({ opacity: 1, scale: 1, offsetY: 0 }),
  write: () => {},
}
const domain: AnimationBinding<[number, number]> = { read: () => [0, 10], write: () => {} }
const geometry = { from: { points: [[0, 1]] }, to: { points: [[0, 2]] }, compatible: true }
const write = (frame: GeometryTransitionFrame) => {
  if (frame.kind === 'settled') {
    const values = frame.values
    void values
  }
}
const configs: AnimationConfig[] = [
  createLineDrawingAnimation(clip, 10, { direction: 'center-out' }),
  ...createStaggeredLineDrawingAnimations([{ binding: clip, width: 10 }], { staggerDelay: 0 }),
  createPathTransitionAnimation(geometry, write),
  createYAxisScaleAnimation(domain, [0, 20]),
  createAnnotationAppearAnimation(style, { type: 'slide-in' }),
  createAnnotationDisappearAnimation(style, { type: 'bounce' }),
]
const animator = new Animator()
const controller = new WaveformAnimationController({ animator, commitFinalState: () => {} })
controller.animateSeriesEnter('s', clip, 10)
controller.animateMultiSeriesEnter([{ id: 's', binding: clip, width: 10 }])
controller.animateDataUpdate('s', geometry, write)
controller.animateYAxisScale('axis', domain, [0, 20])
controller.animateAnnotationAppear('note', style)
controller.animateAnnotationDisappear('note', style)
controller.animate({ kind: 'custom', id: 'timer', scope: 'update' }, { force: true })
controller.pauseAll()
controller.resumeAll()
controller.cancelAll()
controller.finishAll()
controller.setEnabled(false)
controller.cancel({ kind: 'series', id: 's', scope: 'enter' })
controller.getActiveAnimationCount()
controller.destroy()
const manual = new Animation(configs[0])
manual.start(0)
manual.tick(10)
manual.pause(10)
manual.resume(20)
manual.finish()
manual.abort()
const frame: AnimationFrame = { rawProgress: 1, directedProgress: 1, iteration: 0, terminal: true }
// @ts-expect-error terminal is part of the required public contract
const missing: AnimationFrame = { rawProgress: 1, directedProgress: 1, iteration: 0 }
// @ts-expect-error SVG strings are outside the numeric track contract
animator.animate({ tracks: [{ target: { x: 'M0,0' }, property: 'x', to: 'M1,1' }] })
void [globalAnimator, frame, missing]
