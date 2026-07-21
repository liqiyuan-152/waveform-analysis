import { describe, expect, it, vi } from 'vitest'

import { useAnimationFrameThrottle } from './useAnimationFrameThrottle'

describe('useAnimationFrameThrottle', () => {
  it('schedules callback on next animation frame', () => {
    const throttle = useAnimationFrameThrottle()
    const callback = vi.fn()

    throttle.schedule(callback)
    expect(throttle.isPending()).toBe(true)
    expect(callback).not.toHaveBeenCalled()
  })

  it('replaces pending callback when scheduled multiple times', () => {
    const throttle = useAnimationFrameThrottle()
    const callback1 = vi.fn()
    const callback2 = vi.fn()

    throttle.schedule(callback1)
    throttle.schedule(callback2)
    expect(throttle.isPending()).toBe(true)
  })

  it('cancels pending callback', () => {
    const throttle = useAnimationFrameThrottle()
    const callback = vi.fn()

    throttle.schedule(callback)
    throttle.cancel()
    expect(throttle.isPending()).toBe(false)
  })

  it('flushes callback immediately', () => {
    const throttle = useAnimationFrameThrottle()
    const callback = vi.fn(() => 'result')

    throttle.schedule(callback)
    throttle.flush()
    expect(callback).toHaveBeenCalled()
    expect(throttle.isPending()).toBe(false)
  })

  it('handles flush when no callback is pending', () => {
    const throttle = useAnimationFrameThrottle()
    expect(() => throttle.flush()).not.toThrow()
  })

  it('handles cancel when no callback is pending', () => {
    const throttle = useAnimationFrameThrottle()
    expect(() => throttle.cancel()).not.toThrow()
  })
})
