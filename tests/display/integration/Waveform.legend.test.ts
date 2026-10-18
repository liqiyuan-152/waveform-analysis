// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { Waveform } from '../../../src/display/Waveform'
import type { WaveformData } from '../../../src/display/types/data'
import type { WaveformOptions } from '../../../src/display/types/options'

const points = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
]

afterEach(() => {
  document.body.replaceChildren()
})

function createChart(data: WaveformData, options: WaveformOptions = {}) {
  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
  document.body.append(container)
  const chart = new Waveform(container, data, {
    responsive: { enabled: false },
    title: { visible: true, text: 'Waveform title' },
    legend: { visible: true, position: 'top-left', orientation: 'horizontal' },
    ...options,
  })
  return { chart, container }
}

function plotTransform(container: HTMLElement) {
  return container.querySelector('svg > g')?.getAttribute('transform')
}

function legendItems(container: HTMLElement) {
  return Array.from(container.querySelectorAll<SVGGElement>('.waveform-legend-item'))
}

function legendLabels(container: HTMLElement) {
  return legendItems(container).map((item) => item.querySelector('text')?.textContent)
}

function channelName(container: HTMLElement) {
  return container.querySelector<SVGTextElement>('.waveform-channel-name')
}

function yAxisTitle(container: HTMLElement, axisId = 'left') {
  return container.querySelector<SVGTextElement>(`.waveform-axis-y-title[data-axis-id="${axisId}"]`)
}

function legendPosition(item: SVGGElement): [number, number] {
  const match = item.getAttribute('transform')?.match(/translate\(([-\d.]+),([-\d.]+)\)/)
  return [Number(match?.[1]), Number(match?.[2])]
}

function legendItemWidth(item: SVGGElement): number {
  return Number(item.querySelector('rect')?.getAttribute('width')) - 8
}

function frameHorizontalBounds(container: HTMLElement): [number, number] {
  const plotX = Number(plotTransform(container)?.match(/translate\(([-\d.]+)/)?.[1])
  const frameWidth = Number(
    container.querySelector('.waveform-frame-border')?.getAttribute('width'),
  )
  return [plotX, plotX + frameWidth]
}

function plotTop(container: HTMLElement): number {
  return Number(plotTransform(container)?.match(/,([-\d.]+)\)/)?.[1])
}

function frameHeight(container: HTMLElement): number {
  return Number(container.querySelector('.waveform-frame-border')?.getAttribute('height'))
}

function namedSeries(names: string[]): WaveformData {
  return names.map((name, index) => ({ id: `series-${index}`, name, data: points }))
}

function legendRows(items: SVGGElement[]): Map<number, SVGGElement[]> {
  const rows = new Map<number, SVGGElement[]>()
  items.forEach((item) => {
    const y = legendPosition(item)[1]
    rows.set(y, [...(rows.get(y) ?? []), item])
  })
  return rows
}

function expectedMixedTextWidth(text: string, fontSize: number): number {
  return Array.from(text).reduce(
    (width, character) => width + fontSize * (/^[\u3400-\u9fff]$/u.test(character) ? 1 : 0.6),
    0,
  )
}

function lineColors(container: HTMLElement) {
  return Array.from(container.querySelectorAll('g[clip-path] > path')).map((path) =>
    path.getAttribute('stroke'),
  )
}

function pointColors(container: HTMLElement) {
  return Array.from(container.querySelectorAll('g[clip-path] > g > path')).map((path) =>
    path.getAttribute('fill'),
  )
}

function xEndpoints(container: HTMLElement) {
  return [
    container.querySelector('.waveform-axis-x-endpoint--start')?.textContent,
    container.querySelector('.waveform-axis-x-endpoint--end')?.textContent,
  ]
}

function yEndValue(container: HTMLElement, axisId = 'left') {
  return container.querySelector(`[data-axis-id="${axisId}"] .waveform-axis-y-end-value`)
    ?.textContent
}

describe('Waveform legend', () => {
  it('shows one effective channel name above the centered plot without a legend or Y-axis title', () => {
    const { container } = createChart(
      [
        { name: 'Visible', data: points },
        { name: 'Empty', data: [] },
      ],
      {
        yAxis: { title: { visible: true, text: 'Configured axis title' } },
      },
    )

    expect(container.querySelector('.waveform-legend')).toBeNull()
    expect(channelName(container)?.textContent).toBe('Visible')
    expect(channelName(container)?.getAttribute('x')).toBe('413.5')
    expect(channelName(container)?.getAttribute('y')).toBe('46')
    expect(channelName(container)?.getAttribute('text-anchor')).toBe('middle')
    expect(yAxisTitle(container)).toBeNull()
    expect(plotTransform(container)).toBe('translate(27,42)')
  })

  it('keeps a single channel name visible when the legend is explicitly disabled', () => {
    const { container } = createChart([{ data: points }], {
      title: { visible: false },
      legend: { visible: false },
    })

    expect(container.querySelector('.waveform-legend')).toBeNull()
    expect(channelName(container)?.textContent).toBe('Series 1')
    expect(channelName(container)?.getAttribute('y')).toBe('22')
    expect(plotTransform(container)).toBe('translate(27,42)')
  })

  it('keeps the no-title plot height stable when switching from a channel name to a legend', () => {
    const { chart, container } = createChart([{ name: '我是302测试', data: points }], {
      title: { visible: false },
      padding: { top: 32 },
    })
    const singleFrameHeight = frameHeight(container)

    expect(plotTop(container)).toBe(32)
    expect(channelName(container)?.getAttribute('y')).toBe('22')

    chart.updateData(namedSeries(['我是302测试', '我是247']))

    expect(plotTop(container)).toBe(32)
    expect(frameHeight(container)).toBe(singleFrameHeight)
    expect(legendPosition(legendItems(container)[0])[1]).toBe(22)
  })

  it('keeps the titled plot height stable when switching from a channel name to a legend', () => {
    const { chart, container } = createChart([{ name: 'First', data: points }], {
      padding: { top: 32 },
    })
    const singleFrameHeight = frameHeight(container)

    expect(plotTop(container)).toBe(32)
    expect(channelName(container)?.getAttribute('y')).toBe('46')

    chart.updateData(namedSeries(['First', 'Second']))

    expect(plotTop(container)).toBe(32)
    expect(frameHeight(container)).toBe(singleFrameHeight)
    expect(legendPosition(legendItems(container)[0])[1]).toBe(46)
  })

  it('renders additional top legend rows inside the plot without changing its top padding', () => {
    const { container } = createChart(
      namedSeries(['我是302测试', '我是247', '我是246', '我是245', '我是244']),
      {
        width: 360,
        title: { visible: false },
        padding: { top: 32 },
        legend: {
          position: 'top-left',
          orientation: 'horizontal',
          fontSize: 14,
          itemGap: 7,
          maxItemWidth: 90,
        },
      },
    )
    const items = legendItems(container)
    const rows = legendRows(items)
    const rowStep = 14 + 10 + 7
    const lastRowY = Math.max(...rows.keys())
    const lastItem = rows.get(lastRowY)![0]
    const hitTarget = lastItem.querySelector('rect')!
    const hitTargetBottom =
      lastRowY + Number(hitTarget.getAttribute('y')) + Number(hitTarget.getAttribute('height'))

    expect(rows.size).toBeGreaterThan(1)
    expect(plotTop(container)).toBe(32)
    expect(lastRowY).toBe(22 + (rows.size - 1) * rowStep)
    expect(hitTargetBottom).toBeGreaterThan(plotTop(container))
  })

  it('preserves the configured top padding when automatic padding is disabled', () => {
    const { chart, container } = createChart([{ name: 'First', data: points }], {
      title: { visible: false },
      layout: { autoPadding: false },
      padding: { top: 32 },
    })
    const singleFrameHeight = frameHeight(container)

    expect(plotTop(container)).toBe(32)

    chart.updateData(namedSeries(['First', 'Second']))

    expect(plotTop(container)).toBe(32)
    expect(frameHeight(container)).toBe(singleFrameHeight)
  })

  it('preserves a configured top padding larger than the automatic minimum', () => {
    const { chart, container } = createChart([{ name: 'First', data: points }], {
      title: { visible: false },
      padding: { top: 80 },
    })
    const singleFrameHeight = frameHeight(container)

    expect(plotTop(container)).toBe(80)

    chart.updateData(namedSeries(['First', 'Second']))

    expect(plotTop(container)).toBe(80)
    expect(frameHeight(container)).toBe(singleFrameHeight)
  })

  it('shows the legend and a derived Y-axis channel name for multiple series', () => {
    const { container } = createChart([
      { name: 'First', data: points },
      { name: 'Second', data: points },
    ])

    expect(container.querySelectorAll('.waveform-legend > g')).toHaveLength(2)
    expect(channelName(container)).toBeNull()
    expect(yAxisTitle(container)?.textContent).toBe('First')
    expect(plotTransform(container)).toBe('translate(51,42)')
  })

  it('prioritizes explicit Y-axis title text and visibility for multiple series', () => {
    const configured = createChart(namedSeries(['First', 'Second']), {
      yAxis: { title: { text: 'Configured' } },
    })
    const hidden = createChart(namedSeries(['First', 'Second']), {
      yAxis: { title: { visible: false } },
    })

    expect(yAxisTitle(configured.container)?.textContent).toBe('Configured')
    expect(yAxisTitle(hidden.container)).toBeNull()
  })

  it('derives the displayed same-side axis title from the first visible channel', () => {
    const { container } = createChart(
      [
        { id: 'first', name: 'First', yAxis: 'first-axis', data: points },
        { id: 'second', name: 'Second', yAxis: 'second-axis', data: points },
      ],
      {
        yAxes: [
          { id: 'first-axis', position: 'left' },
          { id: 'second-axis', position: 'left' },
        ],
      },
    )

    expect(yAxisTitle(container, 'first-axis')?.textContent).toBe('First')
    expect(yAxisTitle(container, 'second-axis')).toBeNull()

    legendItems(container)[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(yAxisTitle(container, 'first-axis')).toBeNull()
    expect(yAxisTitle(container, 'second-axis')?.textContent).toBe('Second')
    expect(channelName(container)).toBeNull()
  })

  it('wraps a top-left horizontal legend within the frame width', () => {
    const { container } = createChart(
      namedSeries(['First', 'Second', 'Third', 'Fourth', 'Fifth']),
      { width: 360 },
    )
    const items = legendItems(container)
    const [frameLeft, frameRight] = frameHorizontalBounds(container)
    const rows = legendRows(items)

    expect(rows.size).toBeGreaterThan(1)
    expect(Array.from(rows.values(), (row) => legendPosition(row[0])[0])).toEqual(
      Array.from(rows, () => frameLeft),
    )
    items.forEach((item) => {
      const [x] = legendPosition(item)
      expect(x).toBeGreaterThanOrEqual(frameLeft)
      expect(x + legendItemWidth(item)).toBeLessThanOrEqual(frameRight)
    })

    items[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(legendItems(container)[0].getAttribute('aria-pressed')).toBe('false')
    expect(lineColors(container)).toHaveLength(4)
  })

  it('keeps adjacent Chinese legend labels from covering each other', () => {
    const names = ['我是302测试', '我是247', '我是246']
    const itemGap = 8
    const { container } = createChart(namedSeries(names), {
      width: 800,
      legend: { position: 'top-left', orientation: 'horizontal', itemGap, maxItemWidth: 200 },
    })
    const items = legendItems(container)

    expect(legendLabels(container)).toEqual(names)
    expect(legendRows(items).size).toBe(1)
    items.slice(0, -1).forEach((item, index) => {
      const text = item.querySelector('text')!
      const renderedWidth =
        Number(text.getAttribute('x')) +
        expectedMixedTextWidth(names[index], Number(text.getAttribute('font-size'))) +
        8
      const previousX = legendPosition(item)[0]
      const nextX = legendPosition(items[index + 1])[0]
      expect(nextX).toBeGreaterThanOrEqual(previousX + renderedWidth + itemGap)
    })
  })

  it('wraps and truncates Chinese legend labels in a narrow container', () => {
    const names = ['我是302测试', '我是247', '我是246']
    const { container } = createChart(namedSeries(names), {
      width: 300,
      padding: { left: 54, right: 72 },
      legend: { position: 'top-left', orientation: 'horizontal', maxItemWidth: 90 },
    })
    const items = legendItems(container)
    const [frameLeft, frameRight] = frameHorizontalBounds(container)
    const yPositions = items.map((item) => legendPosition(item)[1])

    expect(legendRows(items).size).toBeGreaterThan(1)
    yPositions.slice(1).forEach((y, index) => {
      expect(y).toBeGreaterThan(yPositions[index])
    })
    items.forEach((item, index) => {
      const [x] = legendPosition(item)
      expect(x).toBeGreaterThanOrEqual(frameLeft)
      expect(x + legendItemWidth(item)).toBeLessThanOrEqual(frameRight)
      expect(legendItemWidth(item)).toBeLessThanOrEqual(90)
      expect(item.getAttribute('aria-label')).toBe(names[index])
    })
    expect(items[0].querySelector('text')?.textContent).toMatch(/…$/)
    expect(items[0].querySelector('title')?.textContent).toBe(names[0])
    expect(items[1].querySelector('text')?.textContent).toBe(names[1])
    expect(items[1].querySelector('title')).toBeNull()
  })

  it('limits individual legend item width and preserves the complete label', () => {
    const completeLabel = 'A very long waveform channel name that cannot fit in one legend item'
    const { container } = createChart(namedSeries([completeLabel, 'Second']), {
      legend: { maxItemWidth: 120 },
    })
    const firstItem = legendItems(container)[0]

    expect(legendItemWidth(firstItem)).toBeLessThanOrEqual(120)
    expect(firstItem.querySelector('text')?.textContent).toMatch(/…$/)
    expect(firstItem.querySelector('title')?.textContent).toBe(completeLabel)
    expect(firstItem.getAttribute('aria-label')).toBe(completeLabel)
  })

  it('keeps legend labels intact when they fit the configured item width', () => {
    const { container } = createChart(namedSeries(['Short', 'Second']), {
      legend: { maxItemWidth: 120 },
    })
    const firstItem = legendItems(container)[0]

    expect(firstItem.querySelector('text')?.textContent).toBe('Short')
    expect(firstItem.querySelector('title')).toBeNull()
  })

  it('right-aligns every row of a wrapped top-right horizontal legend', () => {
    const { container } = createChart(
      namedSeries(['First', 'Second', 'Third', 'Fourth', 'Fifth']),
      { width: 360, legend: { position: 'top-right', orientation: 'horizontal' } },
    )
    const [, frameRight] = frameHorizontalBounds(container)
    const rows = legendRows(legendItems(container))

    expect(rows.size).toBeGreaterThan(1)
    Array.from(rows.values()).forEach((row) => {
      const lastItem = row[row.length - 1]
      expect(legendPosition(lastItem)[0] + legendItemWidth(lastItem)).toBeCloseTo(frameRight)
    })
  })

  it.each(['bottom-left', 'bottom-right'] as const)(
    'expands a wrapped %s horizontal legend upward in reading order',
    (position) => {
      const { container } = createChart(
        namedSeries(['First', 'Second', 'Third', 'Fourth', 'Fifth']),
        { width: 360, legend: { position, orientation: 'horizontal' } },
      )
      const items = legendItems(container)
      const rows = legendRows(items)
      const rowYValues = Array.from(rows.keys())

      expect(rows.size).toBeGreaterThan(1)
      expect(legendPosition(items[0])[1]).toBe(Math.min(...rowYValues))
      expect(Math.max(...rowYValues)).toBe(302)

      const [frameLeft, frameRight] = frameHorizontalBounds(container)
      Array.from(rows.values()).forEach((row) => {
        const firstItem = row[0]
        const lastItem = row[row.length - 1]
        if (position === 'bottom-left') expect(legendPosition(firstItem)[0]).toBe(frameLeft)
        else expect(legendPosition(lastItem)[0] + legendItemWidth(lastItem)).toBeCloseTo(frameRight)
      })
    },
  )

  it('keeps a fitting horizontal legend on one row and leaves vertical layout unchanged', () => {
    const horizontal = createChart(namedSeries(['First', 'Second', 'Third']))
    const horizontalY = new Set(
      legendItems(horizontal.container).map((item) => legendPosition(item)[1]),
    )
    expect(horizontalY.size).toBe(1)

    const vertical = createChart(namedSeries(['First', 'Second', 'Third']), {
      width: 280,
      legend: { position: 'top-right', orientation: 'vertical' },
    })
    const verticalPositions = legendItems(vertical.container).map(legendPosition)
    expect(new Set(verticalPositions.map(([x]) => x)).size).toBe(1)
    expect(verticalPositions.map(([, y]) => y)).toEqual([22, 52, 82])
  })

  it('appends normalized shot numbers only when multiple shots are present', () => {
    const { chart, container } = createChart([
      { id: 'first', name: 'First', shot: 10001, data: points },
      { id: 'second', name: 'Second', shot: ' 10001 ', data: points },
    ])

    expect(legendLabels(container)).toEqual(['First', 'Second'])
    const singleShotWidth = Number(
      legendItems(container)[0].querySelector('rect')?.getAttribute('width'),
    )

    chart.updateData([
      { id: 'first', name: 'First', shot: 10001, data: points },
      { id: 'second', name: 'Second', shot: ' 10002 ', data: points },
      { id: 'missing', name: 'Missing', data: points },
      { id: 'empty', name: 'Empty', shot: '   ', data: points },
      { id: 'invalid', name: 'Invalid', shot: Number.NaN, data: points },
    ])

    expect(legendLabels(container)).toEqual([
      'First (10001)',
      'Second (10002)',
      'Missing',
      'Empty',
      'Invalid',
    ])
    expect(legendItems(container).map((item) => item.getAttribute('aria-label'))).toEqual(
      legendLabels(container),
    )
    expect(
      Number(legendItems(container)[0].querySelector('rect')?.getAttribute('width')),
    ).toBeGreaterThan(singleShotWidth)

    legendItems(container)[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(legendLabels(container)).toEqual([
      'First (10001)',
      'Second (10002)',
      'Missing',
      'Empty',
      'Invalid',
    ])
  })

  it('keeps the legend hidden when explicitly disabled for multiple series', () => {
    const { container } = createChart(
      [
        { name: 'First', data: points },
        { name: 'Second', data: points },
      ],
      { legend: { visible: false } },
    )

    expect(container.querySelector('.waveform-legend')).toBeNull()
    expect(yAxisTitle(container)?.textContent).toBe('First')
    expect(plotTransform(container)).toBe('translate(51,42)')
  })

  it('updates legend visibility and padding when the series count changes', () => {
    const { chart, container } = createChart([{ name: 'First', data: points }])

    expect(container.querySelector('.waveform-legend')).toBeNull()
    expect(channelName(container)?.textContent).toBe('First')
    expect(plotTransform(container)).toBe('translate(27,42)')

    chart.updateData([
      { name: 'First', data: points },
      { name: 'Second', data: points },
    ])
    expect(container.querySelectorAll('.waveform-legend > g')).toHaveLength(2)
    expect(channelName(container)).toBeNull()
    expect(yAxisTitle(container)?.textContent).toBe('First')
    expect(plotTransform(container)).toBe('translate(51,42)')

    chart.updateData([{ name: 'First', data: points }])
    expect(container.querySelector('.waveform-legend')).toBeNull()
    expect(channelName(container)?.textContent).toBe('First')
    expect(yAxisTitle(container)).toBeNull()
    expect(plotTransform(container)).toBe('translate(27,42)')
  })

  it('toggles the related line and points while keeping the legend item available', () => {
    const { container } = createChart([
      {
        id: 'first',
        name: 'First',
        data: points,
        style: { color: '#dc2626', point: { visible: true, color: '#dc2626' } },
      },
      {
        id: 'second',
        name: 'Second',
        data: points,
        style: { color: '#2563eb', point: { visible: true, color: '#2563eb' } },
      },
    ])

    expect(lineColors(container)).toEqual(['#dc2626', '#2563eb'])
    expect(pointColors(container)).toEqual(['#dc2626', '#dc2626', '#2563eb', '#2563eb'])

    legendItems(container)[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(lineColors(container)).toEqual(['#2563eb'])
    expect(pointColors(container)).toEqual(['#2563eb', '#2563eb'])
    expect(channelName(container)).toBeNull()
    expect(yAxisTitle(container)?.textContent).toBe('Second')
    expect(legendItems(container)).toHaveLength(2)
    expect(legendItems(container)[0].getAttribute('aria-pressed')).toBe('false')
    expect(legendItems(container)[0].querySelector('line')?.getAttribute('opacity')).toBe('0.35')
    expect(legendItems(container)[0].querySelector('text')?.getAttribute('opacity')).toBe('0.35')

    legendItems(container)[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(lineColors(container)).toEqual(['#dc2626', '#2563eb'])
    expect(legendItems(container)[0].getAttribute('aria-pressed')).toBe('true')
  })

  it('hides a value axis when none of its corresponding series are visible', () => {
    const { container } = createChart(
      [
        { id: 'left', name: 'Left', data: points },
        { id: 'right', name: 'Right', yAxis: 'right', data: points },
      ],
      { secondaryYAxis: { visible: true } },
    )

    expect(container.querySelector('.waveform-axis-y[data-axis-id="left"]')).not.toBeNull()
    expect(container.querySelector('.waveform-axis-y[data-axis-id="right"]')).not.toBeNull()

    legendItems(container)[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(container.querySelector('.waveform-axis-y[data-axis-id="left"]')).toBeNull()
    expect(container.querySelector('.waveform-axis-y[data-axis-id="right"]')).not.toBeNull()
  })

  it('exposes an accessible hit target and supports keyboard toggling', () => {
    const { container } = createChart([
      { id: 'first', name: 'First', data: points },
      { id: 'second', name: 'Second', data: points },
    ])
    const firstItem = legendItems(container)[0]

    expect(firstItem.getAttribute('role')).toBe('button')
    expect(firstItem.getAttribute('tabindex')).toBe('0')
    expect(firstItem.getAttribute('aria-label')).toBe('First')
    expect(firstItem.style.cursor).toBe('pointer')
    expect(Number(firstItem.querySelector('rect')?.getAttribute('width'))).toBeGreaterThan(24)

    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
    firstItem.dispatchEvent(space)
    expect(space.defaultPrevented).toBe(true)
    expect(lineColors(container)).toHaveLength(1)

    legendItems(container)[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    )
    expect(lineColors(container)).toHaveLength(2)
  })

  it('recalculates X and independent Y domains from visible series', () => {
    const { container } = createChart(
      [
        {
          id: 'wide',
          name: 'Wide',
          yAxis: 'left',
          data: [
            { x: 0, y: 0 },
            { x: 100, y: 100 },
          ],
        },
        {
          id: 'narrow',
          name: 'Narrow',
          yAxis: 'left',
          data: [
            { x: 10, y: 10 },
            { x: 20, y: 20 },
          ],
        },
        {
          id: 'right',
          name: 'Right',
          yAxis: 'right',
          data: [
            { x: 10, y: 100 },
            { x: 20, y: 200 },
          ],
        },
      ],
      {
        yAxes: [
          { id: 'left', position: 'left' },
          { id: 'right', position: 'right' },
        ],
      },
    )

    expect(xEndpoints(container)).toEqual(['0', '100'])
    expect(yEndValue(container, 'left')).toBe('100')
    expect(yEndValue(container, 'right')).toBe('200')

    legendItems(container)[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(xEndpoints(container)).toEqual(['10', '20'])
    expect(yEndValue(container, 'left')).toBe('20')
    expect(yEndValue(container, 'right')).toBe('200')
  })

  it('keeps the legend usable and falls back to empty domains when all series are hidden', () => {
    const { container } = createChart([
      { id: 'first', name: 'First', data: points },
      { id: 'second', name: 'Second', data: points },
    ])

    legendItems(container)[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    legendItems(container)[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(lineColors(container)).toHaveLength(0)
    expect(legendItems(container)).toHaveLength(2)
    expect(
      legendItems(container).every((item) => item.getAttribute('aria-pressed') === 'false'),
    ).toBe(true)
    expect(xEndpoints(container)).toEqual(['0', '1'])
    expect(container.querySelector('.waveform-axis-y')).toBeNull()
    expect(container.textContent).not.toContain('No waveform data')
  })

  it('preserves hidden state across updates by id and normalized position', () => {
    const identified = createChart([
      { id: 'first', name: 'First', order: 1, data: points, style: { color: '#dc2626' } },
      { id: 'second', name: 'Second', order: 2, data: points, style: { color: '#2563eb' } },
    ])
    legendItems(identified.container)[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))

    identified.chart.updateData([
      { id: 'second', name: 'Second', order: 1, data: points, style: { color: '#2563eb' } },
      { id: 'first', name: 'First', order: 2, data: points, style: { color: '#dc2626' } },
    ])

    expect(lineColors(identified.container)).toEqual(['#2563eb'])
    expect(
      legendItems(identified.container).map((item) => item.getAttribute('aria-pressed')),
    ).toEqual(['true', 'false'])

    const positional = createChart([
      { name: 'First', data: points, style: { color: '#16a34a' } },
      { name: 'Second', data: points, style: { color: '#9333ea' } },
    ])
    legendItems(positional.container)[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    positional.chart.updateData([
      { name: 'Replacement', data: points, style: { color: '#f97316' } },
      { name: 'Second', data: points, style: { color: '#9333ea' } },
    ])

    expect(lineColors(positional.container)).toEqual(['#9333ea'])
    expect(legendItems(positional.container)[0].getAttribute('aria-pressed')).toBe('false')
  })

  it('distinguishes duplicate ids and preserves selection through option updates', () => {
    const { chart, container } = createChart([
      { id: 'duplicate', name: 'First', data: points, style: { color: '#dc2626' } },
      { id: 'duplicate', name: 'Second', data: points, style: { color: '#2563eb' } },
    ])

    expect(legendItems(container).map((item) => item.getAttribute('data-series-key'))).toEqual([
      'id:duplicate:0',
      'id:duplicate:1',
    ])
    legendItems(container)[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    chart.updateOptions({ legend: { color: '#111827' } })

    expect(lineColors(container)).toEqual(['#dc2626'])
    expect(legendItems(container).map((item) => item.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
    ])
    expect(legendItems(container)[1].querySelector('text')?.getAttribute('fill')).toBe('#111827')
  })

  it('clears hidden state for series that disappear from updateData', () => {
    const { chart, container } = createChart([
      { id: 'first', name: 'First', data: points, style: { color: '#dc2626' } },
      { id: 'second', name: 'Second', data: points, style: { color: '#2563eb' } },
    ])
    legendItems(container)[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))

    chart.updateData([{ id: 'second', name: 'Second', data: points, style: { color: '#2563eb' } }])
    chart.updateData([
      { id: 'first', name: 'First', data: points, style: { color: '#dc2626' } },
      { id: 'second', name: 'Second', data: points, style: { color: '#2563eb' } },
    ])

    expect(lineColors(container)).toEqual(['#dc2626', '#2563eb'])
    expect(
      legendItems(container).every((item) => item.getAttribute('aria-pressed') === 'true'),
    ).toBe(true)

    legendItems(container)[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    chart.updateData([])
    chart.updateData([
      { id: 'first', name: 'First', data: points, style: { color: '#dc2626' } },
      { id: 'second', name: 'Second', data: points, style: { color: '#2563eb' } },
    ])

    expect(lineColors(container)).toEqual(['#dc2626', '#2563eb'])
  })
})
