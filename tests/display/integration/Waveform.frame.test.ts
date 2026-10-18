// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { Waveform } from '../../../src/display/Waveform'
import type { WaveformData } from '../../../src/display/types/data'

const data = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
]

afterEach(() => {
  document.body.replaceChildren()
})

function render(options = {}, chartData: WaveformData = data) {
  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
  document.body.append(container)
  new Waveform(container, chartData, {
    responsive: { enabled: false },
    ...options,
  })
  return container.querySelector('svg')!
}

function createChart(options = {}, chartData: WaveformData = data) {
  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
  document.body.append(container)
  const chart = new Waveform(container, chartData, {
    responsive: { enabled: false },
    ...options,
  })
  return { chart, container }
}

describe('Waveform frame', () => {
  it('renders a single border rect after axes and before waveform paths', () => {
    const svg = render()
    const plot = svg.querySelector('svg > g')!
    const background = plot.querySelector('.waveform-frame-background')!
    const border = plot.querySelector('.waveform-frame-border')!
    const children = Array.from(plot.children)
    const axisIndex = children.findIndex((child) => child.querySelector('.domain'))
    const borderIndex = children.indexOf(border)
    const seriesIndex = children.findIndex((child) => child.getAttribute('clip-path') !== null)

    expect(plot.querySelectorAll('.waveform-frame-border')).toHaveLength(1)
    expect(background.getAttribute('stroke')).toBe('none')
    expect(border.getAttribute('fill')).toBe('none')
    expect(borderIndex).toBeGreaterThan(axisIndex)
    expect(borderIndex).toBeLessThan(seriesIndex)
  })

  it('uses the reference frame defaults and supports dashed, dotted, and rounded frames', () => {
    const defaultFrame = render().querySelector('.waveform-frame-border')!
    expect(defaultFrame.getAttribute('stroke')).toBe('#000000')
    expect(defaultFrame.getAttribute('stroke-width')).toBe('2')
    expect(defaultFrame.getAttribute('stroke-dasharray')).toBeNull()

    const dashedFrame = render({ frame: { borderStyle: 'dashed', borderWidth: 2 } }).querySelector(
      '.waveform-frame-border',
    )!
    expect(dashedFrame.getAttribute('stroke-dasharray')).toBe('6 4')
    expect(dashedFrame.getAttribute('stroke-width')).toBe('2')

    const dottedFrame = render({ frame: { borderStyle: 'dotted', radius: 8 } }).querySelector(
      '.waveform-frame-border',
    )!
    expect(dottedFrame.getAttribute('stroke-dasharray')).toBe('1 3')
    expect(dottedFrame.getAttribute('stroke-linecap')).toBe('round')
    expect(dottedFrame.getAttribute('rx')).toBe('8')
  })

  it('renders an optional centered frame number below the axes, curves, and zero line', () => {
    expect(render().querySelector('.waveform-frame-number')).toBeNull()

    for (const value of [12, 'FRAME-A', 0]) {
      const svg = render({ frameNumber: value }, [
        { x: 0, y: -1 },
        { x: 1, y: 1 },
      ])
      const plot = svg.querySelector('svg > g')!
      const frame = plot.querySelector('.waveform-frame-border')!
      const watermark = plot.querySelector('.waveform-frame-number')!
      const children = Array.from(plot.children)
      const zeroLineIndex = children.indexOf(plot.querySelector('.waveform-zero-line')!)
      const watermarkIndex = children.indexOf(watermark)
      const axisIndex = children.findIndex((child) => child.classList.contains('waveform-axis-x'))
      const seriesIndex = children.findIndex((child) => child.getAttribute('clip-path') !== null)

      expect(watermark.textContent).toBe(String(value))
      expect(watermark.getAttribute('x')).toBe(String(Number(frame.getAttribute('width')) / 2))
      expect(watermark.getAttribute('y')).toBe(String(Number(frame.getAttribute('height')) / 2))
      expect(watermark.getAttribute('text-anchor')).toBe('middle')
      expect(watermark.getAttribute('dominant-baseline')).toBe('central')
      expect(watermarkIndex).toBeLessThan(zeroLineIndex)
      expect(watermarkIndex).toBeLessThan(axisIndex)
      expect(watermarkIndex).toBeLessThan(seriesIndex)
    }
  })

  it('uses reference frame-number styles and supports safe style overrides', () => {
    const defaultWatermark = render({ frameNumber: 1 }).querySelector('.waveform-frame-number')!
    expect(defaultWatermark.getAttribute('fill')).toBe('#1677ff')
    expect(defaultWatermark.getAttribute('opacity')).toBe('0.1')
    expect(defaultWatermark.getAttribute('font-size')).toBe('120')
    expect(defaultWatermark.getAttribute('font-family')).toBe(
      "Consolas, Monaco, 'Courier New', monospace",
    )
    expect(defaultWatermark.getAttribute('font-weight')).toBe('400')
    expect(defaultWatermark.getAttribute('aria-hidden')).toBe('true')
    expect(defaultWatermark.getAttribute('style')).toContain('pointer-events: none')
    expect(defaultWatermark.getAttribute('style')).toContain('user-select: none')

    const styled = render({
      frameNumber: 'CUSTOM',
      frameNumberStyle: {
        color: '#123456',
        opacity: 2,
        fontSize: 48,
        fontFamily: 'Arial',
        fontWeight: 700,
      },
    }).querySelector('.waveform-frame-number')!
    expect(styled.getAttribute('fill')).toBe('#123456')
    expect(styled.getAttribute('opacity')).toBe('1')
    expect(styled.getAttribute('font-size')).toBe('48')
    expect(styled.getAttribute('font-family')).toBe('Arial')
    expect(styled.getAttribute('font-weight')).toBe('700')

    const fallback = render({
      frameNumber: 1,
      frameNumberStyle: { color: '', opacity: Number.NaN, fontSize: -1, fontFamily: '' },
    }).querySelector('.waveform-frame-number')!
    expect(fallback.getAttribute('fill')).toBe('#1677ff')
    expect(fallback.getAttribute('opacity')).toBe('0.1')
    expect(fallback.getAttribute('font-size')).toBe('120')
    expect(fallback.getAttribute('font-family')).toBe("Consolas, Monaco, 'Courier New', monospace")
  })

  it('shrinks long frame numbers to fit inside narrow plot frames', () => {
    const svg = render({
      width: 240,
      layout: { autoPadding: false },
      padding: { top: 20, right: 20, bottom: 20, left: 20 },
      frameNumber: 'FRAME-1234567890',
      frameNumberStyle: { fontSize: 100 },
    })
    const watermark = svg.querySelector('.waveform-frame-number')!
    const frame = svg.querySelector('.waveform-frame-border')!
    const fontSize = Number(watermark.getAttribute('font-size'))
    const estimatedWidth = watermark.textContent!.length * fontSize * 0.6

    expect(fontSize).toBeLessThan(100)
    expect(estimatedWidth).toBeLessThanOrEqual(Number(frame.getAttribute('width')) * 0.9)
  })

  it('preserves frame-number styles across partial runtime updates', () => {
    const { chart, container } = createChart({
      frameNumber: 'A1',
      frameNumberStyle: { color: '#123456', opacity: 0.25, fontSize: 30 },
    })

    chart.updateOptions({ frameNumber: 'B2', frameNumberStyle: { fontSize: 24 } })
    const updated = container.querySelector('.waveform-frame-number')!
    expect(updated.textContent).toBe('B2')
    expect(updated.getAttribute('fill')).toBe('#123456')
    expect(updated.getAttribute('opacity')).toBe('0.25')
    expect(updated.getAttribute('font-size')).toBe('24')
  })

  it('omits the frame number for empty data and when every series is hidden', () => {
    expect(render({ frameNumber: 1 }, []).querySelector('.waveform-frame-number')).toBeNull()

    const { container } = createChart({ frameNumber: 1, legend: { visible: true } }, [
      { id: 'first', name: 'First', data },
      { id: 'second', name: 'Second', data },
    ])
    let items = container.querySelectorAll<SVGGElement>('.waveform-legend-item')
    items[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(container.querySelector('.waveform-frame-number')).not.toBeNull()
    items = container.querySelectorAll<SVGGElement>('.waveform-legend-item')
    items[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(container.querySelector('.waveform-frame-number')).toBeNull()
  })

  it('draws x and y tick marks inside the plot frame', () => {
    const svg = render({ secondaryYAxis: { visible: true } }, [
      { name: 'left', data },
      { name: 'right', yAxis: 'right', data },
    ])
    const ticks = Array.from(svg.querySelectorAll('.tick line'))

    expect(ticks.some((tick) => Number(tick.getAttribute('y2')) < 0)).toBe(true)
    expect(ticks.some((tick) => Number(tick.getAttribute('x2')) > 0)).toBe(true)
    expect(ticks.some((tick) => Number(tick.getAttribute('x2')) < 0)).toBe(true)
  })

  it('hides x-axis ticks at both frame endpoints by default', () => {
    const svg = render()
    const plot = svg.querySelector('svg > g')!
    const frame = plot.querySelector('.waveform-frame-border')!
    const width = Number(frame.getAttribute('width'))
    const xAxis = plot.querySelector('.waveform-axis-x')!
    const xTickPositions = Array.from(xAxis.querySelectorAll('.tick')).map((tick) =>
      Number((tick as SVGGElement).getAttribute('transform')?.match(/translate\(([^,]+)/)?.[1]),
    )

    expect(xTickPositions).not.toContain(0)
    expect(xTickPositions).not.toContain(width)
  })

  it('uses the frame as the only plot boundary', () => {
    const svg = render()

    expect(svg.querySelectorAll('.waveform-frame-border')).toHaveLength(1)
    expect(svg.querySelectorAll('.domain')).toHaveLength(0)
  })

  it('places a top horizontal legend below the chart title', () => {
    const svg = render(
      {
        title: { visible: true, text: 'Waveform title' },
        legend: { visible: true, position: 'top-left', orientation: 'horizontal' },
      },
      [
        { name: 'First', data },
        { name: 'Second', data },
      ],
    )
    const title = Array.from(svg.querySelectorAll(':scope > text')).find(
      (node) => node.textContent === 'Waveform title',
    )!
    const legendItem = svg.querySelector('.waveform-legend > g')!
    const legendY = Number(legendItem.getAttribute('transform')?.match(/,([^)]+)/)?.[1])

    expect(Number(title.getAttribute('y'))).toBeLessThan(legendY)
    expect(svg.querySelector('svg > g')?.getAttribute('transform')).toBe('translate(51,42)')
  })

  it('renders legend labels without series units', () => {
    const svg = render({ legend: { visible: true } }, [
      { name: 'First', unit: 'ms', data },
      { name: 'Second', unit: 'V', data },
    ])

    expect(
      Array.from(svg.querySelectorAll('.waveform-legend text'), (item) => item.textContent),
    ).toEqual(['First', 'Second'])
    expect(svg.querySelector('.waveform-legend-item')?.getAttribute('style')).toContain(
      'outline: none',
    )
  })
})
