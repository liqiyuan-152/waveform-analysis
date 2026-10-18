import { describe, expect, it } from 'vitest'
import { OptionManager } from '../../../src/display/model/OptionManager'
import type { WaveformOptions } from '../../../src/display/types/options'

describe('animation configuration', () => {
  it('defaults off with independent enabled categories', () => {
    const options = new OptionManager().resolved
    expect(options.animationEnabled).toBe(false)
    expect(options.animationThreshold).toBe(10000)
    expect(options.animation).toMatchObject({
      enabled: true,
      duration: 1000,
      delay: 0,
      staggerDelay: 100,
      direction: 'left-to-right',
      easing: 'cubicInOut',
    })
    expect(options.animationUpdate).toMatchObject({ enabled: true, duration: 300 })
  })

  it('merges fields and clears explicit overrides without freezing defaults', () => {
    const manager = new OptionManager({ animation: { duration: 40, delay: 20 } })
    manager.update({ animation: { duration: undefined } })
    expect(manager.resolved.animation).toMatchObject({ duration: 1000, delay: 20 })
    manager.update({ animation: undefined })
    expect(manager.resolved.animation.delay).toBe(0)
  })

  it.each([
    { animationThreshold: -1 },
    { animationThreshold: 1.5 },
    { animationThreshold: Infinity },
    { animation: { duration: NaN } },
    { animation: { delay: -1 } },
    { animation: { staggerDelay: Infinity } },
    { animation: { direction: 'up' } },
    { animationUpdate: { easing: 'unknown' } },
    { animationUpdate: { onComplete: 2 } },
    { animationEnabled: 1 },
  ])('rejects invalid configuration atomically: %j', (patch) => {
    const manager = new OptionManager({ animation: { duration: 20 } })
    const before = manager.getOptions()
    expect(() => manager.update(patch as WaveformOptions)).toThrow(/animation/i)
    expect(manager.getOptions()).toEqual(before)
  })

  it('does not execute easing or lifecycle callbacks during validation', () => {
    const callback = () => {
      throw new Error('must not run')
    }
    expect(
      () => new OptionManager({ animation: { easing: callback, onComplete: callback } }),
    ).not.toThrow()
  })
})
