import { describe, expect, it, vi } from 'vitest'
import { Animation, Animator } from '@/index'
import type { AnimationConfig, AnimationDirection } from '@/index'
import { createAnimationTestScheduler } from '@tests/support/animationScheduler'

function managed() {
  const fake = createAnimationTestScheduler()
  const animator = new Animator(fake.scheduler)
  const frame = (ms: number) => {
    fake.advance(ms)
    fake.flushFrame()
  }
  return { fake, animator, frame }
}

describe('manual timeline', () => {
  it('freezes delay and running time across pauses', () => {
    const during = vi.fn(),
      done = vi.fn()
    const animation = new Animation({ duration: 1000, delay: 200, force: true, during, done })
    animation.start(0)
    animation.pause(100)
    animation.tick(500)
    animation.resume(600)
    animation.tick(699)
    expect(during).not.toHaveBeenCalled()
    animation.tick(700)
    animation.tick(1200)
    expect(during).toHaveBeenLastCalledWith(0.5, {
      rawProgress: 0.5,
      directedProgress: 0.5,
      iteration: 0,
      terminal: false,
    })
    expect(animation.tick(1700)).toBe(true)
    expect(animation.state).toBe('FINISHED')
    animation.tick(9999)
    animation.finish()
    animation.abort()
    expect(done).toHaveBeenCalledTimes(1)
    expect(() => animation.start(2000)).toThrow()
  })
  it.each<AnimationDirection>(['normal', 'reverse', 'alternate', 'alternate-reverse'])(
    'computes %s across exact boundaries and multi-cycle jumps',
    (direction) => {
      const during = vi.fn()
      const animation = new Animation({ duration: 100, loop: 4, force: true, direction, during })
      animation.start(0)
      animation.tick(100)
      const reverseAtOne = direction === 'reverse' || direction === 'alternate'
      expect(during.mock.lastCall?.[0]).toBe(reverseAtOne ? 1 : 0)
      animation.tick(250)
      expect(during.mock.lastCall?.[1]).toMatchObject({
        iteration: 2,
        rawProgress: 0.5,
        terminal: false,
      })
      animation.tick(400)
      expect(during.mock.lastCall?.[0]).toBe(reverseAtOne ? 0 : 1)
      expect(during.mock.lastCall?.[1]).toMatchObject({ iteration: 3, terminal: true })
    },
  )
  it('skips initialize and easing for zero-duration terminal frames', () => {
    const target = { x: 10 },
      initialize = vi.fn(),
      easing = vi.fn(() => 7),
      done = vi.fn()
    const animation = new Animation({
      tracks: [{ target, property: 'x', to: 20 }],
      duration: 0,
      delay: 1000,
      loop: 2,
      direction: 'alternate',
      initialize,
      easing,
      done,
    })
    animation.start(0)
    expect(target.x).toBe(10)
    expect(initialize).not.toHaveBeenCalled()
    expect(easing).not.toHaveBeenCalled()
    expect(done).toHaveBeenCalledTimes(1)
  })
  it('finishes infinite alternate at the current iteration endpoint and abort freezes', () => {
    const target = { x: 0 },
      done = vi.fn(),
      aborted = vi.fn()
    const animation = new Animation({
      tracks: [{ target, property: 'x', to: 10 }],
      duration: 100,
      loop: true,
      direction: 'alternate',
      done,
      aborted,
    })
    animation.start(0)
    animation.tick(150)
    expect(target.x).toBe(5)
    animation.finish()
    expect(target.x).toBe(0)
    expect(done).toHaveBeenCalledTimes(1)
    expect(aborted).not.toHaveBeenCalled()
    const second = new Animation({ tracks: [{ target, property: 'x', to: 10 }], aborted })
    second.start(0)
    second.tick(400)
    second.abort()
    second.tick(900)
    expect(target.x).toBe(4)
    expect(aborted).toHaveBeenCalledTimes(1)
  })
  it('replaces arrays instead of mutating input', () => {
    const value = [[0, 2], [4]],
      to = [[10, 4], [8]],
      target = { value }
    const animation = new Animation({ tracks: [{ target, property: 'value', to }] })
    animation.start(0)
    animation.tick(500)
    expect(target.value).toEqual([[5, 3], [6]])
    expect(target.value).not.toBe(value)
    expect(value).toEqual([[0, 2], [4]])
    expect(to).toEqual([[10, 4], [8]])
  })
})

describe('numeric groups and replacement transactions', () => {
  it.each(['ordinary', 'additive'] as const)(
    'isolates committed nested arrays when the %s writer is aborted',
    (writer) => {
      const { animator, frame } = managed()
      const input = [[0, 2], [4]]
      const target = { value: input }
      const ordinary = animator.animate({
        duration: 1000,
        tracks: [{ target, property: 'value', to: [[10, 12], [14]] }],
      })
      const additive = animator.animate({
        duration: 1000,
        additive: true,
        tracks: [{ target, property: 'value', to: [[14, 18], [22]] }],
      })
      frame(500)
      expect(target.value).toEqual([[7, 10], [13]])
      const output = target.value
      const stopped = writer === 'ordinary' ? ordinary : additive
      stopped.abort()
      output[0][0] = 999
      frame(250)
      expect(target.value).toEqual(
        writer === 'ordinary' ? [[8, 11.5], [15]] : [[9.5, 12.5], [15.5]],
      )
      expect(target.value).not.toBe(output)
      expect(input).toEqual([[0, 2], [4]])
      animator.finishAll()
    },
  )

  it('keeps an invalid same-id replacement side-effect free', () => {
    const { animator, frame } = managed()
    const target = { x: 0 },
      aborted = vi.fn(),
      initialize = vi.fn()
    const old = animator.animate({ tracks: [{ target, property: 'x', to: 100 }], aborted }, 'x')
    frame(400)
    expect(() => animator.animate({ duration: -1, initialize }, 'x')).toThrow()
    expect(old.state).toBe('RUNNING')
    expect(target.x).toBe(40)
    expect(aborted).not.toHaveBeenCalled()
    expect(initialize).not.toHaveBeenCalled()
    frame(600)
    expect(target.x).toBe(100)
  })
  it('takes over all conflicting tasks and freezes untouched properties', () => {
    const { animator, frame } = managed()
    const target = { x: 0, y: 0 },
      aborted = vi.fn()
    animator.animate({
      tracks: [
        { target, property: 'x', to: 100 },
        { target, property: 'y', to: 200 },
      ],
      aborted,
    })
    frame(400)
    animator.animate({ tracks: [{ target, property: 'x', from: -1, to: 20 }], duration: 100 })
    frame(50)
    expect(target).toEqual({ x: 30, y: 80 })
    frame(50)
    expect(target).toEqual({ x: 20, y: 80 })
    expect(aborted).toHaveBeenCalledTimes(1)
  })
  it.each([0, 100])('honors latest reentrant replacement (duration %s)', (duration) => {
    const { animator, frame } = managed()
    const target = { x: 0 }
    animator.animate(
      {
        tracks: [{ target, property: 'x', to: 100 }],
        aborted: () => {
          animator.animate({ tracks: [{ target, property: 'x', to: 30 }], duration: 0 }, 'x')
        },
      },
      'x',
    )
    frame(400)
    const b = animator.animate({ tracks: [{ target, property: 'x', to: 20 }], duration }, 'x')
    expect(b.state).toBe('ABORTED')
    expect(target.x).toBe(30)
    frame(1000)
    expect(target.x).toBe(30)
  })
  it('handles zero duration replacement and unchanged/force timing', () => {
    const { animator, fake, frame } = managed()
    const target = { x: 0 }
    const old = animator.animate({ tracks: [{ target, property: 'x', to: 100 }] })
    frame(400)
    animator.animate({ tracks: [{ target, property: 'x', to: 20 }], duration: 0 })
    expect(old.state).toBe('ABORTED')
    expect(target.x).toBe(20)
    expect(fake.pendingFrames).toBe(0)
    const initialize = vi.fn(),
      during = vi.fn()
    expect(animator.animate({ initialize, during }).state).toBe('FINISHED')
    expect(initialize).not.toHaveBeenCalled()
    expect(during).toHaveBeenCalledWith(1, expect.objectContaining({ terminal: true }))
    animator.animate({ force: true })
    expect(fake.pendingFrames).toBe(1)
    animator.destroy()
  })
  it('finishes unchanged nested tracks synchronously without modifying frozen inputs', () => {
    const { animator, fake } = managed()
    const from = [
      [0, 2],
      [3, 4],
    ]
    const to = [
      [-0, 2],
      [3, 4],
    ]
    for (const matrix of [from, to]) {
      matrix.forEach(Object.freeze)
      Object.freeze(matrix)
    }
    const target = { matrix: from }
    const initialize = vi.fn()
    const done = vi.fn()
    const handle = animator.animate({
      tracks: [{ target, property: 'matrix', from, to }],
      initialize,
      done,
    })
    expect(handle.state).toBe('FINISHED')
    expect(initialize).not.toHaveBeenCalled()
    expect(done).toHaveBeenCalledTimes(1)
    expect(fake.pendingFrames).toBe(0)
    expect(fake.pendingTimers).toBe(0)
    expect(from).toEqual([
      [0, 2],
      [3, 4],
    ])
    expect(Object.is(to[0][0], -0)).toBe(true)
    animator.destroy()
  })
  it('drops an unstarted additive contribution before deriving the next nested start', () => {
    const { animator, frame } = managed()
    const input = [[10, 20], [30]]
    const target = { value: input }
    animator.animate({ tracks: [{ target, property: 'value', to: [[20, 30], [40]] }] })
    const aborted = vi.fn()
    const pending = animator.animate({
      delay: 100,
      additive: true,
      tracks: [{ target, property: 'value', to: [[24, 34], [44]] }],
      aborted,
    })
    pending.abort()
    pending.abort()
    expect(aborted).toHaveBeenCalledTimes(1)
    animator.animate({
      additive: true,
      tracks: [{ target, property: 'value', from: [[20, 30], [40]], to: [[28, 38], [48]] }],
    })
    frame(500)
    expect(target.value).toEqual([[19, 29], [39]])
    expect(input).toEqual([[10, 20], [30]])
    animator.finishAll()
    expect(target.value).toEqual([[28, 38], [48]])
    expect(animator.getAnimationCount()).toBe(0)
  })
  it('composes 10+2+3 without drift and absorbs completed offsets exactly once', () => {
    const { animator, frame, fake } = managed()
    const target = { x: 10 }
    const a = animator.animate({
      additive: true,
      tracks: [{ target, property: 'x', from: 10, to: 14 }],
    })
    animator.animate({ additive: true, tracks: [{ target, property: 'x', from: 14, to: 20 }] })
    frame(500)
    expect(target.x).toBe(15)
    fake.flushFrame()
    expect(target.x).toBe(15)
    a.finish()
    expect(target.x).toBe(17)
    frame(500)
    expect(target.x).toBe(20)
    animator.animate({ additive: true, tracks: [{ target, property: 'x', to: 25 }] })
    frame(1000)
    expect(target.x).toBe(25)
  })
  it('preserves partial abort offsets and derives the next additive from', () => {
    const { animator, frame } = managed()
    const target = { x: 10 }
    const a = animator.animate({ additive: true, tracks: [{ target, property: 'x', to: 14 }] })
    animator.animate({ additive: true, tracks: [{ target, property: 'x', to: 20 }] })
    frame(500)
    a.abort()
    expect(target.x).toBe(15)
    animator.animate({ additive: true, tracks: [{ target, property: 'x', from: 18, to: 25 }] })
    frame(1000)
    expect(target.x).toBe(25)
  })
  it('derives direction-aware ends and rejects looping bases without stopping them', () => {
    const { animator, frame } = managed()
    const target = { x: 10 }
    const base = animator.animate({
      direction: 'reverse',
      tracks: [{ target, property: 'x', to: 14 }],
    })
    animator.animate({ additive: true, tracks: [{ target, property: 'x', from: 10, to: 20 }] })
    frame(1000)
    expect(target.x).toBe(20)
    expect(base.state).toBe('FINISHED')
    const looping = animator.animate({ loop: 2, tracks: [{ target, property: 'x', to: 30 }] })
    expect(() =>
      animator.animate({ additive: true, tracks: [{ target, property: 'x', to: 40 }] }),
    ).toThrow()
    expect(looping.state).toBe('PENDING')
    animator.clear()
  })
  it('ordinary takeover clears additive contributions and array additive is supported', () => {
    const { animator, frame } = managed()
    const target = { x: [10, 20] }
    animator.animate({ additive: true, tracks: [{ target, property: 'x', to: [14, 24] }] })
    frame(500)
    expect(target.x).toEqual([12, 22])
    animator.animate({ tracks: [{ target, property: 'x', to: [30, 40] }] })
    frame(500)
    expect(target.x).toEqual([21, 31])
    frame(500)
    expect(target.x).toEqual([30, 40])
  })
})

describe('scheduling, pause ownership and exception isolation', () => {
  it('uses one delayed timer, pauses all work and cleans up', () => {
    const { animator, fake } = managed()
    animator.animate({ force: true, delay: 200 }, 'a')
    animator.animate({ force: true, delay: 100 }, 'b')
    expect(fake.pendingFrames).toBe(0)
    expect(fake.pendingTimers).toBe(1)
    animator.pauseAll()
    expect(fake.pendingTimers).toBe(0)
    animator.resumeAll()
    expect(fake.pendingTimers).toBe(1)
    fake.advance(100)
    expect(fake.pendingFrames).toBe(1)
    animator.clear()
    expect(fake.pendingFrames + fake.pendingTimers).toBe(0)
    expect(fake.clearedTimers).toBeGreaterThan(0)
    expect(fake.cancelledFrames).toBeGreaterThan(0)
  })
  it('keeps manual, batch and document pause intervals independent and inherits reasons', () => {
    const { animator, fake, frame } = managed()
    const target = { x: 0 }
    const task = animator.animate({ tracks: [{ target, property: 'x', to: 100 }] }, 'a')
    frame(100)
    task.pause()
    fake.advance(100)
    animator.setPauseReason('document-hidden', true)
    fake.advance(100)
    task.resume()
    const newTask = animator.animate({ force: true, delay: 100 }, 'b')
    expect(newTask.state).toBe('PAUSED')
    expect(fake.pendingFrames + fake.pendingTimers).toBe(0)
    fake.advance(200)
    animator.setPauseReason('document-hidden', false)
    frame(100)
    expect(target.x).toBe(20)
    task.pause()
    animator.pauseAll()
    animator.resumeAll()
    expect(task.state).toBe('PAUSED')
    task.resume()
    animator.destroy()
    expect(fake.pendingFrames + fake.pendingTimers).toBe(0)
    expect(animator.animate({ duration: 0 }).state).toBe('FINISHED')
  })
  it('preserves manager pause settings on clear but resets them on destroy', () => {
    const { animator, fake } = managed()
    animator.pauseAll()
    animator.clear()
    const paused = animator.animate({ force: true })
    expect(paused.state).toBe('PAUSED')
    expect(fake.pendingFrames).toBe(0)
    animator.destroy()
    expect(animator.animate({ force: true }).state).toBe('PENDING')
    animator.clear()
  })
  it('does not delete same-id tasks created by completion and advances them next frame', () => {
    const { animator, fake, frame } = managed()
    const during = vi.fn()
    animator.animate(
      {
        force: true,
        duration: 100,
        done: () => {
          animator.animate({ force: true, during }, 'a')
        },
      },
      'a',
    )
    frame(100)
    expect(animator.getAnimationCount()).toBe(1)
    expect(during).not.toHaveBeenCalled()
    fake.flushFrame()
    expect(during).toHaveBeenCalledTimes(1)
    animator.clear()
  })
  it.each(['finishAll', 'clear', 'destroy'] as const)(
    '%s rejects reentrant creation and recursive termination',
    (method) => {
      const { animator, fake } = managed()
      const rejected = vi.fn(),
        onError = vi.fn()
      const continuation = () => {
        animator[method]()
        expect(() =>
          animator.animate({ duration: 0, done: rejected, aborted: rejected }),
        ).toThrowError(expect.objectContaining({ code: 'animation-terminating' }))
      }
      animator.animate({ force: true, done: continuation, aborted: continuation, onError })
      animator[method]()
      expect(rejected).not.toHaveBeenCalled()
      expect(onError).not.toHaveBeenCalled()
      expect(animator.getAnimationCount()).toBe(0)
      expect(fake.pendingFrames + fake.pendingTimers).toBe(0)
    },
  )
  it.each(['easing', 'during', 'initialize'] as const)(
    'isolates %s errors from peer tasks',
    (field) => {
      const { animator, frame } = managed()
      const aborted = vi.fn(),
        onError = vi.fn(),
        done = vi.fn(),
        target = { x: 0 }
      const config: AnimationConfig = {
        force: true,
        aborted,
        onError,
        done,
        [field]: () => {
          throw new Error('bad task')
        },
      }
      const bad = animator.animate(config)
      animator.animate({ tracks: [{ target, property: 'x', to: 10 }], duration: 100 })
      frame(100)
      expect(bad.state).toBe('ABORTED')
      expect(aborted).toHaveBeenCalledTimes(1)
      expect(done).not.toHaveBeenCalled()
      expect(onError).toHaveBeenCalledTimes(1)
      expect(target.x).toBe(10)
    },
  )
  it('reports nonfinite easing and callback/reporter errors without changing a finished state', () => {
    const { animator, frame } = managed()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const aborted = vi.fn()
    const bad = animator.animate({
      force: true,
      easing: () => NaN,
      aborted,
      onError: () => {
        throw Error('reporter')
      },
    })
    frame(10)
    expect(bad.state).toBe('ABORTED')
    expect(aborted).toHaveBeenCalledTimes(1)
    const finished = animator.animate({
      duration: 0,
      done: () => {
        throw Error('done')
      },
      aborted,
    })
    expect(finished.state).toBe('FINISHED')
    expect(aborted).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalledTimes(2)
    consoleError.mockRestore()
  })
  it('statically finishes without RAF and does not execute initialization or timers', () => {
    const fake = createAnimationTestScheduler(false),
      animator = new Animator(fake.scheduler)
    const target = { x: 0 },
      initialize = vi.fn(),
      done = vi.fn()
    const task = animator.animate({
      loop: true,
      force: true,
      initialize,
      done,
      tracks: [{ target, property: 'x', to: 10 }],
    })
    expect(task.state).toBe('FINISHED')
    expect(target.x).toBe(10)
    expect(initialize).not.toHaveBeenCalled()
    expect(done).toHaveBeenCalledTimes(1)
    expect(fake.pendingFrames + fake.pendingTimers).toBe(0)
    animator.remove('unknown')
    animator.pause('unknown')
    animator.resume('unknown')
  })
})

describe('numeric write isolation', () => {
  it('isolates throwing setters and continues independent tasks', () => {
    const { animator, frame } = managed()
    const error = vi.fn()
    const broken = Object.defineProperty({}, 'x', {
      get: () => 0,
      set: () => {
        throw new Error('setter failed')
      },
    }) as { x: number }
    const good = { x: 0 }
    const failed = animator.animate({
      duration: 100,
      tracks: [{ target: broken, property: 'x', to: 10 }],
      onError: error,
    })
    const running = animator.animate({
      duration: 100,
      tracks: [{ target: good, property: 'x', to: 10 }],
    })
    frame(50)
    expect(failed.state).toBe('ABORTED')
    expect(error).toHaveBeenCalledOnce()
    expect(good.x).toBe(5)
    frame(50)
    expect(running.state).toBe('FINISHED')
    expect(good.x).toBe(10)
  })
  it('aborts nonfinite interpolation before writing the property', () => {
    const { animator, frame } = managed()
    const target = { x: 1e308 }
    const error = vi.fn()
    const task = animator.animate({
      duration: 100,
      easing: () => 100,
      tracks: [{ target, property: 'x', to: -1e308 }],
      onError: error,
    })
    frame(50)
    expect(task.state).toBe('ABORTED')
    expect(target.x).toBe(1e308)
    expect(error).toHaveBeenCalledOnce()
  })
})

it('finishes an infinite managed task at the effective current iteration between RAF frames', () => {
  const { animator, fake } = managed()
  const target = { x: 0 }
  const handle = animator.animate({
    duration: 100,
    loop: true,
    direction: 'alternate',
    tracks: [{ target, property: 'x', to: 10 }],
  })
  fake.advance(150)
  handle.finish()
  expect(target.x).toBe(0)
  expect(handle.state).toBe('FINISHED')
  const paused = animator.animate({
    duration: 100,
    loop: true,
    direction: 'alternate',
    tracks: [{ target, property: 'x', to: 10 }],
  })
  fake.advance(150)
  paused.pause()
  fake.advance(500)
  animator.finishAll()
  expect(target.x).toBe(0)
})

it('freezes the last written base when a peer easing aborts it before frame composition', () => {
  const { animator, frame } = managed()
  const target = { x: 0 }
  const base = animator.animate({ duration: 100, tracks: [{ target, property: 'x', to: 100 }] })
  animator.animate({ duration: 100, additive: true, tracks: [{ target, property: 'x', to: 120 }] })
  frame(20)
  expect(target.x).toBe(24)
  animator.animate({
    duration: 100,
    force: true,
    easing: () => {
      base.abort()
      return 0
    },
  })
  frame(20)
  expect(target.x).toBe(28)
})
