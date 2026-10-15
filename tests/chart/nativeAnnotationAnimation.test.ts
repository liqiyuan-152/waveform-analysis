import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { init } from '@/chart/init'
import type { WaveformChartInstance } from '@/types/native'
import type { WaveformChartOptions } from '@/types/options'
import type { WaveformAnnotation } from '@/types/chart'
import { flushAnimationFrames, pendingAnimationFrameCount } from '../support/setup'

let now = 0
const charts: WaveformChartInstance[] = []
beforeEach(() => {
  now = 0
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
})
afterEach(() => {
  charts.splice(0).forEach((chart) => chart.dispose())
  vi.restoreAllMocks()
  vi.useRealTimers()
})
const note: WaveformAnnotation = { id: 'note', seriesId: 'a', x: 1, y: 1, text: '标注' }
function create(options: WaveformChartOptions = {}) {
  const host = document.createElement('div')
  const chart = init(
    host,
    {
      width: 800,
      height: 400,
      data: {
        kind: 'series',
        series: [
          {
            id: 'a',
            name: 'A',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
            },
          },
        ],
      },
      animation: { duration: 0 },
      animationAnnotation: { duration: 1000, easing: 'linear', type: 'scale' },
      rendering: { sampling: { mode: 'raw' } },
      annotations: [note],
      ...options,
    },
    { autoResize: false },
  )
  charts.push(chart)
  return { chart, host }
}
async function frame(ms = 0) {
  now += ms
  await vi.advanceTimersByTimeAsync(ms)
  for (let i = 0; i < 4; i++) {
    flushAnimationFrames(now)
    await Promise.resolve()
  }
}
const node = (host: HTMLElement) => host.querySelector<SVGGElement>('.waveform-annotation')
const opacity = (host: HTMLElement) => Number(node(host)?.getAttribute('opacity'))

describe('native annotation animation integration', () => {
  it('stops annotation batches when the first synchronous completion disposes the instance', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const complete = vi.fn(() => chart.dispose())
    const { chart, host } = create({
      annotations: [note, { ...note, id: 'second', x: 0, y: 0 }],
      animationAnnotation: { duration: 0, onComplete: complete },
    })
    await frame()
    expect(chart.isDisposed()).toBe(true)
    expect(complete).toHaveBeenCalledOnce()
    expect(error).not.toHaveBeenCalled()
    expect(host.childElementCount).toBe(0)
    expect(pendingAnimationFrameCount()).toBe(0)
  })

  it.each(['fade-in', 'scale', 'bounce', 'slide-in'] as const)(
    'projects the %s preset into opacity and label transform',
    async (type) => {
      const { host } = create({ animationAnnotation: { type, duration: 1000, easing: 'linear' } })
      await frame()
      expect(opacity(host)).toBe(0)
      await frame(500)
      expect(opacity(host)).toBeCloseTo(0.5)
      const transform = node(host)?.querySelector('g')?.getAttribute('transform')
      expect(transform).toContain(`scale(${type === 'scale' || type === 'bounce' ? 0.5 : 1})`)
      await frame(500)
      expect(opacity(host)).toBe(1)
      expect(pendingAnimationFrameCount()).toBe(0)
    },
  )

  it('draws appearance and departing snapshots before one finished event per revision', async () => {
    const { chart, host } = create()
    const finished = vi.fn(),
      rendered = vi.fn()
    chart.on('finished', finished)
    chart.on('rendered', rendered)
    await frame()
    expect(opacity(host)).toBe(0)
    expect(finished).not.toHaveBeenCalled()
    await frame(500)
    expect(opacity(host)).toBeCloseTo(0.5)
    expect(finished).not.toHaveBeenCalled()
    await frame(500)
    expect(opacity(host)).toBe(1)
    expect(finished).toHaveBeenCalledOnce()
    expect(new Set(rendered.mock.calls.map(([payload]) => payload.revision)).size).toBe(1)
    const original = node(host)
    chart.setOption({ annotations: [] })
    await frame()
    expect(node(host)).toBe(original)
    expect(node(host)?.getAttribute('data-leaving')).toBe('true')
    expect(node(host)?.style.pointerEvents).toBe('none')
    await frame(500)
    expect(opacity(host)).toBeCloseTo(0.5)
    expect(finished).toHaveBeenCalledOnce()
    await frame(500)
    expect(node(host)).toBeNull()
    expect(finished).toHaveBeenCalledTimes(2)
    expect(pendingAnimationFrameCount()).toBe(0)
  })

  it('waits for series entrance before annotation appearance', async () => {
    const { chart, host } = create({ animation: { duration: 1000, easing: 'linear' } })
    const finished = vi.fn()
    chart.on('finished', finished)
    await frame()
    await frame(500)
    expect(opacity(host)).toBe(0)
    await frame(500)
    expect(opacity(host)).toBe(0)
    expect(finished).not.toHaveBeenCalled()
    await frame(500)
    expect(opacity(host)).toBeCloseTo(0.5)
    await frame(500)
    expect(opacity(host)).toBe(1)
    expect(finished).toHaveBeenCalledOnce()
  })

  it('restores a removed annotation during leave without replacing its SVG node', async () => {
    const { chart, host } = create()
    await frame()
    await frame(1000)
    const original = node(host)
    chart.setOption({ annotations: [] })
    await frame()
    await frame(500)
    chart.setOption({ annotations: [{ ...note, text: '恢复' }] })
    await frame()
    expect(node(host)).toBe(original)
    expect(node(host)?.getAttribute('data-leaving')).toBe('false')
    await frame(1000)
    expect(opacity(host)).toBe(1)
    expect(node(host)?.textContent).toContain('恢复')
    expect(pendingAnimationFrameCount()).toBe(0)
  })

  it.each([{ annotationsVisible: false }, { cleanView: true }, { hiddenSeriesIds: ['a'] }])(
    'removes hidden annotations immediately for %j',
    async (options) => {
      const { chart, host } = create()
      await frame()
      await frame(250)
      chart.setOption(options)
      await frame()
      expect(node(host)).toBeNull()
      await frame(1500)
      expect(node(host)).toBeNull()
      expect(pendingAnimationFrameCount()).toBe(0)
    },
  )

  it('finishes disabled annotation animation and isolates disposal between instances', async () => {
    const a = create(),
      b = create()
    await frame()
    await frame(250)
    a.chart.setOption({ animationAnnotation: { enabled: false } })
    await frame()
    expect(opacity(a.host)).toBe(1)
    expect(opacity(b.host)).toBeCloseTo(0.25)
    a.chart.dispose()
    await frame(750)
    expect(opacity(b.host)).toBe(1)
    expect(a.host.childElementCount).toBe(0)
    expect(pendingAnimationFrameCount()).toBe(0)
  })
})
