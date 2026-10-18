// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { Waveform } from '../../../src/display/Waveform'
import type { WaveformData } from '../../../src/display/types/data'
import type { WaveformOptions } from '../../../src/display/types/options'

const data = [
  { x: 0, y: -1 },
  { x: 1, y: 1 },
]

afterEach(() => {
  document.body.replaceChildren()
})

function createChart(options: WaveformOptions = {}, points: WaveformData = data) {
  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
  document.body.append(container)
  const chart = new Waveform(container, points, { responsive: { enabled: false }, ...options })
  return { chart, container }
}

function firstGridLine(container: HTMLElement, axis: 'x' | 'y'): SVGLineElement {
  return container.querySelector(`.waveform-grid-${axis} .tick line`)!
}

describe('Waveform grid styling', () => {
  it.each([
    { min: 0, max: 10 },
    { min: -10, max: 0 },
  ])('omits the zero line at a displayed domain endpoint [$min, $max]', ({ min, max }) => {
    const { chart, container } = createChart({ yAxis: { min, max } })

    expect(container.querySelector('.waveform-zero-line')).toBeNull()
    expect(container.querySelector('.waveform-axis-y .tick')).not.toBeNull()
    chart.destroy()
  })

  it.each([
    { min: -1.37817027807236, max: 0.000914988843142055 },
    { min: -0.000914988843142055, max: 1.37817027807236 },
  ])('hides a zero line near either domain boundary by default [$min, $max]', ({ min, max }) => {
    const { chart, container } = createChart({ yAxis: { min, max } })

    expect(container.querySelector('.waveform-zero-line')).toBeNull()
    chart.destroy()
  })

  it('supports a configurable fraction of the selected axis tick interval and runtime updates', () => {
    const { chart, container } = createChart({ yAxis: { min: -10, max: 0.05, tickCount: 6 } })
    const zeroLine = () => container.querySelector('.waveform-zero-line')

    expect(zeroLine()).not.toBeNull() // 0.05 is more than 2% of the 2.01 tick interval.
    chart.updateOptions({ zeroLine: { boundaryThreshold: 0.03 } })
    expect(zeroLine()).toBeNull()
    chart.updateOptions({ zeroLine: { boundaryThreshold: 0 } })
    expect(zeroLine()).not.toBeNull()
    chart.updateOptions({ yAxis: { tickCount: 11 }, zeroLine: { boundaryThreshold: 0.03 } })
    expect(zeroLine()).not.toBeNull()
    chart.destroy()
  })

  it('uses the zero-line reference axis for the boundary threshold', () => {
    const { chart, container } = createChart(
      {
        yAxes: [
          { id: 'left', position: 'left', min: -10, max: 10 },
          { id: 'right', position: 'right', min: -10, max: 0.01 },
        ],
        zeroLine: { axisId: 'right' },
      },
      [
        { yAxis: 'left', data },
        {
          yAxis: 'right',
          data: [
            { x: 0, y: -10 },
            { x: 1, y: 0.01 },
          ],
        },
      ],
    )

    expect(container.querySelector('.waveform-zero-line')).toBeNull()
    chart.updateOptions({ zeroLine: { axisId: 'left' } })
    expect(container.querySelector('.waveform-zero-line')?.getAttribute('data-axis-id')).toBe(
      'left',
    )
    chart.destroy()
  })

  it('uses the displayed domain across data and option updates', () => {
    const { chart, container } = createChart({}, [
      { x: 0, y: 0 },
      { x: 1, y: 10 },
    ])
    const zeroLine = () => container.querySelector('.waveform-zero-line')

    expect(zeroLine()).toBeNull()
    chart.updateData([
      { x: 0, y: -10 },
      { x: 1, y: 0 },
    ])
    expect(zeroLine()).toBeNull()
    chart.updateData(data)
    expect(zeroLine()).not.toBeNull()
    chart.updateOptions({ zeroLine: { color: '#123456', width: 2, dash: '2 3' } })
    expect(zeroLine()?.getAttribute('stroke')).toBe('#123456')
    expect(zeroLine()?.getAttribute('stroke-width')).toBe('2')
    expect(zeroLine()?.getAttribute('stroke-dasharray')).toBe('2 3')

    for (const [min, max] of [
      [2, 10],
      [-10, -2],
      [0, 10],
      [-10, 0],
    ] as const) {
      chart.updateOptions({ yAxis: { min, max } })
      expect(zeroLine()).toBeNull()
    }
    chart.updateOptions({ yAxis: { min: -10, max: 10 } })
    expect(zeroLine()).not.toBeNull()
    chart.destroy()
  })

  it('uses the selected displayed axis rather than another crossing axis', () => {
    const { chart, container } = createChart(
      {
        yAxes: [
          { id: 'signed', position: 'left', min: -10, max: 10 },
          { id: 'endpoint', position: 'right', min: -10, max: 0 },
        ],
        zeroLine: { axisId: 'endpoint' },
      },
      [
        { yAxis: 'signed', data },
        {
          yAxis: 'endpoint',
          data: [
            { x: 0, y: -5 },
            { x: 1, y: 0 },
          ],
        },
      ],
    )
    const zeroLine = () => container.querySelector('.waveform-zero-line')

    expect(zeroLine()).toBeNull()
    chart.updateOptions({ zeroLine: { axisId: 'signed' } })
    expect(zeroLine()?.getAttribute('data-axis-id')).toBe('signed')
    chart.updateOptions({
      zeroLine: { axisId: 'endpoint' },
      yAxes: [
        { id: 'signed', position: 'left', min: -10, max: 10 },
        { id: 'endpoint', position: 'right', min: -10, max: 10 },
      ],
    })
    expect(zeroLine()?.getAttribute('data-axis-id')).toBe('endpoint')
    chart.destroy()
  })

  it('paints the zero line above all curves and markers after rendering and updates', () => {
    const { chart, container } = createChart({ point: { visible: true } })
    const expectZeroLineOnTop = (seriesCount: number) => {
      const zeroLine = container.querySelector('.waveform-zero-line')!
      expect(zeroLine).not.toBeNull()
      const seriesLayer = container.querySelector('g[clip-path]')!
      expect(seriesLayer.querySelectorAll(':scope > path')).toHaveLength(seriesCount)
      expect(seriesLayer.querySelectorAll('g path').length).toBeGreaterThan(0)
      expect(zeroLine.parentElement).toBe(seriesLayer.parentElement)
      expect(
        seriesLayer.compareDocumentPosition(zeroLine) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    }

    expectZeroLineOnTop(1)
    chart.updateData([
      { id: 'first', data },
      {
        id: 'second',
        data: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
      },
    ])
    expectZeroLineOnTop(2)
    chart.updateOptions({ zeroLine: { visible: false } })
    expect(container.querySelector('.waveform-zero-line')).toBeNull()
    chart.updateOptions({ zeroLine: { visible: true } })
    expectZeroLineOnTop(2)
    chart.destroy()
  })

  it.each(['rgba(255, 0, 0, 0.5)', '#ff000080'])(
    'preserves zero-line CSS alpha in %s and runtime updates',
    (color) => {
      const { chart, container } = createChart({ zeroLine: { color, opacity: 1, width: 2 } })
      const zeroLine = () => container.querySelector('.waveform-zero-line')!
      expect(zeroLine().getAttribute('stroke')).toBe(color)
      expect(zeroLine().getAttribute('stroke-opacity')).toBe('1')

      chart.updateOptions({ zeroLine: { color: '#00ff0080', opacity: 0.25 } })
      expect(zeroLine().getAttribute('stroke')).toBe('#00ff0080')
      expect(zeroLine().getAttribute('stroke-opacity')).toBe('0.25')
      expect(zeroLine().getAttribute('stroke-width')).toBe('2')
      chart.updateOptions({ zeroLine: { visible: false } })
      expect(zeroLine()).toBeNull()
      chart.updateOptions({ zeroLine: { visible: true } })
      expect(zeroLine().getAttribute('stroke')).toBe('#00ff0080')
      expect(zeroLine().getAttribute('stroke-opacity')).toBe('0.25')
      chart.destroy()
    },
  )

  it('uses the shared dashed style, color, and width for both grid axes', () => {
    const { container } = createChart({ grid: { style: 'dashed', color: '#123456', width: 2.5 } })

    for (const axis of ['x', 'y'] as const) {
      expect(firstGridLine(container, axis).getAttribute('stroke')).toBe('#123456')
      expect(firstGridLine(container, axis).getAttribute('stroke-width')).toBe('2.5')
      expect(firstGridLine(container, axis).getAttribute('stroke-dasharray')).toBe('3 3')
    }
  })

  it('renders shared solid grid lines without a dash attribute', () => {
    const { container } = createChart({ grid: { style: 'solid' } })

    expect(firstGridLine(container, 'x').getAttribute('stroke-dasharray')).toBeNull()
    expect(firstGridLine(container, 'y').getAttribute('stroke-dasharray')).toBeNull()
  })

  it('keeps legacy per-axis color, width, and dash overrides authoritative', () => {
    const { container } = createChart({
      grid: {
        style: 'solid',
        color: '#123456',
        width: 2.5,
        x: { color: '#abcdef', width: 3, dash: '1 2' },
        y: { color: '#fedcba', width: 4, dash: '4 5' },
      },
    })

    expect(firstGridLine(container, 'x').getAttribute('stroke')).toBe('#abcdef')
    expect(firstGridLine(container, 'x').getAttribute('stroke-width')).toBe('3')
    expect(firstGridLine(container, 'x').getAttribute('stroke-dasharray')).toBe('1 2')
    expect(firstGridLine(container, 'y').getAttribute('stroke')).toBe('#fedcba')
    expect(firstGridLine(container, 'y').getAttribute('stroke-width')).toBe('4')
    expect(firstGridLine(container, 'y').getAttribute('stroke-dasharray')).toBe('4 5')
  })

  it('updates the shared style, color, and width at runtime', () => {
    const { chart, container } = createChart()

    chart.updateOptions({ grid: { style: 'solid', color: '#123456', width: 2 } })

    for (const axis of ['x', 'y'] as const) {
      expect(firstGridLine(container, axis).getAttribute('stroke')).toBe('#123456')
      expect(firstGridLine(container, axis).getAttribute('stroke-width')).toBe('2')
      expect(firstGridLine(container, axis).getAttribute('stroke-dasharray')).toBeNull()
    }

    chart.updateOptions({ grid: { style: 'dashed', color: '#654321', width: 1.5 } })

    for (const axis of ['x', 'y'] as const) {
      expect(firstGridLine(container, axis).getAttribute('stroke')).toBe('#654321')
      expect(firstGridLine(container, axis).getAttribute('stroke-width')).toBe('1.5')
      expect(firstGridLine(container, axis).getAttribute('stroke-dasharray')).toBe('3 3')
    }
  })
})
