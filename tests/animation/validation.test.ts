import { describe, expect, it, vi } from 'vitest'
import type { AnimationConfig, AnimationValue } from '@/index'
import { validateAnimationConfig, validateAnimationScheduler } from '@/animation/core/validation'
import { createAnimationTestScheduler } from '@tests/support/animationScheduler'

const invalidConfigs: unknown[] = [
  null,
  [],
  { duration: -1 },
  { duration: NaN },
  { duration: Infinity },
  { duration: '100' },
  { delay: -1 },
  { delay: Infinity },
  { delay: NaN },
  { delay: null },
  ...[0, -1, 1.5, Infinity, NaN, '1', null].map((loop) => ({ loop })),
  { duration: 0, loop: true },
  { direction: 'left-to-right' },
  { direction: null },
  { force: 1 },
  { additive: null },
  { easing: 'toString' },
  { easing: null },
  { tracks: null },
  { tracks: {} },
  { tracks: [null] },
  ...['initialize', 'during', 'done', 'aborted', 'onError'].map((field) => ({ [field]: true })),
  { additive: true, loop: 2 },
  { additive: true, loop: true },
]

describe('animation configuration preflight', () => {
  it('normalizes engine defaults without touching callbacks', () => {
    const initialize = vi.fn()
    const easing = vi.fn(() => 0)
    const config = validateAnimationConfig({ initialize, easing })
    expect(config).toMatchObject({
      duration: 1000,
      delay: 0,
      loop: 1,
      direction: 'normal',
      force: false,
      additive: false,
      tracks: [],
      initialize,
      easing,
    })
    expect(initialize).not.toHaveBeenCalled()
    expect(easing).not.toHaveBeenCalled()
    expect(validateAnimationConfig({}).easing(0.25)).toBe(0.25)
  })
  it.each(invalidConfigs)('rejects invalid configuration %# before side effects', (input) => {
    const done = vi.fn(),
      aborted = vi.fn(),
      initialize = vi.fn(),
      during = vi.fn()
    const config =
      input && !Array.isArray(input)
        ? { done, aborted, initialize, during, ...(input as object) }
        : input
    expect(() => validateAnimationConfig(config as AnimationConfig)).toThrow()
    for (const callback of [done, aborted, initialize, during])
      expect(callback).not.toHaveBeenCalled()
  })
  it('preserves zero/false and accepts all directions and infinite looping with positive duration', () => {
    expect(
      validateAnimationConfig({ duration: 0, delay: 0, loop: false, force: false }),
    ).toMatchObject({
      duration: 0,
      delay: 0,
      loop: 1,
      force: false,
    })
    expect(validateAnimationConfig({ loop: true }).loop).toBe(Infinity)
    for (const direction of ['normal', 'reverse', 'alternate', 'alternate-reverse'] as const) {
      expect(validateAnimationConfig({ direction }).direction).toBe(direction)
    }
  })
  it.each(([1, [], [1, 2], [[1, 2], [3]], [[]]] as AnimationValue[]).map((value) => ({ value })))(
    'copies valid values without changing target or input %#',
    ({ value }) => {
      const target = { value }
      const input = { tracks: [{ target, property: 'value', from: value, to: value }] }
      const result = validateAnimationConfig(input)
      expect(result.tracks[0]).toEqual(input.tracks[0])
      expect(result.tracks[0].target).toBe(target)
      if (Array.isArray(value)) {
        expect(result.tracks[0].from).not.toBe(value)
        expect(result.tracks[0].to).not.toBe(value)
        if (Array.isArray(value[0]))
          expect((result.tracks[0].to as number[][])[0]).not.toBe(value[0])
      }
      expect(target.value).toBe(value)
    },
  )
  it('isolates nested snapshots from subsequent consumer mutations', () => {
    const from = [[1, 2]],
      to = [[3, 4]],
      target = { value: [[0, 0]] }
    const config = validateAnimationConfig({ tracks: [{ target, property: 'value', from, to }] })
    from[0][0] = 9
    to.push([5, 6])
    expect(config.tracks[0].from).toEqual([[1, 2]])
    expect(config.tracks[0].to).toEqual([[3, 4]])
    expect(target.value).toEqual([[0, 0]])
  })
  it.each(
    [
      NaN,
      Infinity,
      'path',
      new Float32Array([1]),
      [1, NaN],
      [[1, Infinity]],
      [1, [2]],
      [[1], 2],
      [[[1]]],
      Array(1),
      [Array(1)],
      null,
    ].map((value) => ({ value })),
  )('rejects unsupported/nonfinite values in current/from/to %#', ({ value }) => {
    for (const field of ['current', 'from', 'to']) {
      const track = {
        target: { value: field === 'current' ? value : 1 },
        property: 'value',
        from: field === 'from' ? value : 1,
        to: field === 'to' ? value : 1,
      }
      expect(() => validateAnimationConfig({ tracks: [track] } as AnimationConfig)).toThrow()
    }
  })
  it.each([
    [1, [1]],
    [[1], [1, 2]],
    [[[1]], [[1, 2]]],
    [[], [[]]],
  ])('rejects shape mismatch %#', (current, to) => {
    expect(() =>
      validateAnimationConfig({
        tracks: [{ target: { value: current }, property: 'value', to }],
      } as AnimationConfig),
    ).toThrow(TypeError)
  })
  it('validates the whole batch without writes, including later invalid tracks', () => {
    const target = Object.freeze({ value: Object.freeze([1, 2]) })
    const callbacks = { initialize: vi.fn(), during: vi.fn(), done: vi.fn(), aborted: vi.fn() }
    expect(() =>
      validateAnimationConfig({
        ...callbacks,
        tracks: [
          { target, property: 'value', to: [3, 4] },
          { target: { value: 1 }, property: 'value', to: NaN },
        ],
      } as AnimationConfig),
    ).toThrow(RangeError)
    expect(target.value).toEqual([1, 2])
    Object.values(callbacks).forEach((callback) => expect(callback).not.toHaveBeenCalled())
  })
  it('rejects duplicate object/property pairs but allows separate targets and properties', () => {
    const a = { x: 1, y: 2 },
      b = { x: 1 }
    const track = { target: a, property: 'x', to: 3 }
    expect(() => validateAnimationConfig({ tracks: [track, { ...track }] })).toThrow(TypeError)
    expect(
      validateAnimationConfig({
        tracks: [track, { target: a, property: 'y', to: 4 }, { target: b, property: 'x', to: 5 }],
      }).tracks,
    ).toHaveLength(3)
    expect(validateAnimationConfig({ tracks: [track] }).tracks[0].from).toBeUndefined()
  })
  it('checks additive derived starts and looping bases before registration', () => {
    const target = { x: 15 }
    const config: AnimationConfig = {
      additive: true,
      tracks: [{ target, property: 'x', from: 18, to: 25 }],
    }
    const context = () => ({ additiveFrom: 18, baseLoop: 1 })
    expect(validateAnimationConfig(config, context).tracks[0].from).toBe(18)
    expect(() => validateAnimationConfig(config)).toThrow(TypeError)
    expect(() =>
      validateAnimationConfig(config, () => ({ additiveFrom: 19, baseLoop: 1 })),
    ).toThrow(TypeError)
    expect(() =>
      validateAnimationConfig(config, () => ({ additiveFrom: [18], baseLoop: 1 })),
    ).toThrow(TypeError)
    expect(() =>
      validateAnimationConfig(config, () => ({ additiveFrom: 18, baseLoop: true })),
    ).toThrow(RangeError)
    expect(target.x).toBe(15)
    expect(
      validateAnimationConfig({
        additive: true,
        loop: false,
        tracks: [{ target, property: 'x', to: 20 }],
      }).tracks[0].from,
    ).toBeUndefined()
  })
})

describe('scheduler injection preflight', () => {
  it.each([true, false])('accepts complete or absent RAF without scheduling (%s)', (raf) => {
    const fake = createAnimationTestScheduler(raf)
    validateAnimationScheduler(fake.scheduler)
    expect(fake.pendingFrames + fake.pendingTimers).toBe(0)
  })
  it('rejects partial RAF and invalid required functions without invoking them', () => {
    const fake = createAnimationTestScheduler()
    for (const field of ['now', 'setTimer', 'clearTimer', 'requestFrame', 'cancelFrame']) {
      expect(() => validateAnimationScheduler({ ...fake.scheduler, [field]: undefined })).toThrow(
        TypeError,
      )
    }
    expect(() =>
      validateAnimationScheduler({ ...fake.scheduler, requestFrame: 1 } as never),
    ).toThrow(TypeError)
    expect(fake.pendingFrames + fake.pendingTimers).toBe(0)
  })
})
