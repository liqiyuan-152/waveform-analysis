// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import {
  Waveform,
  type WaveformLineType,
  type WaveformPointType,
  type WaveformSeries,
} from '../../../src/display/index'

const charts: Waveform[] = []
afterEach(() => {
  charts.splice(0).forEach((chart) => chart.destroy())
  document.body.replaceChildren()
})

// The fixed 200 × 120 plot and [0, 2] domains map these to (0,120), (100,0), (200,60).
const data = [
  { x: 0, y: 0 },
  { x: 1, y: 2 },
  { x: 2, y: 1 },
]
const linePaths: Record<WaveformLineType, string> = {
  linear: 'M0,120L100,0L200,60',
  'step-start': 'M0,120L0,0L100,0L100,60L200,60',
  'step-middle': 'M0,120L50,120L50,0L150,0L150,60L200,60',
  'step-end': 'M0,120L100,120L100,0L200,0L200,60',
}

function setup() {
  const host = document.createElement('div')
  document.body.append(host)
  const series: WaveformSeries[] = [
    {
      id: 'edited',
      name: 'Edited',
      data,
      style: { lineType: 'step-start', point: { type: 'square', size: 7 } },
    },
    {
      id: 'peer',
      name: 'Peer',
      data,
      style: { lineType: 'step-end', point: { type: 'square', size: 7 } },
    },
  ]
  const chart = new Waveform(host, series, {
    width: 240,
    height: 160,
    responsive: { enabled: false },
    animationEnabled: false,
    layout: { autoPadding: false },
    padding: { top: 20, right: 20, bottom: 20, left: 20 },
    xAxis: { min: 0, max: 2 },
    yAxis: { min: 0, max: 2, tickStrategy: 'legacy' },
    xDomainStrategy: { type: 'data' },
    legend: { visible: false },
    point: { visible: true, size: 4 },
  })
  charts.push(chart)
  const lines = () => Array.from(host.querySelectorAll<SVGPathElement>('g[clip-path] > path'))
  const points = (index: number) =>
    Array.from(
      host.querySelectorAll('g[clip-path] > g')[index].querySelectorAll<SVGPathElement>('path'),
    )
  return { host, chart, series, lines, points }
}

function polygonVertices(path: string): number[][] {
  expect(path).toMatch(/^M.*Z$/)
  return path
    .slice(1, -1)
    .split('L')
    .map((pair) => pair.split(',').map(Number))
}

function area(vertices: number[][]): number {
  return (
    Math.abs(
      vertices.reduce((sum, [x, y], index) => {
        const [nextX, nextY] = vertices[(index + 1) % vertices.length]
        return sum + x * nextY - y * nextX
      }, 0),
    ) / 2
  )
}

function expectSymbol(path: string, type: WaveformPointType, size: number) {
  const expectedArea = 4 * size ** 2
  if (type === 'circle') {
    if (size === 0) {
      expect(path).toBe('M0,0')
      return
    }
    // Two semicircular arcs, with a radius derived from A = πr², not another renderer.
    const radius = Math.sqrt(expectedArea / Math.PI)
    const rounded = Number(radius.toFixed(3))
    expect(path).toBe(
      `M${rounded},0A${rounded},${rounded},0,1,1,${-rounded},0A${rounded},${rounded},0,1,1,${rounded},0`,
    )
    return
  }
  if (type === 'square') {
    const side = 2 * size
    expect(path).toBe(`M${-size},${-size}h${side}v${side}h${-side}Z`)
    return
  }
  const vertices = polygonVertices(path)
  let expected: number[][]
  if (type === 'triangle') {
    const height = Math.sqrt(expectedArea * Math.sqrt(3))
    const halfBase = height / Math.sqrt(3)
    expected = [
      [0, (-2 * height) / 3],
      [halfBase, height / 3],
      [-halfBase, height / 3],
    ]
  } else {
    const halfHeight = Math.sqrt((expectedArea * Math.sqrt(3)) / 2)
    const halfWidth = halfHeight / Math.sqrt(3)
    expected = [
      [0, -halfHeight],
      [halfWidth, 0],
      [0, halfHeight],
      [-halfWidth, 0],
    ]
  }
  expect(vertices).toHaveLength(expected.length)
  vertices.forEach((pair, index) =>
    pair.forEach((value, axis) => {
      expect(Math.abs(value - expected[index][axis])).toBeLessThanOrEqual(0.00051)
    }),
  )
  // Serialization rounds each coordinate to .001; the area tolerance accounts for all vertices.
  expect(Math.abs(area(vertices) - expectedArea)).toBeLessThanOrEqual(0.03)
}

describe('independent geometry oracle for control accuracy (OpenSpec 2.2 / 2.6)', () => {
  it.each(Object.keys(linePaths) as WaveformLineType[])(
    'maps inherited %s to explicit target vertices and preserves the peer',
    (type) => {
      const t = setup()
      expect(t.host.querySelector('svg > g')?.getAttribute('transform')).toBe('translate(20,20)')
      t.series[0].style = { ...t.series[0].style, lineType: undefined }
      t.chart.updateData(t.series)
      t.chart.updateOptions({ line: { type } })
      expect(t.lines()[0].getAttribute('d')).toBe(linePaths[type])
      expect(t.lines()[1].getAttribute('d')).toBe(linePaths['step-end'])
      t.chart.updateOptions({ line: { type: 'linear' } })
      expect(t.lines()[0].getAttribute('d')).toBe(linePaths.linear)
      expect(t.lines()[1].getAttribute('d')).toBe(linePaths['step-end'])
    },
  )

  it.each(['circle', 'square', 'triangle', 'diamond'] as const)(
    'checks inherited %s placement, area, zero size and restoration',
    (type) => {
      const t = setup()
      t.series[0].style = { point: { type: undefined, size: undefined } }
      t.chart.updateData(t.series)
      t.chart.updateOptions({ point: { type, size: 4 } })
      expect(t.points(0).map((point) => point.getAttribute('transform'))).toEqual([
        'translate(0,120)',
        'translate(100,0)',
        'translate(200,60)',
      ])
      for (const size of [4, 0, 2.5, 4]) {
        t.chart.updateOptions({ point: { size } })
        t.points(0).forEach((point) => expectSymbol(point.getAttribute('d')!, type, size))
        t.points(1).forEach((point) => expectSymbol(point.getAttribute('d')!, 'square', 7))
      }
      // An explicit zero must still win when a later global value becomes nonzero.
      t.series[0].style = { point: { type, size: 0, borderWidth: 0 } }
      t.chart.updateData(t.series)
      t.chart.updateOptions({ point: { size: 6 } })
      t.points(0).forEach((point) => {
        expectSymbol(point.getAttribute('d')!, type, 0)
        expect(point.getAttribute('stroke-width')).toBe('0')
      })
      const exported = new DOMParser().parseFromString(t.chart.toSVGString(), 'image/svg+xml')
      const exportedPoints = exported.querySelectorAll('g[clip-path] > g:first-of-type > path')
      expect(exportedPoints).toHaveLength(3)
      exportedPoints.forEach((point) => {
        expectSymbol(point.getAttribute('d')!, type, 0)
      })
      t.series[0].style = { point: { visible: false } }
      t.chart.updateData(t.series)
      expect(t.host.querySelectorAll('g[clip-path] > g')).toHaveLength(1)
      t.chart.updateOptions({ point: { visible: false } })
      expect(t.host.querySelectorAll('g[clip-path] > g')).toHaveLength(0)
    },
  )
})
