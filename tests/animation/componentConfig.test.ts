import { describe, expect, it, vi } from 'vitest'
import { resolveAnimationProps } from '@/components/animation/config'
import type { WaveformAnimationProps } from '@/index'

describe('chart animation option resolution', () => {
  it('defaults to 200,000 points while preserving explicit consumer thresholds', () => {
    expect(resolveAnimationProps({}).animationThreshold).toBe(200000)
    expect(resolveAnimationProps({ animationThreshold: undefined }).animationThreshold).toBe(200000)
    expect(resolveAnimationProps({ animationThreshold: 50000 }).animationThreshold).toBe(50000)
  })
  it('rejects object-valued effects without coercing them to a valid name', () => {
    const effect = { toString: vi.fn(() => 'fade-in') }
    const warn = vi.fn()
    const resolved = resolveAnimationProps(
      { animationAnnotation: { type: effect } } as unknown as WaveformAnimationProps,
      warn,
    )
    expect(resolved.animationAnnotation).toMatchObject({ type: 'scale', easing: 'backOut' })
    expect(warn).toHaveBeenCalledExactlyOnceWith('Invalid animation configuration: annotation.type')
    expect(effect.toString).not.toHaveBeenCalled()
  })
  it('merges fields while preserving zero and independent false values', () => {
    expect(
      resolveAnimationProps({
        animation: { duration: 0, delay: 0, staggerDelay: 0 },
        animationUpdate: { enabled: false },
        animationThreshold: 0,
      }),
    ).toMatchObject({
      animationEnabled: true,
      animationThreshold: 0,
      animation: {
        enabled: true,
        duration: 0,
        delay: 0,
        staggerDelay: 0,
        direction: 'left-to-right',
        easing: 'cubicInOut',
      },
      animationUpdate: { enabled: false, duration: 300 },
      animationAnnotation: { enabled: true, duration: 300, type: 'scale', easing: 'backOut' },
    })
  })
  it.each([
    ['fade-in', 'cubicOut'],
    ['scale', 'backOut'],
    ['slide-in', 'cubicOut'],
    ['bounce', 'bounceOut'],
  ] as const)('selects %s easing only when not explicitly overridden', (type, easing) => {
    expect(
      resolveAnimationProps({ animationAnnotation: { type } }).animationAnnotation.easing,
    ).toBe(easing)
    expect(
      resolveAnimationProps({ animationAnnotation: { type, easing: 'linear' } }).animationAnnotation
        .easing,
    ).toBe('linear')
  })
  it('falls back each invalid field and retains unrelated valid settings', () => {
    const warn = vi.fn()
    const resolved = resolveAnimationProps(
      {
        animationEnabled: 'yes',
        animationThreshold: Infinity,
        animation: {
          enabled: 1,
          duration: -1,
          delay: NaN,
          staggerDelay: -5,
          direction: 'up',
          easing: 'invalid',
          onComplete: 1,
        },
        animationUpdate: { duration: 25 },
        animationAnnotation: { type: 'invalid' },
      } as unknown as WaveformAnimationProps,
      warn,
    )
    expect(resolved.animationUpdate.duration).toBe(25)
    expect(resolved.animation).toMatchObject({
      enabled: true,
      duration: 1000,
      delay: 0,
      staggerDelay: 100,
      direction: 'left-to-right',
      easing: 'cubicInOut',
    })
    expect(resolved.animationAnnotation.type).toBe('scale')
    expect(resolved.animationThreshold).toBe(200000)
    expect(warn).toHaveBeenCalledTimes(10)
  })
  it('accepts custom easing and snapshots the callbacks supplied', () => {
    const easing = (p: number) => p
    const done = vi.fn()
    const abort = vi.fn()
    const value = resolveAnimationProps({ animation: { easing, onComplete: done, onAbort: abort } })
    expect(value.animation.easing).toBe(easing)
    expect(value.animation.onComplete).toBe(done)
    expect(value.animation.onAbort).toBe(abort)
  })
})
