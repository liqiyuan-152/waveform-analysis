import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { init } from '@/chart/init'
import type { WaveformChartInstance, WaveformChartAction } from '@/types/native'
import type { WaveformChartOptions } from '@/types/options'
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
const data = (y = 1) => ({
  kind: 'points' as const,
  points: [
    { x: 0, y: 0 },
    { x: 1, y },
  ],
})
function create(options: WaveformChartOptions = {}) {
  const host = document.createElement('div')
  const chart = init(
    host,
    {
      width: 800,
      height: 400,
      data: data(),
      animation: { duration: 1000, easing: 'linear' },
      animationUpdate: { duration: 1000, easing: 'linear' },
      rendering: { sampling: { mode: 'raw' } },
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
function width(host: HTMLElement) {
  return Number(host.querySelector('.waveform-chart__series clipPath rect')?.getAttribute('width'))
}

describe('native animation scheduling', () => {
  it('applies replacement formatters to endpoints and ticks during entrance', async () => {
    const { chart, host } = create()
    await frame()
    expect(width(host)).toBe(0)
    chart.setOption({ axes: { x: { labelFormatter: (value) => `first:${value}` } } })
    await frame()
    expect(host.querySelector('.waveform-chart__axis-endpoint--start')?.textContent).toMatch(
      /^first:/,
    )
    chart.setOption({ axes: { x: { labelFormatter: (value) => `next:${value}` } } })
    await frame()
    expect(host.querySelector('.waveform-chart__axis-endpoint--start')?.textContent).toMatch(
      /^next:/,
    )
    expect(host.querySelector('.waveform-chart__axis--x .tick text')?.textContent).toMatch(/^next:/)
  })

  it('renders entrance frames on one business revision and emits finished only after final drawing', async () => {
    const { chart, host } = create()
    const rendered = vi.fn(),
      finished = vi.fn()
    chart.on('rendered', rendered)
    chart.on('finished', finished)
    await frame()
    expect(width(host)).toBe(0)
    expect(finished).not.toHaveBeenCalled()
    await frame(500)
    const trackWidth = Number(
      host.querySelector('[data-track-width]')?.getAttribute('data-track-width'),
    )
    expect(width(host)).toBeCloseTo(trackWidth / 2)
    expect(finished).not.toHaveBeenCalled()
    await frame(500)
    expect(host.querySelector('.waveform-chart__series clipPath')).toBeNull()
    expect(finished).toHaveBeenCalledOnce()
    expect(new Set(rendered.mock.calls.map(([payload]) => payload.revision)).size).toBe(1)
    expect(pendingAnimationFrameCount()).toBe(0)
  })

  it('waits for data update animation before SVG export and keeps its latest revision', async () => {
    const { chart, host } = create({ animation: { duration: 0 }, yDomain: [-1, 3] })
    await frame()
    const previous = host.querySelector('.waveform-chart__line')?.getAttribute('d')
    chart.setOption({ data: data(2) })
    await frame()
    const exporting = chart.exportImage({ format: 'svg' })
    let resolved = false
    void exporting.then(() => {
      resolved = true
    })
    await frame(500)
    expect(resolved).toBe(false)
    await frame(500)
    await vi.advanceTimersByTimeAsync(16)
    await expect(exporting).resolves.toBeInstanceOf(Blob)
    expect(host.querySelector('.waveform-chart__line')?.getAttribute('d')).not.toBe(previous)
    expect(pendingAnimationFrameCount()).toBe(0)
  })

  it('rejects an export superseded during animation and retries after the latest draw', async () => {
    const { chart } = create({ animation: { duration: 0 }, yDomain: [-1, 4] })
    await frame()
    chart.setOption({ data: data(2) })
    await frame()
    const exporting = chart.exportImage({ format: 'svg' })
    const assertion = expect(exporting).rejects.toMatchObject({ code: 'export-stale' })
    await frame(500)
    chart.setOption({ data: data(3) })
    await assertion
    await frame()
    await frame(1000)
    await expect(chart.exportImage({ format: 'svg' })).resolves.toBeInstanceOf(Blob)
    expect(pendingAnimationFrameCount()).toBe(0)
  })

  it('disables active entrance statically and cancels only the disposed instance', async () => {
    const a = create(),
      b = create()
    await frame(250)
    a.chart.setOption({ animation: { enabled: false } })
    await frame()
    expect(a.host.querySelector('.waveform-chart__series clipPath')).toBeNull()
    expect(b.host.querySelector('.waveform-chart__series clipPath')).not.toBeNull()
    a.chart.dispose()
    await frame(1000)
    expect(b.host.querySelector('.waveform-chart__series clipPath')).toBeNull()
    expect(pendingAnimationFrameCount()).toBe(0)
  })

  it('replays pagination entrance for 500ms and preserves the two-argument page event', async () => {
    const { chart, host } = create({
      grid: { rowCount: 1, columnCount: 1 },
      data: { kind: 'series', series: ['a', 'b'].map((id) => ({ id, name: id, data: data() })) },
    })
    const pageChanged = vi.fn(),
      finished = vi.fn()
    chart.on('page-change', pageChanged)
    await frame()
    await frame(1000)
    chart.on('finished', finished)
    host.querySelector<HTMLButtonElement>('[aria-label="下一页"]')!.click()
    expect(pageChanged).toHaveBeenCalledWith(2, 2)
    await frame()
    expect(width(host)).toBe(0)
    await frame(250)
    const trackWidth = Number(
      host.querySelector('[data-track-width]')?.getAttribute('data-track-width'),
    )
    expect(width(host)).toBeCloseTo(trackWidth / 2)
    expect(finished).not.toHaveBeenCalled()
    await frame(250)
    expect(host.querySelector('.waveform-chart__series clipPath')).toBeNull()
    expect(finished).toHaveBeenCalledOnce()
    expect(pendingAnimationFrameCount()).toBe(0)
  })

  it('pauses on document visibility and resumes without including hidden time', async () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    const { chart, host } = create()
    const finished = vi.fn()
    chart.on('finished', finished)
    await frame()
    await frame(250)
    const before = width(host)
    hidden.mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    await frame(1000)
    expect(width(host)).toBe(before)
    expect(finished).not.toHaveBeenCalled()
    hidden.mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))
    await frame(750)
    expect(finished).toHaveBeenCalledOnce()
    expect(host.querySelector('.waveform-chart__series clipPath')).toBeNull()
  })

  it('stops drawing and starting subsequent series when a synchronous completion disposes the chart', async () => {
    const rendered = vi.fn()
    let renderedAtDispose = 0
    const complete = vi.fn(() => {
      renderedAtDispose = rendered.mock.calls.length
      chart.dispose()
    })
    const { chart, host } = create({
      animation: { duration: 0, onComplete: complete },
      data: { kind: 'series', series: ['a', 'b'].map((id) => ({ id, name: id, data: data() })) },
    })
    chart.on('rendered', rendered)
    await frame()
    expect(chart.isDisposed()).toBe(true)
    expect(complete).toHaveBeenCalledOnce()
    expect(host.childElementCount).toBe(0)
    expect(rendered).toHaveBeenCalledTimes(renderedAtDispose)
    expect(pendingAnimationFrameCount()).toBe(0)
  })

  it('cancels consecutive updates and draws only the latest data before finishing', async () => {
    const abort = vi.fn(),
      complete = vi.fn()
    const { chart, host } = create({
      animation: { duration: 0 },
      yDomain: [-1, 5],
      animationUpdate: { duration: 1000, easing: 'linear', onAbort: abort, onComplete: complete },
    })
    await frame()
    const finished = vi.fn()
    chart.on('finished', finished)
    chart.setOption({ data: data(2) })
    await frame()
    await frame(250)
    chart.setOption({ data: data(3) })
    await frame()
    await frame(250)
    chart.setOption({ data: data(4) })
    await frame()
    await frame(1000)
    expect(abort).toHaveBeenCalledTimes(2)
    expect(complete).toHaveBeenCalledOnce()
    expect(finished).toHaveBeenCalledOnce()
    const expected = create({ data: data(4), yDomain: [-1, 5], animationEnabled: false })
    await frame()
    expect(host.querySelector('.waveform-chart__line')?.getAttribute('d')).toBe(
      expected.host.querySelector('.waveform-chart__line')?.getAttribute('d'),
    )
    expect(pendingAnimationFrameCount()).toBe(0)
  })

  it('stops the old entrance batch when a completion replaces the data', async () => {
    const complete = vi.fn(() => {
      if (complete.mock.calls.length === 1)
        chart.setOption({
          data: { kind: 'series', series: [{ id: 'latest', name: 'Latest', data: data(4) }] },
        })
    })
    const { chart, host } = create({
      animation: { duration: 0, onComplete: complete },
      data: { kind: 'series', series: ['a', 'b'].map((id) => ({ id, name: id, data: data() })) },
    })
    await frame()
    await frame(1000)
    expect(complete).toHaveBeenCalledTimes(2)
    expect(host.querySelectorAll('.waveform-chart__series')).toHaveLength(1)
    expect(host.querySelector('.waveform-chart__series')?.getAttribute('data-series-id')).toBe(
      'latest',
    )
    expect(pendingAnimationFrameCount()).toBe(0)
  })

  it('stops remaining update completion callbacks when the first one disposes the chart', async () => {
    const complete = vi.fn(() => chart.dispose())
    const series = (y: number) => ({
      kind: 'series' as const,
      series: ['a', 'b'].map((id) => ({ id, name: id, trackId: 'shared', data: data(y) })),
    })
    const { chart, host } = create({
      animation: { duration: 0 },
      data: series(1),
      animationUpdate: { duration: 1000, onComplete: complete },
    })
    await frame()
    chart.setOption({ data: series(2) })
    await frame()
    await frame(1000)
    expect(complete).toHaveBeenCalledOnce()
    expect(chart.isDisposed()).toBe(true)
    expect(host.childElementCount).toBe(0)
    expect(pendingAnimationFrameCount()).toBe(0)
  })

  it('stops remaining update abort callbacks when the first one disposes the chart', async () => {
    const abort = vi.fn(() => chart.dispose())
    const series = (y: number) => ({
      kind: 'series' as const,
      series: ['a', 'b'].map((id) => ({ id, name: id, trackId: 'shared', data: data(y) })),
    })
    const { chart, host } = create({
      animation: { duration: 0 },
      data: series(1),
      animationUpdate: { duration: 1000, onAbort: abort },
    })
    await frame()
    chart.setOption({ data: series(2) })
    await frame()
    await frame(250)
    chart.setOption({ data: series(3) })
    await frame()
    expect(abort).toHaveBeenCalledOnce()
    expect(chart.isDisposed()).toBe(true)
    expect(host.childElementCount).toBe(0)
    expect(pendingAnimationFrameCount()).toBe(0)
  })

  it.each([
    { animationEnabled: false },
    { animationThreshold: 0 },
    { animationThreshold: 2 },
    { animation: { enabled: false } },
  ])('commits static geometry for disabled policy %j', async (options) => {
    const { chart, host } = create(options)
    const finished = vi.fn()
    chart.on('finished', finished)
    await frame()
    expect(host.querySelector('.waveform-chart__series clipPath')).toBeNull()
    expect(host.querySelector('.waveform-chart__line')?.getAttribute('d')).toBeTruthy()
    expect(finished).toHaveBeenCalledOnce()
    expect(pendingAnimationFrameCount()).toBe(0)
  })

  it.each(['left-to-right', 'right-to-left', 'center-out'] as const)(
    'preserves entrance direction %s',
    async (direction) => {
      const { host } = create({ animation: { duration: 1000, easing: 'linear', direction } })
      await frame()
      await frame(500)
      const trackWidth = Number(
        host.querySelector('[data-track-width]')?.getAttribute('data-track-width'),
      )
      const rect = host.querySelector('.waveform-chart__series clipPath rect')!
      expect(Number(rect.getAttribute('width'))).toBeCloseTo(trackWidth / 2)
      expect(Number(rect.getAttribute('x'))).toBeCloseTo(
        direction === 'right-to-left'
          ? trackWidth / 2
          : direction === 'center-out'
            ? trackWidth / 4
            : 0,
      )
    },
  )

  it('preserves enter delay and series stagger independently', async () => {
    const { host } = create({
      animation: { duration: 1000, easing: 'linear', delay: 100, staggerDelay: 200 },
      data: { kind: 'series', series: ['a', 'b'].map((id) => ({ id, name: id, data: data() })) },
    })
    await frame()
    const rects = () => [...host.querySelectorAll('.waveform-chart__series defs rect')]
    expect(rects().map((rect) => Number(rect.getAttribute('width')))).toEqual([0, 0])
    await frame(500)
    const trackWidth = Number(
      host.querySelector('[data-track-width]')?.getAttribute('data-track-width'),
    )
    expect(Number(rects()[0].getAttribute('width'))).toBeCloseTo(trackWidth * 0.4)
    expect(Number(rects()[1].getAttribute('width'))).toBeCloseTo(trackWidth * 0.2)
    await frame(800)
    expect(rects()).toHaveLength(0)
    expect(pendingAnimationFrameCount()).toBe(0)
  })

  it('rejects malformed actions before stabilizing an active animation', async () => {
    const complete = vi.fn()
    const { chart, host } = create({
      animation: { duration: 1000, easing: 'linear', onComplete: complete },
    })
    await frame()
    expect(() => chart.dispatchAction({ type: 'bad' } as unknown as WaveformChartAction)).toThrow(
      expect.objectContaining({ code: 'invalid-option', field: 'action.type' }),
    )
    expect(complete).not.toHaveBeenCalled()
    await frame(500)
    expect(host.querySelector('.waveform-chart__series defs rect')).not.toBeNull()
    await frame(500)
    expect(complete).toHaveBeenCalledOnce()
  })
})
