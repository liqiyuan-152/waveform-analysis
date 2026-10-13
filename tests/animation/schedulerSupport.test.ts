import { describe, expect, it, vi } from 'vitest'
import { createAnimationTestScheduler } from '@tests/support/animationScheduler'
import { createAnimationOwner } from '@/animation/core/owner'

describe('deterministic animation scheduling support', () => {
  it('controls clock, frame progress and next-frame requests without real waiting', () => {
    const fake = createAnimationTestScheduler()
    const progress: number[] = []
    const tick = (time: number) => {
      progress.push(time / 1000)
      fake.scheduler.requestFrame!(tick)
    }
    fake.scheduler.requestFrame!(tick)
    fake.advance(500)
    expect(progress).toEqual([])
    fake.flushFrame()
    expect(progress).toEqual([0.5])
    expect(fake.pendingFrames).toBe(1)
    fake.advance(250)
    fake.flushFrame()
    expect(progress).toEqual([0.5, 0.75])
    expect(fake.scheduler.now()).toBe(750)
    expect(fake.requestedFrames).toBe(3)
  })
  it('runs timers at deadlines before frames and respects cancellation during a snapshot', () => {
    const fake = createAnimationTestScheduler()
    const calls: number[] = []
    fake.scheduler.setTimer(() => calls.push(fake.scheduler.now()), 200)
    const removed = fake.scheduler.setTimer(() => calls.push(-1), 100)
    fake.scheduler.clearTimer(removed)
    fake.scheduler.setTimer(() => {
      calls.push(fake.scheduler.now())
      fake.scheduler.setTimer(() => calls.push(fake.scheduler.now()), 50)
    }, 100)
    fake.advance(500)
    expect(calls).toEqual([100, 150, 200])
    expect(fake.pendingTimers).toBe(0)
    expect(fake.createdTimers).toBe(4)
    expect(fake.clearedTimers).toBe(1)
    const callback = vi.fn()
    fake.scheduler.requestFrame!(() => fake.scheduler.cancelFrame!(cancelled))
    const cancelled = fake.scheduler.requestFrame!(callback)
    fake.flushFrame()
    expect(callback).not.toHaveBeenCalled()
    expect(fake.cancelledFrames).toBe(1)
    expect(fake.pendingFrames).toBe(0)
  })
  it('supports no RAF environments and rejects nonmonotonic clock advances', () => {
    const fake = createAnimationTestScheduler(false)
    expect(fake.scheduler.requestFrame).toBeUndefined()
    expect(fake.scheduler.cancelFrame).toBeUndefined()
    for (const ms of [-1, NaN, Infinity]) expect(() => fake.advance(ms)).toThrow(RangeError)
    expect(() => fake.scheduler.setTimer(() => {}, -1)).toThrow(RangeError)
  })
})

describe('controller owner task identity foundation', () => {
  it('isolates identical external IDs across owners and keeps same-owner keys stable', () => {
    const a = createAnimationOwner(),
      b = createAnimationOwner()
    const key = { kind: 'series', id: 'same-id', scope: 'enter' } as const
    expect(a(key)).toBe(a({ ...key }))
    expect(a(key)).not.toBe(b(key))
    const tasks = new Map([
      [a(key), 'a'],
      [b(key), 'b'],
    ])
    tasks.delete(a(key))
    expect(tasks.get(b(key))).toBe('b')
  })
  it('separates kind, scope and delimiter-containing IDs', () => {
    const owner = createAnimationOwner()
    const keys = [
      { kind: 'series', id: 'axis:x:enter', scope: 'update' },
      { kind: 'axis', id: 'x:enter', scope: 'update' },
      { kind: 'series', id: 'axis:x:enter', scope: 'enter' },
      { kind: 'series', id: 'axis:x:enter"', scope: 'update' },
    ] as const
    expect(new Set(keys.map(owner)).size).toBe(keys.length)
  })
})
