// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import {
  Waveform,
  type WaveformOptions,
  type WaveformSeries,
  type WaveformSeriesStyle,
} from '../../../src/display/index'

const charts: Waveform[] = []
afterEach(() => {
  charts.splice(0).forEach((chart) => chart.destroy())
  document.body.replaceChildren()
})

const data = [
  { x: 0, y: 0 },
  { x: 1, y: 2 },
  { x: 2, y: 1 },
]
const custom: WaveformSeriesStyle = {
  color: '#abcdef',
  lineWidth: 7,
  lineType: 'step-start',
  lineStyle: 'dash-dot',
  opacity: 0.8,
  point: {
    visible: true,
    type: 'square',
    size: 7,
    color: '#fedcba',
    borderColor: '#654321',
    borderWidth: 4,
  },
}
const globalOptions: WaveformOptions = {
  width: 800,
  height: 400,
  responsive: { enabled: false },
  animationEnabled: false,
  line: { color: '#123456', width: 3, type: 'step-end', style: 'dashed', opacity: 0.4 },
  point: {
    visible: true,
    type: 'triangle',
    size: 4,
    color: '#112233',
    borderColor: '#445566',
    borderWidth: 2,
  },
}

function setup() {
  const host = document.createElement('div')
  document.body.append(host)
  const series: WaveformSeries[] = [
    { id: 'edited', name: 'Edited', data, style: structuredClone(custom) },
    { id: 'peer', name: 'Peer', data, style: structuredClone(custom) },
    { id: 'reference', name: 'Reference', data },
  ]
  const chart = new Waveform(host, series, globalOptions)
  charts.push(chart)
  const paths = () => Array.from(host.querySelectorAll<SVGPathElement>('g[clip-path] > path'))
  const pointGroups = () => Array.from(host.querySelectorAll<SVGGElement>('g[clip-path] > g'))
  return { chart, host, series, paths, pointGroups }
}

describe('per-series style inheritance', () => {
  it.each([
    ['color', 'stroke', { color: '#998877' }],
    ['lineWidth', 'stroke-width', { width: 5 }],
    ['lineType', 'd', { type: 'step-middle' }],
    ['lineStyle', 'stroke-dasharray', { style: 'solid' }],
    ['opacity', 'stroke-opacity', { opacity: 0.2 }],
  ] as const)(
    'inherits cleared %s and follows later global updates without affecting peers',
    (key, attribute, next) => {
      const t = setup()
      const peerBefore = t.paths()[1].getAttribute(attribute)
      expect(t.paths()[0].getAttribute(attribute)).not.toBe(t.paths()[2].getAttribute(attribute))
      t.series[0].style = { ...t.series[0].style, [key]: undefined }
      t.chart.updateData(t.series)
      expect(t.paths()[0].getAttribute(attribute)).toBe(t.paths()[2].getAttribute(attribute))
      t.chart.updateOptions({ line: next })
      expect(t.paths()[0].getAttribute(attribute)).toBe(t.paths()[2].getAttribute(attribute))
      expect(t.paths()[1].getAttribute(attribute)).toBe(peerBefore)
      expect(t.paths()[0].getAttribute('stroke-width')).toBe(key === 'lineWidth' ? '5' : '7')
    },
  )

  it.each([
    ['type', 'd', { type: 'diamond' }],
    ['size', 'd', { size: 2 }],
    ['color', 'fill', { color: '#998877' }],
    ['borderColor', 'stroke', { borderColor: '#887766' }],
    ['borderWidth', 'stroke-width', { borderWidth: 0 }],
  ] as const)(
    'inherits cleared point %s and follows later global updates without affecting peers',
    (key, attribute, next) => {
      const t = setup()
      const edited = () => t.pointGroups()[0].querySelector('path')!
      const peer = () => t.pointGroups()[1].querySelector('path')!
      const reference = () => t.pointGroups()[2].querySelector('path')!
      const peerBefore = peer().getAttribute(attribute)
      t.series[0].style = {
        ...t.series[0].style,
        point: { ...t.series[0].style?.point, [key]: undefined },
      }
      t.chart.updateData(t.series)
      // Shape and size depend on one another: give the reference the same other fields.
      const referencePoint = { ...custom.point }
      delete referencePoint[key]
      t.series[2].style = { point: referencePoint }
      t.chart.updateData(t.series)
      expect(edited().getAttribute(attribute)).toBe(reference().getAttribute(attribute))
      t.chart.updateOptions({ point: next })
      expect(edited().getAttribute(attribute)).toBe(reference().getAttribute(attribute))
      expect(peer().getAttribute(attribute)).toBe(peerBefore)
      expect(edited().getAttribute(attribute)).not.toContain('NaN')
    },
  )

  it('inherits point visibility but preserves an explicit false override', () => {
    const t = setup()
    t.series[0].style = { point: { visible: undefined } }
    t.chart.updateData(t.series)
    expect(t.pointGroups()).toHaveLength(3)
    t.chart.updateOptions({ point: { visible: false } })
    expect(t.pointGroups()).toHaveLength(1)
    expect(t.pointGroups()[0].querySelector('path')?.getAttribute('fill')).toBe(custom.point?.color)
    t.series[0].style = { point: { visible: false } }
    t.chart.updateData(t.series)
    t.chart.updateOptions({ point: { visible: true } })
    expect(t.pointGroups()).toHaveLength(2)
  })

  it('preserves explicit zero width, opacity, point size and border width in SVG and export', () => {
    const t = setup()
    t.series[0].style = { lineWidth: 0, opacity: 0, point: { size: 0, borderWidth: 0 } }
    t.chart.updateData(t.series)
    expect(t.paths()[0].getAttribute('stroke-width')).toBe('0')
    expect(t.paths()[0].getAttribute('stroke-opacity')).toBe('0')
    expect(t.pointGroups()[0].querySelector('path')?.getAttribute('stroke-width')).toBe('0')
    expect(t.host.querySelector('.waveform-legend-item line')?.getAttribute('stroke-width')).toBe(
      '0',
    )
    const exported = new DOMParser().parseFromString(t.chart.toSVGString(), 'image/svg+xml')
    expect(exported.querySelector('.waveform-legend-item line')?.getAttribute('stroke-width')).toBe(
      '0',
    )
    expect(t.series[0].style?.point?.size).toBe(0)
  })
})
