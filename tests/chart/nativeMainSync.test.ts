import { afterEach, describe, expect, it, vi } from 'vitest'
import { init } from '@/index'
import type { WaveformChartInstance, WaveformData } from '@/index'
import { flushNativeUpdates } from '../support/nativeChart'

const charts: WaveformChartInstance[] = []
afterEach(() => {
  charts.splice(0).forEach((chart) => chart.dispose())
  document.body.replaceChildren()
  vi.restoreAllMocks()
})
const data = (empty = false): WaveformData => ({
  kind: 'series',
  series: ['a', 'b'].map((id) => ({
    id,
    name: id,
    trackId: 'frame',
    unit: 'V',
    data: {
      kind: 'points',
      points: empty ? [] : Array.from({ length: 101 }, (_, x) => ({ x: x / 10, y: Math.sin(x) })),
    },
  })),
})
async function setup() {
  const host = document.createElement('div')
  document.body.append(host)
  vi.spyOn(host, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
  const chart = init(
    host,
    {
      data: data(),
      width: 320,
      height: 360,
      overlayMode: 'multi-axis',
      animationEnabled: false,
      xDomainStrategy: { type: 'data' },
      rendering: { sampling: { mode: 'raw' } },
      grid: { rowCount: 1, columnCount: 1 },
    },
    { autoResize: false },
  )
  charts.push(chart)
  await flushNativeUpdates()
  return { host, chart }
}
describe('main updates through the framework-independent public entry', () => {
  it('updates X divisions without resetting a zoomed viewport or changing seconds', async () => {
    const { host, chart } = await setup()
    chart.setViewportDomain([2, 8])
    await flushNativeUpdates()
    const state = chart.getControlState().targets[0].viewport
    const zoom = vi.fn()
    chart.on('zoom-change', zoom)
    const tickCount = () => host.querySelectorAll('.waveform-chart__axis--x .tick').length
    const before = tickCount()
    chart.setOption({ axes: { x: { splitNumber: 12 } }, timeUnit: 'ms' })
    await flushNativeUpdates()
    expect(tickCount()).toBeGreaterThan(before)
    expect(chart.getControlState().targets[0].viewport).toEqual(state)
    expect(zoom).not.toHaveBeenCalled()
  })

  it('keeps domains, axes and frame sizes across empty windows while clearing geometry', async () => {
    const { host, chart } = await setup()
    chart.setViewportDomain([2, 8])
    await flushNativeUpdates()
    const state = chart.getControlState().targets[0].viewport
    const frame = host.querySelector('.waveform-chart__plot-frame')!.getAttribute('d')
    chart.setOption({ data: data(true) })
    await flushNativeUpdates()
    expect(chart.getControlState().targets[0].viewport).toEqual(state)
    expect(host.querySelectorAll('.waveform-track__axis--y')).toHaveLength(2)
    expect(host.querySelector('.waveform-chart__plot-frame')!.getAttribute('d')).toBe(frame)
    expect(host.querySelector('.waveform-chart__line:not([display="none"])')).toBeNull()
    expect(chart.zoomIn().status).toBe('applied')
    chart.setOption({ data: data() })
    await flushNativeUpdates()
    expect(host.querySelector('.waveform-chart__line:not([display="none"])')).not.toBeNull()
  })

  it('keeps overflow width stable during commands and exports the complete content', async () => {
    const { host, chart } = await setup()
    const root = host.querySelector<HTMLElement>('.waveform-chart')!
    const svg = host.querySelector('svg')!
    expect(root.classList.contains('waveform-chart--scrollable')).toBe(true)
    const width = svg.getAttribute('width')
    expect(Number(width)).toBeGreaterThan(320)
    chart.zoomIn()
    await flushNativeUpdates()
    expect(svg.getAttribute('width')).toBe(width)
    const exported = await chart.exportImage({ format: 'svg' })
    expect(await exported.text()).toContain(`width="${width}"`)
    chart.setOption({ width: 1600 })
    chart.resize()
    await flushNativeUpdates()
    expect(root.classList.contains('waveform-chart--scrollable')).toBe(false)
  })
  it('reserves a separate pagination band below the X title in a narrow compact chart', async () => {
    const { host, chart } = await setup()
    const input = data()
    if (input.kind !== 'series') throw new Error('Expected series input')
    chart.setOption({
      data: { ...input, series: input.series.map((series) => ({ ...series, trackId: series.id })) },
      layoutPreset: 'edge-compact',
      title: { text: 'Paged chart', textStyle: { fontSize: 18 } },
    })
    await flushNativeUpdates()
    expect(host.querySelector('[aria-label="下一页"]')).not.toBeNull()
    const titleHeight = Number(
      host.querySelector('.waveform-chart')!.getAttribute('data-title-area-height'),
    )
    const svgHeight = Number(host.querySelector('svg')!.getAttribute('height'))
    const baseline = Number(host.querySelector('.waveform-chart__x-label')!.getAttribute('y'))
    expect(titleHeight + svgHeight).toBe(360 - 40)
    expect(titleHeight + baseline + 6).toBeLessThan(360 - 6 - 32)
  })
})
