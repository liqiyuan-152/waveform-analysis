import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SvgExporter } from '@/export/SvgExporter'
import { init } from '@/chart/init'
import type { WaveformChartInstance } from '@/types/native'
import { flushNativeUpdates } from '../support/nativeChart'

const charts: WaveformChartInstance[] = []
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    measureText: (text: string) => ({ width: text.length * 12 }),
  } as unknown as CanvasRenderingContext2D)
})
afterEach(() => {
  charts.splice(0).forEach((chart) => chart.dispose())
  document.body.replaceChildren()
  vi.restoreAllMocks()
})
const parse = (text: string) => {
  const result = new DOMParser().parseFromString(text, 'image/svg+xml')
  expect(result.querySelector('parsererror')).toBeNull()
  return result
}
const read = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.readAsText(blob)
  })

function source() {
  const container = document.createElement('div')
  container.style.backgroundColor = 'rgb(10, 20, 30)'
  container.innerHTML = `<div class="waveform-chart__title-area"><span class="waveform-chart__title-text" style="font-size:16px;width:32px;letter-spacing:1px;color:rgb(1,2,3)">中文标题</span></div><svg width="300" height="160"><defs><clipPath id="clip"><rect width="10" height="10"/></clipPath><marker id="arrow"/></defs><path d="M0 0L10 10" stroke="#123456" clip-path="url(https://host.test/#clip)" style="marker-end:url(https://host.test/#arrow)"/><rect class="waveform-chart__overlay"/><g class="waveform-chart__hover-layer"><text>悬浮提示</text></g><rect class="waveform-chart__zoom-selection"/><foreignObject x="7" y="9" width="200"><div class="waveform-legend__panel" style="background-color:rgb(4,5,6)"><button class="waveform-legend__item" style="opacity:0.5"><svg><path stroke="red"/></svg><span class="waveform-legend__label" style="color:rgb(7,8,9);text-decoration:line-through">通道甲</span></button></div></foreignObject><text tabindex="0" role="button" aria-haspopup="menu">中文标注</text></svg>`
  document.body.append(container)
  const svg = container.querySelector('svg')!
  return { container, svg, context: { container, width: 300, height: 200, titleHeight: 40 } }
}

describe('standalone SVG snapshot', () => {
  it('preserves full dimensions, Chinese wrapped title, axes/annotations and inline paint', () => {
    const { container, svg, context } = source()
    const before = container.innerHTML
    const result = parse(new SvgExporter().serialize(svg, undefined, context))
    expect(result.documentElement.getAttribute('height')).toBe('200')
    expect(result.documentElement.getAttribute('viewBox')).toBe('0 0 300 200')
    expect(result.querySelector('svg svg')?.getAttribute('y')).toBe('40')
    expect(result.querySelector('svg > rect')?.getAttribute('fill')).toBe('rgb(10, 20, 30)')
    expect(result.querySelectorAll('tspan')).toHaveLength(2)
    expect(result.documentElement.textContent).toContain('中文标题')
    expect(result.documentElement.textContent).toContain('中文标注')
    expect(result.querySelector('text[tabindex], [role], [aria-haspopup]')).toBeNull()
    expect(container.innerHTML).toBe(before)
  })

  it('replaces HTML legends with SVG labels/swatches and excludes interaction layers', () => {
    const { svg, context } = source()
    const result = parse(new SvgExporter().serialize(svg, '#abcdef', context))
    expect(result.querySelector('foreignObject, button, div')).toBeNull()
    expect(result.querySelector('.waveform-export-legend')?.getAttribute('transform')).toBe(
      'translate(7,9)',
    )
    expect(result.querySelector('.waveform-export-legend text')?.textContent).toBe('通道甲')
    expect(result.querySelector('.waveform-export-legend g')?.getAttribute('opacity')).toBe('0.5')
    expect(result.querySelector('.waveform-export-legend path')?.getAttribute('stroke')).toBe('red')
    expect(result.documentElement.textContent).not.toContain('悬浮提示')
    expect(result.querySelector('[class*="overlay"], [class*="zoom-selection"]')).toBeNull()
    expect(result.querySelector('svg > rect')?.getAttribute('fill')).toBe('#abcdef')
  })

  it('normalizes paint references in attributes and inline styles independently of the host URL', () => {
    const { svg, context } = source()
    const text = new SvgExporter().serialize(svg, undefined, context)
    expect(text).toContain('url(#clip)')
    expect(
      parse(text).querySelector('path')?.style.getPropertyValue('marker-end').replaceAll('"', ''),
    ).toBe('url(#arrow)')
    expect(text).not.toContain('https://host.test/')
  })

  it.each(['none', 'hidden'])(
    'omits hidden title (%s) but preserves reserved title space',
    (hidden) => {
      const { svg, context, container } = source()
      const area = container.querySelector<HTMLElement>('.waveform-chart__title-area')!
      if (hidden === 'none') area.style.display = 'none'
      else area.style.visibility = 'hidden'
      const result = parse(new SvgExporter().serialize(svg, undefined, context))
      expect(result.documentElement.textContent).not.toContain('中文标题')
      expect(result.querySelector('svg svg')?.getAttribute('y')).toBe('40')
    },
  )

  it('uses the source owner document for serialization and computed styles', () => {
    const iframe = document.createElement('iframe')
    document.body.append(iframe)
    const owner = iframe.contentDocument!
    owner.body.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="20"><text style="fill:rgb(3,4,5)">窗口标题</text></svg>'
    const computed = vi.spyOn(iframe.contentWindow!, 'getComputedStyle')
    const result = parse(new SvgExporter().serialize(owner.querySelector('svg')!))
    expect(computed).toHaveBeenCalled()
    expect(result.querySelector('text')?.style.fill).toBe('rgb(3, 4, 5)')
  })

  it('exports only the current page and visible series, retaining annotations and title', async () => {
    const host = document.createElement('div')
    const chart = init(
      host,
      {
        width: 800,
        height: 400,
        animationEnabled: false,
        displayMode: 'independent',
        grid: { rowCount: 1, columnCount: 1 },
        title: { text: '中文波形标题' },
        data: {
          kind: 'series',
          series: ['a', 'b', 'c'].map((id) => ({
            id,
            name: `通道${id}`,
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
            },
          })),
        },
        annotations: [{ id: 'note', seriesId: 'b', x: 1, y: 1, text: '当前页标注' }],
        hiddenSeriesIds: ['c'],
      },
      { autoResize: false },
    )
    charts.push(chart)
    await flushNativeUpdates()
    host.querySelector<HTMLButtonElement>('[aria-label="下一页"]')!.click()
    await flushNativeUpdates()
    const result = parse(await read(await chart.exportImage({ format: 'svg' })))
    expect(result.documentElement.getAttribute('height')).toBe('400')
    expect(result.documentElement.textContent).toContain('中文波形标题')
    expect(result.documentElement.textContent).toContain('当前页标注')
    const ids = [...result.querySelectorAll('.waveform-chart__series')].map((node) =>
      node.getAttribute('data-series-id'),
    )
    expect(ids).toEqual(['b'])
    expect(
      result.querySelector('foreignObject, [class*="toolbar"], [class*="pagination"]'),
    ).toBeNull()
  })
})
