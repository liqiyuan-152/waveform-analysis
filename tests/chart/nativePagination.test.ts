import { afterEach, describe, expect, it, vi } from 'vitest'
import { init } from '@/chart/init'
import type { WaveformChartInstance } from '@/types/native'
import type { WaveformData } from '@/types/data'
import { flushNativeUpdates } from '../support/nativeChart'

const charts: WaveformChartInstance[] = []
afterEach(() => {
  charts.splice(0).forEach((chart) => chart.dispose())
  document.body.replaceChildren()
  vi.restoreAllMocks()
})
function data(count: number): WaveformData {
  return {
    kind: 'series',
    series: Array.from({ length: count }, (_, i) => ({
      id: `s${i}`,
      name: `通道 ${i}`,
      data: {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
    })),
  }
}
async function setup(count = 12, displayMode: 'independent' | 'separated' = 'independent') {
  const host = document.createElement('div')
  document.body.append(host)
  vi.spyOn(host, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
  const chart = init(
    host,
    {
      data: data(count),
      width: 360,
      height: 360,
      displayMode,
      animationEnabled: false,
      rendering: { sampling: { mode: 'raw' } },
      grid: { rowCount: 1, columnCount: 1 },
    },
    { autoResize: false },
  )
  charts.push(chart)
  await flushNativeUpdates()
  const click = async (label: string) => {
    host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click()
    await flushNativeUpdates()
  }
  return { host, chart, click }
}
describe('native pagination ownership', () => {
  it('updates pagination theme without changing the page', async () => {
    const { chart, host, click } = await setup()
    await click('下一页')
    const changed = vi.fn()
    chart.on('page-change', changed)
    chart.setOption({ controlTheme: 'dark' })
    await flushNativeUpdates()
    expect(host.querySelector<HTMLElement>('.waveform-pagination')?.dataset.controlTheme).toBe(
      'dark',
    )
    expect(host.querySelector('[aria-current="page"]')?.textContent).toBe('2')
    expect(changed).not.toHaveBeenCalled()
  })

  it('supports jump windows, boundary disabling and stable focus without repeated page events', async () => {
    const { host, chart, click } = await setup()
    const event = vi.fn()
    chart.on('page-change', event)
    const next = host.querySelector<HTMLButtonElement>('[aria-label="下一页"]')!
    next.focus()
    await click('下一页')
    expect(document.activeElement).toBe(next)
    expect(event).toHaveBeenLastCalledWith(2, 12)
    await click('向后 5 页')
    expect(event).toHaveBeenLastCalledWith(7, 12)
    await click('第 12 页')
    expect(event).toHaveBeenLastCalledWith(12, 12)
    expect(next.disabled).toBe(true)
    await click('下一页')
    await click('第 12 页')
    expect(event).toHaveBeenCalledTimes(3)
    await click('向前 5 页')
    expect(event).toHaveBeenLastCalledWith(7, 12)
  })

  it('clamps shrinking data and resets grid changes while preserving stable hidden IDs', async () => {
    const { host, chart, click } = await setup(3)
    const event = vi.fn()
    chart.on('page-change', event)
    await click('第 3 页')
    chart.setOption({ data: data(2), hiddenSeriesIds: ['s1'] })
    expect(event).toHaveBeenLastCalledWith(2, 2)
    await flushNativeUpdates()
    expect(host.querySelector('.waveform-chart__line')).toBeNull()
    expect(host.querySelector('[aria-current="page"]')?.textContent).toBe('2')
    chart.setOption({ grid: { rowCount: 2, columnCount: 1 } })
    expect(event).toHaveBeenLastCalledWith(1, 1)
    await flushNativeUpdates()
    expect(host.querySelector<HTMLElement>('nav')?.hidden).toBe(true)
    expect(host.querySelectorAll('.waveform-chart__line')).toHaveLength(1)
    chart.setOption({ hiddenSeriesIds: [] })
    await flushNativeUpdates()
    expect(host.querySelectorAll('.waveform-chart__line')).toHaveLength(2)
  })

  it.each(['independent', 'separated'] as const)(
    'preserves %s viewport semantics across pages',
    async (displayMode) => {
      const { chart, click } = await setup(3, displayMode)
      chart.setViewportDomain([0.2, 0.8])
      await flushNativeUpdates()
      const expected =
        displayMode === 'independent'
          ? [0, 1]
          : chart.getControlState().targets[0]!.viewport.xDomain
      await click('下一页')
      expect(chart.getControlState().targets[0]?.viewport.xDomain).toEqual(expected)
      await click('上一页')
      const restored = chart.getControlState().targets[0]!.viewport.xDomain
      expect(restored[0]).toBeCloseTo(0.2)
      expect(restored[1]).toBeCloseTo(0.8)
    },
  )

  it('accepts reentrant data updates and destruction from page-change handlers', async () => {
    const { chart, host, click } = await setup(3)
    const pages: number[] = []
    chart.on('page-change', (page) => {
      pages.push(page)
      if (page === 2) chart.setOption({ data: data(1) })
      else chart.dispose()
    })
    await click('下一页')
    expect(pages).toEqual([2, 1])
    expect(chart.isDisposed()).toBe(true)
    expect(host.children).toHaveLength(0)
  })
})
