// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Waveform } from '../../../src/display/index'

const charts: Waveform[] = []
const data = [
  { id: 'a', data: [{ x: 0, y: 1 }] },
  { id: 'b', data: [{ x: 1, y: 2 }] },
]
function create() {
  const host = document.createElement('div')
  const chart = new Waveform(host, data, { responsive: { enabled: false } })
  charts.push(chart)
  return { chart, host }
}
afterEach(() => {
  charts.splice(0).forEach((chart) => chart.destroy())
  vi.unstubAllGlobals()
})

describe('business events and actions', () => {
  it('coalesces layout, honors subscriptions and callback replacement with ordered dispatch', async () => {
    const { chart } = create()
    const calls: string[] = []
    const remove = chart.on('layoutChange', () => calls.push('cancelled'))
    chart.on('layoutChange', () => calls.push('event'))
    remove()
    remove()
    chart.updateOptions({ onLayoutChange: () => calls.push('legacy') })
    await Promise.resolve()
    expect(calls).toEqual(['legacy', 'event'])
    chart.updateOptions({ onLayoutChange: () => calls.push('replacement') })
    await Promise.resolve()
    expect(calls).toEqual(['legacy', 'event', 'replacement', 'event'])
  })

  it('uses dispatch snapshots, skips cancelled listeners and allows updates after drawing', () => {
    const { chart } = create()
    const calls: string[] = []
    let remove = () => {}
    chart.on('seriesVisibilityChange', () => {
      calls.push('first')
      remove()
      chart.on('seriesVisibilityChange', () => calls.push('new'))
      chart.updateOptions({ title: { text: 'updated' } })
    })
    remove = chart.on('seriesVisibilityChange', () => calls.push('cancelled'))
    chart.dispatchAction({ type: 'toggleSeries', seriesId: 'a' })
    expect(calls).toEqual(['first'])
    expect(chart.getOptions().title?.text).toBe('updated')
    chart.dispatchAction({ type: 'toggleSeries', seriesId: 'b' })
    expect(calls).toEqual(['first', 'first', 'new'])
  })

  it('emits matching events for API, mouse and keyboard with final state', () => {
    const { chart, host } = create()
    const listener = vi.fn()
    chart.on('seriesVisibilityChange', listener)
    chart.dispatchAction({ type: 'toggleSeries', seriesId: 'a' })
    expect(listener).toHaveBeenLastCalledWith({
      seriesKey: 'id:a:0',
      seriesId: 'a',
      seriesIndex: 0,
      visible: false,
    })
    host.querySelector('.waveform-legend-item')!.dispatchEvent(new MouseEvent('click'))
    expect(listener.mock.lastCall![0].visible).toBe(true)
    host
      .querySelector('.waveform-legend-item')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(listener.mock.lastCall![0].visible).toBe(false)
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('rejects ambiguous actions without mutation and emits identities for missing IDs', () => {
    const { chart, host } = create()
    chart.updateData([
      { data: data[0].data },
      { id: 'same', data: data[0].data },
      { id: 'same', data: data[0].data },
    ])
    const before = chart.toSVGString()
    expect(() => chart.dispatchAction({ type: 'toggleSeries', seriesId: 'same' })).toThrow('unique')
    expect(() => chart.dispatchAction({ type: 'toggleSeries', seriesId: 'unknown' })).toThrow(
      'unique',
    )
    expect(chart.toSVGString()).toBe(before)
    const listener = vi.fn()
    chart.on('seriesVisibilityChange', listener)
    host.querySelector('.waveform-legend-item')!.dispatchEvent(new MouseEvent('click'))
    expect(listener.mock.lastCall![0]).toMatchObject({
      seriesKey: 'index:0',
      seriesIndex: 0,
      visible: false,
    })
  })

  it('isolates listener errors, rejects synchronous reentry and stops after destruction', async () => {
    const report = vi.fn()
    vi.stubGlobal('reportError', report)
    const { chart } = create()
    const next = vi.fn(),
      skipped = vi.fn()
    chart.on('seriesVisibilityChange', () => {
      expect(() => chart.dispatchAction({ type: 'toggleSeries', seriesId: 'b' })).toThrow('reentry')
      throw new Error('listener failure')
    })
    chart.on('seriesVisibilityChange', next)
    chart.on('seriesVisibilityChange', () => chart.destroy())
    chart.on('seriesVisibilityChange', skipped)
    chart.dispatchAction({ type: 'toggleSeries', seriesId: 'a' })
    expect(next).toHaveBeenCalledTimes(1)
    expect(skipped).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(report).toHaveBeenCalledTimes(1)
    expect(() => chart.on('layoutChange', () => {})).toThrow('destroyed')
    expect(() => chart.dispatchAction({ type: 'toggleSeries', seriesId: 'a' })).toThrow('destroyed')
  })

  it('does not notify queued layout subscriptions after destruction', async () => {
    const { chart } = create()
    const listener = vi.fn()
    const remove = chart.on('layoutChange', listener)
    chart.destroy()
    remove()
    await Promise.resolve()
    expect(listener).not.toHaveBeenCalled()
  })
})
