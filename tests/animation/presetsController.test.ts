import { describe, expect, it, vi } from 'vitest'
import {
  Animator,
  WaveformAnimationController,
  createLineDrawingAnimation,
  createStaggeredLineDrawingAnimations,
  createPathTransitionAnimation,
  createYAxisScaleAnimation,
  createAnnotationAppearAnimation,
  createAnnotationDisappearAnimation,
} from '@/index'
import type {
  AnnotationAnimationType,
  AnnotationAnimationState,
  GeometryTransitionFrame,
} from '@/index'
import { createAnimationTestScheduler } from '@tests/support/animationScheduler'

function setup() {
  const fake = createAnimationTestScheduler(),
    animator = new Animator(fake.scheduler)
  return {
    fake,
    animator,
    frame: (ms: number) => {
      fake.advance(ms)
      fake.flushFrame()
    },
  }
}
function binding<T>(value: T) {
  const current = { value }
  return {
    current,
    read: vi.fn(() => current.value),
    write: vi.fn((next: T) => {
      current.value = next
    }),
  }
}

describe('pure numeric animation presets', () => {
  it.each(['left-to-right', 'right-to-left', 'center-out'] as const)(
    'draws %s with synchronized clip extent',
    (direction) => {
      const { animator, frame } = setup(),
        clip = binding({ x: 0, width: 100 })
      const config = createLineDrawingAnimation(clip, 100, {
        direction,
        easing: 'linear',
        delay: 200,
      })
      expect(clip.read).not.toHaveBeenCalled()
      expect(clip.write).not.toHaveBeenCalled()
      animator.animate(config)
      expect(clip.current.value.width).toBe(0)
      frame(700)
      expect(clip.current.value).toEqual({
        x: direction === 'right-to-left' ? 50 : direction === 'center-out' ? 25 : 0,
        width: 50,
      })
      frame(500)
      expect(clip.current.value).toEqual({ x: 0, width: 100 })
    },
  )
  it('validates a full stagger batch purely and ignores delay for zero duration', () => {
    const { animator } = setup(),
      clip = binding({ x: 0, width: 100 })
    expect(() =>
      createStaggeredLineDrawingAnimations([
        { binding: clip, width: 100 },
        { binding: clip, width: -1 },
      ]),
    ).toThrow()
    expect(clip.write).not.toHaveBeenCalled()
    const configs = createStaggeredLineDrawingAnimations([
      { binding: clip, width: 100 },
      { binding: clip, width: 100 },
    ])
    expect(configs.map((config) => config.delay)).toEqual([0, 100])
    animator.animate(createLineDrawingAnimation(clip, 100, { duration: 0, delay: 200 }))
    expect(clip.write).toHaveBeenCalledTimes(1)
    expect(clip.current.value.width).toBe(100)
  })
  it.each([true, false])(
    'releases old geometry before completion (compatible %s)',
    (compatible) => {
      const { animator, frame } = setup()
      const input = { from: { y: [0, 1] }, to: { y: [10, 11] }, compatible }
      let displayed: GeometryTransitionFrame | undefined
      const write = vi.fn((current: GeometryTransitionFrame) => {
        displayed = current
      })
      const done = vi.fn(() =>
        expect(displayed).toEqual({ kind: 'settled', values: { y: [10, 11] } }),
      )
      const config = createPathTransitionAnimation(input, write, {
        duration: 100,
        easing: 'linear',
        onComplete: done,
      })
      input.to.y[0] = 99
      input.compatible = !compatible
      expect(write).not.toHaveBeenCalled()
      animator.animate(config)
      frame(50)
      if (compatible)
        expect(displayed).toEqual({ kind: 'interpolate', values: { y: [5, 6] }, progress: 0.5 })
      else expect(displayed).toMatchObject({ kind: 'crossfade', fromOpacity: 0.5, toOpacity: 0.5 })
      frame(50)
      expect(done).toHaveBeenCalledTimes(1)
      expect(displayed).not.toHaveProperty('from')
    },
  )
  it('rejects mismatched geometry and keeps crossfade snapshots readonly', () => {
    expect(() =>
      createPathTransitionAnimation(
        { from: { x: [1] }, to: { y: [1] }, compatible: true },
        () => {},
      ),
    ).toThrow()
    expect(() =>
      createPathTransitionAnimation(
        { from: { x: [1] }, to: { x: [1, 2] }, compatible: true },
        () => {},
      ),
    ).toThrow()
    const { animator, frame } = setup(),
      write = vi.fn()
    animator.animate(
      createPathTransitionAnimation(
        { from: { x: [[1]] }, to: { y: [2] }, compatible: false },
        write,
      ),
    )
    frame(100)
    const current = write.mock.lastCall![0]
    expect(Object.isFrozen(current.from)).toBe(true)
    expect(Object.isFrozen(current.from.x[0])).toBe(true)
    animator.clear()
    expect(write.mock.lastCall![0].kind).toBe('crossfade')
  })
  it('uses single settled frames for static and explicit finish, including unchanged input', () => {
    const { animator } = setup(),
      write = vi.fn()
    const input = { from: { x: [0] }, to: { x: [1] }, compatible: true }
    animator.animate(createPathTransitionAnimation(input, write, { duration: 0 }))
    expect(write).toHaveBeenLastCalledWith({ kind: 'settled', values: input.to })
    const task = animator.animate(createPathTransitionAnimation(input, write))
    task.finish()
    expect(write).toHaveBeenCalledTimes(2)
    const same = animator.animate(
      createPathTransitionAnimation({ ...input, from: input.to }, write),
    )
    expect(same.state).toBe('FINISHED')
  })
  it('clamps domain bounce and preserves latest valid target', () => {
    const { animator, frame } = setup(),
      domain = binding<[number, number]>([0, 100])
    const config = createYAxisScaleAnimation(domain, [49, 51], { duration: 100, easing: 'backOut' })
    expect(domain.read).not.toHaveBeenCalled()
    animator.animate(config)
    frame(60)
    expect(domain.current.value).toEqual([49, 51])
    expect(() => createYAxisScaleAnimation(domain, [51, 49])).toThrow()
    expect(domain.current.value).toEqual([49, 51])
    animator.clear()
  })
  it.each<AnnotationAnimationType>(['fade-in', 'scale', 'slide-in', 'bounce'])(
    'animates %s relative styles and current-state exit',
    (type) => {
      const { animator, frame } = setup()
      const initial: AnnotationAnimationState = {
        opacity: 0,
        scale: type === 'scale' || type === 'bounce' ? 0 : 1,
        offsetY: type === 'slide-in' ? 8 : 0,
      }
      const styles = binding(initial)
      const config = createAnnotationAppearAnimation(styles, {
        type,
        duration: 100,
        easing: 'linear',
      })
      expect(styles.read).not.toHaveBeenCalled()
      expect(styles.write).not.toHaveBeenCalled()
      animator.animate(config)
      frame(50)
      expect(styles.current.value.opacity).toBe(0.5)
      expect(styles.current.value.scale).toBe(type === 'scale' || type === 'bounce' ? 0.5 : 1)
      expect(styles.current.value.offsetY).toBe(type === 'slide-in' ? 4 : 0)
      animator.clear()
      animator.animate(
        createAnnotationDisappearAnimation(styles, { type, duration: 100, easing: 'linear' }),
      )
      frame(50)
      expect(styles.current.value.opacity).toBe(0.25)
      frame(50)
      expect(styles.current.value.opacity).toBe(0)
    },
  )
  it('allows scale overshoot while limiting opacity', () => {
    const { animator, frame } = setup(),
      styles = binding({ opacity: 0, scale: 0, offsetY: 0 })
    animator.animate(createAnnotationAppearAnimation(styles, { duration: 100 }))
    frame(60)
    expect(styles.current.value.scale).toBeGreaterThan(1)
    expect(styles.current.value.opacity).toBe(1)
    animator.clear()
  })
})

describe('owner scoped controller lifecycle', () => {
  it('keeps preflight array endpoints when a replaced callback mutates the caller input', () => {
    const { animator, frame } = setup()
    const controller = new WaveformAnimationController({ animator, commitFinalState: () => {} })
    const key = { kind: 'custom', id: 'arrays', scope: 'update' } as const
    const target = { value: [[0, 0]] }
    const to = [[10, 20]]
    controller.animate(key, {
      force: true,
      aborted: () => {
        to[0][0] = NaN
        to[0].push(30)
      },
    })
    const done = vi.fn()
    const handle = controller.animate(key, {
      duration: 100,
      easing: 'linear',
      tracks: [{ target, property: 'value', to }],
      done,
    })
    frame(50)
    expect(target.value).toEqual([[5, 10]])
    handle.finish()
    expect(target.value).toEqual([[10, 20]])
    expect(done).toHaveBeenCalledOnce()
    expect(controller.getActiveAnimationCount()).toBe(0)
    expect(animator.getAnimationCount()).toBe(0)
  })
  it('isolates same series ID across charts without destroying shared scheduling', () => {
    const { animator, frame } = setup()
    const a = new WaveformAnimationController({ animator, commitFinalState: () => {} })
    const b = new WaveformAnimationController({ animator, commitFinalState: () => {} })
    const clipA = binding({ x: 0, width: 100 }),
      clipB = binding({ x: 0, width: 100 })
    const handleA = a.animateSeriesEnter('same', clipA, 100),
      handleB = b.animateSeriesEnter('same', clipB, 100)
    expect(handleA.id).not.toBe(handleB.id)
    a.destroy()
    frame(500)
    expect(handleA.state).toBe('ABORTED')
    expect(handleB.state).toBe('RUNNING')
    expect(clipB.current.value.width).toBeGreaterThan(0)
    b.destroy()
    expect(animator.getAnimationCount()).toBe(0)
  })
  it('commits current targets before done notifications without playing old during', () => {
    const { animator } = setup(),
      sequence: string[] = []
    const controller = new WaveformAnimationController({
      animator,
      commitFinalState: () => sequence.push('latest'),
    })
    const during = vi.fn(),
      done = vi.fn(() => sequence.push('done'))
    const task = controller.animate(
      { kind: 'custom', id: 'x', scope: 'update' },
      { force: true, during, done },
    )
    controller.finishAll()
    expect(sequence).toEqual(['latest', 'done'])
    expect(during).not.toHaveBeenCalled()
    expect(task.state).toBe('FINISHED')
    expect(controller.getActiveAnimationCount()).toBe(0)
  })
  it('reports failed commits as aborted and releases the owner barrier', () => {
    const { animator } = setup(),
      aborted = vi.fn(),
      done = vi.fn(),
      onError = vi.fn()
    let fail = true
    const controller = new WaveformAnimationController({
      animator,
      commitFinalState: () => {
        if (fail) throw Error('commit')
      },
    })
    const key = { kind: 'custom', id: 'x', scope: 'update' } as const
    const task = controller.animate(key, { force: true, aborted, done, onError })
    expect(() => controller.finishAll()).toThrow('commit')
    expect(task.state).toBe('ABORTED')
    expect(aborted).toHaveBeenCalledTimes(1)
    expect(done).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledTimes(1)
    fail = false
    expect(controller.animate(key, { duration: 0 }).state).toBe('FINISHED')
  })
  it('blocks recursive creation only for its owner and disposes idempotently', () => {
    const { animator } = setup()
    const a = new WaveformAnimationController({ animator, commitFinalState: () => {} })
    const b = new WaveformAnimationController({ animator, commitFinalState: () => {} })
    const key = { kind: 'custom', id: 'x', scope: 'update' } as const
    const done = vi.fn(() => {
      a.finishAll()
      expect(() => a.animate(key, { duration: 0 })).toThrowError(
        expect.objectContaining({ code: 'animation-terminating' }),
      )
      expect(b.animate(key, { force: true }).state).toBe('PENDING')
    })
    a.animate(key, { force: true, done })
    a.finishAll()
    expect(done).toHaveBeenCalledTimes(1)
    a.destroy()
    a.destroy()
    a.finishAll()
    a.cancelAll()
    expect(() => a.animate(key, {})).toThrowError(
      expect.objectContaining({ code: 'animation-disposed' }),
    )
    b.destroy()
  })
  it('skips initialize while disabled and toggling enabled does not replay', () => {
    const { animator, fake } = setup(),
      initialize = vi.fn(),
      done = vi.fn()
    const controller = new WaveformAnimationController({
      animator,
      enabled: false,
      commitFinalState: () => {},
    })
    const task = controller.animate(
      { kind: 'custom', id: 'x', scope: 'enter' },
      { initialize, done, force: true, loop: true },
    )
    expect(task.state).toBe('FINISHED')
    expect(initialize).not.toHaveBeenCalled()
    expect(done).toHaveBeenCalledTimes(1)
    controller.setEnabled(true)
    expect(fake.pendingFrames).toBe(0)
  })
  it('replaces enter/leave without tracks from current styles and opens clip before update', () => {
    const { animator, frame } = setup(),
      controller = new WaveformAnimationController({ animator, commitFinalState: () => {} })
    const style = binding({ opacity: 1, scale: 1, offsetY: 0 }),
      aborted = vi.fn()
    const leave = controller.animateAnnotationDisappear('a', style, {
      duration: 100,
      easing: 'linear',
      onAbort: aborted,
    })
    frame(50)
    controller.animateAnnotationAppear('a', style, { duration: 100, easing: 'linear' })
    expect(leave.state).toBe('ABORTED')
    frame(50)
    expect(style.current.value.opacity).toBe(0.75)
    const clip = binding({ x: 0, width: 100 })
    const enter = controller.animateSeriesEnter('s', clip, 100)
    frame(100)
    controller.animateDataUpdate(
      's',
      { from: { x: [0] }, to: { x: [1] }, compatible: true },
      () => {},
    )
    expect(enter.state).toBe('ABORTED')
    expect(clip.current.value.width).toBe(100)
    expect(aborted).toHaveBeenCalledTimes(1)
    controller.destroy()
  })
  it('keeps pause reasons separate from task manual pauses and category completion isolated', () => {
    const { animator, fake } = setup(),
      controller = new WaveformAnimationController({ animator, commitFinalState: () => {} })
    const key = { kind: 'custom', id: 'x', scope: 'update' } as const
    const manual = controller.animate(key, { force: true })
    manual.pause()
    controller.pauseAll()
    controller.setPauseReason('document-hidden', true)
    controller.resumeAll()
    controller.setPauseReason('document-hidden', false)
    expect(manual.state).toBe('PAUSED')
    expect(fake.pendingFrames).toBe(0)
    controller.pauseAll()
    expect(controller.animate({ ...key, id: 'y' }, { force: true }).state).toBe('PAUSED')
    const commit = vi.fn()
    controller.finishWhere((current) => current.id === 'x', commit)
    expect(manual.state).toBe('FINISHED')
    expect(controller.getActiveAnimationCount()).toBe(1)
    expect(commit).toHaveBeenCalledTimes(1)
    controller.destroy()
  })
})

it('inherits owner background pause before requesting a frame or delay timer', () => {
  const { animator, fake } = setup()
  const controller = new WaveformAnimationController({ animator, commitFinalState: () => {} })
  controller.setPauseReason('document-hidden', true)
  const request = vi.spyOn(fake.scheduler, 'requestFrame')
  const timer = vi.spyOn(fake.scheduler, 'setTimer')
  const handle = controller.animate(
    { kind: 'custom', id: 'background', scope: 'update' },
    { force: true, delay: 100 },
  )
  expect(handle.state).toBe('PAUSED')
  expect(request).not.toHaveBeenCalled()
  expect(timer).not.toHaveBeenCalled()
  controller.setPauseReason('document-hidden', false)
  expect(timer).toHaveBeenCalledOnce()
  controller.destroy()
})

it('preserves task manual pauses when an injected structural manager uses handle pause/resume', () => {
  const { animator, fake } = setup()
  const injected = {
    animate: animator.animate.bind(animator),
    remove: animator.remove.bind(animator),
    pause: animator.pause.bind(animator),
    resume: animator.resume.bind(animator),
    pauseAll: animator.pauseAll.bind(animator),
    resumeAll: animator.resumeAll.bind(animator),
    finishAll: animator.finishAll.bind(animator),
    clear: animator.clear.bind(animator),
    getAnimationCount: animator.getAnimationCount.bind(animator),
    destroy: animator.destroy.bind(animator),
  }
  const controller = new WaveformAnimationController({
    animator: injected,
    commitFinalState: () => {},
  })
  const handle = controller.animate({ kind: 'custom', id: 'x', scope: 'update' }, { force: true })
  handle.pause()
  controller.setPauseReason('document-hidden', true)
  controller.setPauseReason('document-hidden', false)
  expect(handle.state).toBe('PAUSED')
  expect(fake.pendingFrames).toBe(0)
  controller.pauseAll()
  handle.resume()
  expect(handle.state).toBe('PAUSED')
  controller.resumeAll()
  expect(handle.state).not.toBe('PAUSED')
  handle.abort()
  controller.setPauseReason('document-hidden', true)
  const request = vi.spyOn(fake.scheduler, 'requestFrame')
  const delayed = controller.animate(
    { kind: 'custom', id: 'delayed', scope: 'update' },
    { force: true, delay: 100 },
  )
  expect(delayed.state).toBe('PAUSED')
  expect(request).not.toHaveBeenCalled()
  controller.destroy()
})
