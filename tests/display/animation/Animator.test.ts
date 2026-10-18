import { describe, expect, it, vi } from 'vitest'
import { Animator, type AnimationClock } from '../../../src/display/animation/Animator'
import { ease } from '../../../src/display/animation/easing'

function clock() {
  let time = 0
  let sequence = 0
  const frames = new Map<number, (time: number) => void>()
  const source: AnimationClock = {
    now: () => time,
    request: (callback) => {
      frames.set(++sequence, callback)
      return sequence
    },
    cancel: (handle) => {
      frames.delete(handle)
    },
  }
  return {
    source,
    frames,
    step(delta: number) {
      time += delta
      const pending = [...frames.values()]
      frames.clear()
      pending.forEach((callback) => callback(time))
    },
  }
}

describe('instance animator', () => {
  it('owns at most one frame and excludes overlapping pause reasons', () => {
    const timer = clock()
    const draw = vi.fn()
    const animator = new Animator(timer.source, (error) => {
      throw error
    })
    animator.start(draw)
    timer.step(10)
    expect(draw).toHaveBeenLastCalledWith(10)
    expect(timer.frames.size).toBe(1)
    animator.pause('manual')
    animator.pause('hidden')
    timer.step(100)
    animator.resume('manual')
    expect(timer.frames.size).toBe(0)
    expect(animator.isRunning()).toBe(true)
    animator.resume('hidden')
    timer.step(10)
    expect(draw).toHaveBeenLastCalledWith(20)
    animator.stop()
    expect(timer.frames.size).toBe(0)
    expect(animator.isRunning()).toBe(false)
  })

  it('allows replacement from a frame without resurrecting the old run', () => {
    const timer = clock()
    const next = vi.fn()
    const animator = new Animator(timer.source, vi.fn())
    animator.start(() => animator.start(next))
    timer.step(10)
    expect(timer.frames.size).toBe(1)
    timer.step(5)
    expect(next).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledWith(5)
  })

  it('releases frames after calculation failure', () => {
    const timer = clock()
    const report = vi.fn()
    const animator = new Animator(timer.source, report)
    animator.start(() => ease(() => NaN, 0.5))
    timer.step(5)
    expect(report).toHaveBeenCalledOnce()
    expect(timer.frames.size).toBe(0)
    expect(animator.isRunning()).toBe(false)
    expect(() =>
      ease(() => {
        throw new Error('bad easing')
      }, 0.5),
    ).toThrow('bad easing')
  })
})
