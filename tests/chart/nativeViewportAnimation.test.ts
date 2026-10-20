// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { init, formatEndpointTime, type WaveformChartOptions } from '@/index'
import * as esm from 'waveform-analysis'
import { flushAnimationFrames } from '../support/setup'

const cjs = createRequire(import.meta.url)('waveform-analysis') as {
  init: typeof init
  formatEndpointTime: typeof formatEndpointTime
}
const cleanup: (() => void)[] = []
const points = [
  { x: 0, y: 1 },
  { x: 5, y: 2 },
  { x: 10, y: 1 },
]
let now = 0
async function tick(ms = 32) {
  const end = now + ms
  do {
    for (let i = 0; i < 4; i++) {
      flushAnimationFrames(now)
      await Promise.resolve()
    }
    if (now === end) break
    const step = Math.min(16, end - now)
    now += step
    await vi.advanceTimersByTimeAsync(step)
  } while (now <= end)
}

function setup(factory = init, options: WaveformChartOptions = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  const chart = factory(
    host,
    {
      data: {
        kind: 'series',
        series: [{ id: 'IP', name: 'IP', data: { kind: 'points', points } }],
      },
      width: 800,
      height: 500,
      timeUnit: 's',
      initialXDomain: [0, 10],
      grid: { rowCount: 1, columnCount: 1 },
      toolbar: false,
      rendering: { sampling: { mode: 'raw' } },
      animation: { duration: 400, staggerDelay: 0 },
      animationUpdate: { animateViewport: true, duration: 400, easing: 'linear' },
      ...options,
    },
    { autoResize: false },
  )
  cleanup.push(() => {
    chart.dispose()
    host.remove()
  })
  const line = () => host.querySelector('.waveform-chart__line')?.getAttribute('d')
  return { host, chart, line }
}

beforeEach(() => {
  now = 0
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 800,
    height: 500,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 800,
    bottom: 500,
    toJSON() {},
  })
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (
    this: HTMLElement,
  ) {
    return [this.getBoundingClientRect()] as unknown as DOMRectList
  })
  vi.spyOn(window, 'matchMedia').mockImplementation(() => ({
    matches: false,
    media: '',
    onchange: null,
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return true
    },
    addEventListener() {},
    removeEventListener() {},
  }))
})
afterEach(() => {
  cleanup
    .splice(0)
    .reverse()
    .forEach((dispose) => dispose())
  vi.useRealTimers()
  vi.restoreAllMocks()
})

for (const [format, factory] of [
  ['source', init],
  ['ESM', esm.init],
  ['CJS', cjs.init],
] as const) {
  describe(`published ${format} viewport animation`, () => {
    it.each([
      [1.23451, '1.2346'],
      [-1.23451, '-1.2345'],
      [0.00001, '0.0001'],
      [-0.00001, '0'],
      [9.99999, '10'],
      [1.2345, '1.2345'],
      [0, '0'],
    ] as const)('formats endpoint %s without requiring BigInt', (value, expected) => {
      vi.spyOn(globalThis, 'BigInt').mockImplementation(() => {
        throw new Error('BigInt unavailable')
      })
      const formatter =
        format === 'source'
          ? formatEndpointTime
          : format === 'ESM'
            ? esm.formatEndpointTime
            : cjs.formatEndpointTime
      expect(formatter(value, [-20, 20], 's')).toBe(expected)
    })

    it('retargets a running zoom from its visible geometry while the query domain is final', async () => {
      const { chart, line } = setup(factory)
      await tick(500)
      const original = line()
      expect(original).toBeTruthy()
      chart.setViewportDomain([0, 5])
      await tick(160)
      const midway = line()
      expect(midway).not.toBe(original)
      expect(chart.getControlState().targets[0].viewport.xDomain).toEqual([0, 5])
      chart.setViewportDomain([0, 2])
      // Flushing a new target must begin from the current presentation, not the old final domain.
      await tick(16)
      const retargeted = line()
      const middleX = (path: string | null | undefined) => Number(path!.match(/L([\d.]+)/)![1])
      expect(middleX(retargeted)).toBeGreaterThanOrEqual(middleX(midway))
      // One frame may advance, but it must not jump to the preceding zoom's endpoint.
      expect(middleX(retargeted)).toBeLessThan(middleX(original) * 2)
      await tick(500)
      expect(line()).not.toBe(midway)
      expect(chart.getControlState().targets[0].viewport.xDomain).toEqual([0, 2])
      expect(points).toEqual([
        { x: 0, y: 1 },
        { x: 5, y: 2 },
        { x: 10, y: 1 },
      ])
    })

    it('animates commands, preserves hover, and stabilizes on a mode change', async () => {
      const { chart, host, line } = setup(factory)
      await tick(500)
      const finished = vi.fn()
      chart.on('finished', finished)
      chart.dispatchAction({ type: 'set-domain', domain: [0, 5] })
      await tick(160)
      const midway = line()
      host.querySelector('.waveform-chart__overlay')!.dispatchEvent(
        new MouseEvent('pointermove', {
          bubbles: true,
          buttons: 0,
          clientX: 200,
          clientY: 100,
        }),
      )
      await tick(16)
      expect(finished).not.toHaveBeenCalled()
      chart.setInteractionMode('none')
      await tick(32)
      const final = line()
      expect(final).not.toBe(midway)
      await tick(500)
      expect(line()).toBe(final)
      expect(finished).toHaveBeenCalled()
    })

    it('keeps the entrance clip active during pointer hover', async () => {
      const { host } = setup(factory)
      await tick(100)
      const clip = () => host.querySelector('.waveform-chart__series')?.getAttribute('clip-path')
      const entering = clip()
      expect(entering).toBeTruthy()
      const overlay = host.querySelector('.waveform-chart__overlay')!
      overlay.dispatchEvent(
        new MouseEvent('pointermove', { bubbles: true, buttons: 0, clientX: 100, clientY: 100 }),
      )
      await tick(16)
      expect(clip()).toBe(entering)
      await tick(500)
      expect(clip()).toBeNull()
    })

    it('leaves viewport changes immediate when the option is off', async () => {
      const { chart, line } = setup(factory, { animationUpdate: { duration: 400 } })
      await tick(500)
      chart.setViewportDomain([0, 5])
      await tick()
      const target = line()
      await tick(500)
      expect(line()).toBe(target)
    })

    it('retargets wheel zoom without snapping the running viewport animation', async () => {
      const { chart, host, line } = setup(factory)
      await tick(500)
      const original = line()
      chart.setViewportDomain([0, 5])
      await tick(160)
      const overlay = host.querySelector('.waveform-chart__overlay')!
      overlay.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaY: -100,
          clientX: 200,
        }),
      )
      await tick(32)
      const middleX = (path: string | null | undefined) => Number(path!.match(/L([\d.]+)/)![1])
      expect(middleX(line())).toBeLessThan(middleX(original) * 2)
      await tick(500)
      const domain = chart.getControlState().targets[0].viewport.xDomain
      expect(domain[1] - domain[0]).toBeLessThan(5)
    })

    it.each(['threshold', 'reduced-motion'] as const)(
      'respects the %s animation safeguard',
      async (reason) => {
        if (reason === 'reduced-motion')
          vi.spyOn(window, 'matchMedia').mockImplementation(() => ({
            matches: true,
            media: '',
            onchange: null,
            addListener() {},
            removeListener() {},
            dispatchEvent() {
              return true
            },
            addEventListener() {},
            removeEventListener() {},
          }))
        const { chart, host, line } = setup(
          factory,
          reason === 'threshold' ? { animationThreshold: 3 } : {},
        )
        await tick(32)
        expect(host.querySelector('.waveform-chart__series')?.getAttribute('clip-path')).toBeNull()
        chart.setViewportDomain([0, 5])
        await tick(32)
        const target = line()
        await tick(500)
        expect(line()).toBe(target)
      },
    )

    it('preserves exact millisecond endpoints under minimum-point constraints', async () => {
      const { chart } = setup(factory, {
        data: {
          kind: 'series',
          series: [
            {
              id: 'IP',
              name: 'IP',
              data: { kind: 'points', points: [0, 0.025, 0.075, 0.1].map((x) => ({ x, y: 1 })) },
            },
          ],
        },
        timeUnit: 'ms',
        integerZoom: true,
        minVisiblePoints: 2,
        initialXDomain: [0.01, 0.09],
        panXDomain: [0.01, 0.09],
        animationEnabled: false,
      })
      await tick()
      chart.setViewportDomain([0.025, 0.075])
      expect(chart.getControlState().targets[0].viewport.xDomain).toEqual([0.025, 0.075])
    })
  })
}
