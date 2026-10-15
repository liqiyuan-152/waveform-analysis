import { afterEach, describe, expect, it } from 'vitest'
import { ChartModel } from '@/model/ChartModel'
import { ChartLayoutEngine } from '@/layout/ChartLayoutEngine'
import { SvgChartRenderer } from '@/rendering/SvgChartRenderer'
import type { WaveformChartOptions } from '@/types/options'

const renderers: SvgChartRenderer[] = []
afterEach(() => {
  renderers.forEach((renderer) => renderer.dispose())
  renderers.length = 0
  document.body.replaceChildren()
})

function chart(options: WaveformChartOptions = {}) {
  const model = new ChartModel({
    data: {
      kind: 'series',
      series: [
        {
          id: 'a',
          name: '电压',
          unit: 'V',
          lineStyle: 'dash-dot',
          pointType: 'square',
          errorBar: { visible: true },
          data: {
            kind: 'points',
            points: [
              { x: 0, y: -1, lowerError: 2, upperError: 3 },
              { x: 1, y: 1 },
            ],
          },
        },
      ],
    },
    yDomain: [-5, 5],
    axes: { y: { nice: false } },
    grid: { rowCount: 1, columnCount: 1 },
    ...options,
  })
  const host = document.createElement('div')
  document.body.append(host)
  const renderer = new SvgChartRenderer(host)
  renderers.push(renderer)
  const engine = new ChartLayoutEngine(model)
  const render = () =>
    renderer.render(
      engine.calculate(800, 400, renderer.measureTitle(800, model.options.value)),
      model.options.value,
      model.visibility.snapshot(model.options.value.hiddenSeriesIds),
    )
  render()
  return { host, model, render, renderer }
}

describe('native visual layers', () => {
  it('keeps paint nodes attached on refresh and reorders stable tracks when requested', () => {
    const data = {
      kind: 'series' as const,
      series: ['a', 'b'].map((id) => ({
        id,
        name: id,
        data: { kind: 'samples' as const, values: [0, 1, 0], sampleRate: 1 },
      })),
    }
    const { host, model, render } = chart({
      data,
      grid: { rowCount: 2, columnCount: 1 },
    })
    const plot = host.querySelector('.waveform-chart__plot')!
    const tracks = [...plot.children]
    const geometry = [...host.querySelectorAll('.waveform-track__series')]
    const observer = new MutationObserver(() => {})
    observer.observe(plot, { childList: true, subtree: true, attributes: true })
    render()
    const changes = observer.takeRecords()
    expect(
      changes.filter(
        (change) =>
          change.type === 'childList' &&
          (change.target === plot || geometry.includes(change.target as Element)),
      ),
    ).toEqual([])
    expect(
      changes.filter(
        (change) =>
          change.type === 'attributes' &&
          change.target === host.querySelector('path.waveform-chart__line'),
      ),
    ).toEqual([])
    model.setOption({ grid: { rowCount: 2, columnCount: 1, trackOrder: ['b', 'a'] } })
    render()
    expect([...plot.children]).toEqual([tracks[1], tracks[0]])
    observer.disconnect()
  })

  it('uses compound point/error paths and preserves stable nodes across style updates', () => {
    const { host, model, render } = chart()
    const line = host.querySelector('.waveform-chart__line')!
    const points = host.querySelector('.waveform-chart__point')!
    const errors = host.querySelector('.waveform-chart__error-bar')!
    expect(line.getAttribute('stroke-dasharray')).toBe('8 5 1.5 5')
    expect(line.getAttribute('stroke-width')).toBe('1')
    expect(points.getAttribute('d')).toContain('Z')
    expect(errors.getAttribute('d')).toContain('V')
    expect(host.querySelectorAll('.waveform-chart__point')).toHaveLength(1)
    expect(host.querySelectorAll('.waveform-chart__error-bar')).toHaveLength(1)
    model.setOption({ lineColor: 'red' })
    render()
    expect(host.querySelector('.waveform-chart__point')).toBe(points)
    expect(host.querySelector('.waveform-chart__error-bar')).toBe(errors)
    expect(line.getAttribute('stroke')).toBe('red')
  })

  it('updates grid colors and retains data-coordinate ticks and axis units', () => {
    const { host, model, render } = chart({
      grid: {
        rowCount: 1,
        columnCount: 1,
        trackLines: { a: { verticalColor: '#123456', horizontal: false } },
      },
    })
    expect(host.querySelector('[data-grid-direction="vertical"]')?.getAttribute('stroke')).toBe(
      '#123456',
    )
    expect(host.querySelector('[data-grid-direction="horizontal"]')).toBeNull()
    const yAxis = host.querySelector('.waveform-chart__axis--y')!
    expect(yAxis.getAttribute('data-label-unit')).toBe('V')
    expect(host.querySelector('.waveform-chart__y-axis-label')?.textContent).toBe('电压')
    model.setOption({ unitDisplayMode: 'channel-label', axes: { x: { lineVisible: false } } })
    render()
    expect(yAxis.hasAttribute('data-label-unit')).toBe(false)
    expect(host.querySelector('.waveform-chart__y-axis-label')?.textContent).toBe('电压(V)')
    expect(
      host.querySelector('.waveform-chart__axis--x path.domain')?.getAttribute('display'),
    ).toBe('none')
  })

  it('uses current zero-line threshold and per-track watermark/frame style', () => {
    const { host, model, render } = chart({
      frameNumber: 10,
      frameNumbers: { a: '试验' },
      frameStyle: { borderStyle: 'dotted', borderWidth: 2, backgroundColor: '#eee' },
    })
    expect(host.querySelector('.waveform-chart__zero-line')).not.toBeNull()
    expect(host.querySelector('.waveform-chart__watermark')?.textContent).toBe('试验')
    expect(
      host.querySelector('.waveform-chart__plot-frame')?.getAttribute('stroke-dasharray'),
    ).toBe('1 3')
    expect(host.querySelector('.waveform-chart__plot-background')?.getAttribute('fill')).toBe(
      '#eee',
    )
    model.setOption({ yDomain: [-8, 0.0001] })
    render()
    expect(host.querySelector('.waveform-chart__zero-line')).toBeNull()
    model.setOption({ zeroLine: { boundaryThreshold: 0 } })
    render()
    expect(host.querySelector('.waveform-chart__zero-line')).not.toBeNull()
    model.setOption({ cleanView: true })
    render()
    expect(host.querySelector('.waveform-chart__zero-line')).toBeNull()
    expect(host.querySelector<SVGElement>('.waveform-chart__watermark')?.style.display).toBe('none')
    expect(host.querySelector('.waveform-chart__y-axis-label')).toBeNull()
    expect(host.querySelectorAll('.waveform-chart__axis--y .tick').length).toBeGreaterThan(0)
    expect(host.querySelector('.waveform-chart__plot-frame')).not.toBeNull()
  })

  it('reserves title area while clean, supports rotation and releases the area when removed', () => {
    const { host, model, render } = chart({ title: { text: '标题', textStyle: { rotation: 35 } } })
    const title = host.querySelector<HTMLElement>('.waveform-chart__title-area')!
    const height = Number.parseFloat(title.style.height)
    expect(height).toBeGreaterThanOrEqual(44)
    expect(host.querySelector('.waveform-chart__title-text')?.textContent).toBe('标题')
    expect(Number(host.querySelector('svg')?.getAttribute('height'))).toBe(400 - height)
    expect(host.querySelector('.waveform-chart__x-label')?.textContent).toBe('时间（ms）')
    model.setOption({ cleanView: true })
    render()
    expect(title.style.height).toBe(`${height}px`)
    expect(title.getAttribute('aria-hidden')).toBe('true')
    model.setOption({ title: undefined, timeUnit: 's' })
    render()
    expect(title.style.display).toBe('none')
    expect(host.querySelector('svg')?.getAttribute('height')).toBe('400')
    expect(host.querySelector('.waveform-chart__x-label')?.textContent).toBe('时间（s）')
  })

  it('keeps legend buttons focused across updates and displays hidden/unit state', () => {
    const base = {
      kind: 'points' as const,
      points: [
        { x: 0, y: -1 },
        { x: 1, y: 1 },
      ],
    }
    const { host, model, render } = chart({
      data: {
        kind: 'series',
        series: [
          { id: 'a', trackId: 't', name: 'A', unit: 'V', data: base },
          { id: 'b', trackId: 't', name: 'B', unit: 'A', data: base },
        ],
      },
      unitDisplayMode: 'channel-label-or-legend',
      hiddenSeriesIds: ['a'],
      legend: { position: 'bottom', interactive: true },
    })
    const button = host.querySelector<HTMLButtonElement>('.waveform-chart__legend-item')!
    expect(button.textContent).toContain('A (V)')
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(host.querySelector('.waveform-chart__y-axis-label')).toBeNull()
    expect(host.querySelector('.waveform-chart__legend')?.getAttribute('data-orientation')).toBe(
      'horizontal',
    )
    button.focus()
    model.setOption({ lineColor: 'red' })
    render()
    expect(host.querySelector('.waveform-chart__legend-item')).toBe(button)
    expect(document.activeElement).toBe(button)
    model.setOption({ cleanView: true })
    render()
    expect(host.querySelector('.waveform-chart__legend')).toBeNull()
  })

  it('creates grid nodes in the container document and handles font callbacks after disposal', async () => {
    const iframe = document.createElement('iframe')
    document.body.append(iframe)
    const host = iframe.contentDocument!.createElement('div')
    iframe.contentDocument!.body.append(host)
    const model = new ChartModel({
      data: {
        kind: 'points',
        points: [
          { x: 0, y: -1 },
          { x: 1, y: 1 },
        ],
      },
    })
    const renderer = new SvgChartRenderer(host)
    renderers.push(renderer)
    renderer.render(new ChartLayoutEngine(model).calculate(800, 400), model.options.value)
    expect(host.querySelector('[data-grid-direction]')?.ownerDocument).toBe(iframe.contentDocument)
    renderer.dispose()
    await Promise.resolve()
    expect(host.childElementCount).toBe(0)
  })
})
