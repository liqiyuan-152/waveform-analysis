// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { Waveform } from '../../../src/display/Waveform'
import type { WaveformData } from '../../../src/display/types/data'
import type { WaveformOptions } from '../../../src/display/types/options'

afterEach(() => {
  document.body.replaceChildren()
})

function render(data: WaveformData, options: WaveformOptions = {}) {
  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
  document.body.append(container)
  new Waveform(container, data, { responsive: { enabled: false }, ...options })
  return container.querySelector('svg')!
}

function labels(svg: SVGSVGElement, selector: string): string[] {
  return Array.from(
    svg.querySelectorAll(`${selector} .tick text`),
    (node) => node.textContent ?? '',
  )
}

function seriesPathPoints(svg: SVGSVGElement, index = 0): Array<[number, number]> {
  const path = svg.querySelectorAll('g[clip-path] > path')[index]
  const data = path?.getAttribute('d') ?? ''
  return Array.from(
    data.matchAll(
      /[ML](-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?),(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)/gi,
    ),
    (match) => [Number(match[1]), Number(match[2])],
  )
}

function frameHeight(svg: SVGSVGElement): number {
  return Number(svg.querySelector('.waveform-frame-border')?.getAttribute('height'))
}

function endpointLabels(svg: SVGSVGElement): [string, string] {
  return [
    svg.querySelector('.waveform-axis-x-endpoint--start')?.textContent ?? '',
    svg.querySelector('.waveform-axis-x-endpoint--end')?.textContent ?? '',
  ]
}

function translateX(element: Element): number {
  return Number(element.getAttribute('transform')?.match(/translate\((-?[\d.]+)/)?.[1])
}

function tickData(svg: SVGSVGElement, selector: string): number[] {
  return Array.from(svg.querySelectorAll<SVGGElement>(`${selector} .tick`), (tick) =>
    Number((tick as SVGGElement & { __data__: unknown }).__data__),
  )
}

describe('Waveform axes', () => {
  it('pins the exact final X-domain values to both frame endpoints by default', () => {
    const svg = render([
      { x: 0.125, y: 0 },
      { x: 1.875, y: 1 },
    ])
    const start = svg.querySelector('.waveform-axis-x-endpoint--start')!
    const end = svg.querySelector('.waveform-axis-x-endpoint--end')!
    const frameWidth = svg.querySelector('.waveform-frame-border')!.getAttribute('width')

    expect(endpointLabels(svg)).toEqual(['0.125', '1.875'])
    expect(start.getAttribute('x')).toBe('0')
    expect(start.getAttribute('text-anchor')).toBe('middle')
    expect(end.getAttribute('x')).toBe(frameWidth)
    expect(end.getAttribute('text-anchor')).toBe('middle')
    expect(start.getAttribute('y')).toBe(
      svg.querySelector('.waveform-axis-x .tick text')?.getAttribute('y'),
    )
    expect(start.getAttribute('dy')).toBe(
      svg.querySelector('.waveform-axis-x .tick text')?.getAttribute('dy'),
    )
  })

  it('renders a nice automatic X domain when configured', () => {
    const svg = render(
      [
        { x: 0.123, y: 0 },
        { x: 4.999999, y: 1 },
      ],
      {
        xDomainStrategy: { type: 'nice', bounds: 'both', tickCount: 10 },
        xAxis: { hideEndTicks: false, tickCount: 10 },
      },
    )

    expect(endpointLabels(svg)).toEqual(['0', '5'])
    expect(labels(svg, '.waveform-axis-x')).not.toContain('5')
  })

  it('uses partial and complete explicit X domains', () => {
    const partial = render(
      [
        { x: 1, y: 0 },
        { x: 4, y: 1 },
      ],
      { xAxis: { min: -5 } },
    )
    const complete = render(
      [
        { x: 1, y: 0 },
        { x: 4, y: 1 },
      ],
      { xAxis: { min: -10, max: 20 } },
    )

    expect(endpointLabels(partial)).toEqual(['-5', '4'])
    expect(endpointLabels(complete)).toEqual(['-10', '20'])
  })

  it('uses a zero-aligned X tick step for both the axis and grid', () => {
    const svg = render(
      [
        { x: 3, y: 0 },
        { x: 23, y: 1 },
      ],
      { xAxis: { tickStep: 5, tickCount: 2, showEndValues: false } },
    )
    const expected = [5, 10, 15, 20]

    expect(tickData(svg, '.waveform-axis-x')).toEqual(expected)
    expect(tickData(svg, '.waveform-grid-x')).toEqual(expected)
    expect(labels(svg, '.waveform-axis-x')).toEqual(expected.map(String))
  })

  it('keeps exact endpoints while omitting regular ticks for an oversized step', () => {
    const svg = render(
      [
        { x: 3, y: 0 },
        { x: 23, y: 1 },
      ],
      { xAxis: { tickStep: 100 } },
    )

    expect(endpointLabels(svg)).toEqual(['3', '23'])
    expect(tickData(svg, '.waveform-axis-x')).toEqual([])
    expect(tickData(svg, '.waveform-grid-x')).toEqual([])
  })

  it('expands a single-point domain before displaying its endpoints', () => {
    const svg = render([{ x: 5, y: 2 }])

    expect(endpointLabels(svg)).toEqual(['4', '6'])
  })

  it('formats endpoint values with D3 strings, custom functions, and units', () => {
    const formatted = render(
      [
        { x: 0.125, y: 0 },
        { x: 1.875, y: 1 },
      ],
      { xAxis: { tickFormat: '.2f', unit: 'ms' } },
    )
    const custom = render(
      [
        { x: 0.125, y: 0 },
        { x: 1.875, y: 1 },
      ],
      { xAxis: { tickFormat: (value) => `x:${value}` } },
    )

    expect(endpointLabels(formatted)).toEqual(['0.13', '1.88'])
    expect(endpointLabels(custom)).toEqual(['x:0.125', 'x:1.875'])
    expect(labels(formatted, '.waveform-axis-x').every((label) => /^\d+\.\d{2}$/.test(label))).toBe(
      true,
    )
  })

  it('appends units when no explicit formatter overrides the default', () => {
    const svg = render(
      [
        { x: 0, y: 0 },
        { x: 2, y: 1 },
      ],
      { xAxis: { unit: 'ms' } },
    )

    expect(endpointLabels(svg)).toEqual(['0 ms', '2 ms'])
  })

  it('keeps middle ticks clear of endpoints without removing grid lines', () => {
    const svg = render(
      [
        { x: 0, y: 0 },
        { x: 100, y: 1 },
      ],
      { xAxis: { tickCount: 10, tickFormat: (value) => `value:${value.toFixed(2)}` } },
    )
    const frameWidth = Number(svg.querySelector('.waveform-frame-border')!.getAttribute('width'))
    const tickPositions = Array.from(svg.querySelectorAll('.waveform-axis-x .tick')).map((tick) =>
      Number(tick.getAttribute('transform')?.match(/translate\(([^,]+)/)?.[1]),
    )
    const regularTickCount = svg.querySelectorAll('.waveform-axis-x .tick').length
    const gridLineCount = svg.querySelectorAll('.waveform-grid-x .tick line').length

    expect(tickPositions.every((position) => position > 70 && position < frameWidth - 70)).toBe(
      true,
    )
    expect(gridLineCount).toBeGreaterThan(regularTickCount)
  })

  it('shows a near-end X tick when both centered labels fit', () => {
    const svg = render(
      [
        { x: -63, y: 0 },
        { x: -0.1, y: 1 },
      ],
      { xAxis: { tickCount: 13, fontSize: 26 } },
    )

    expect(endpointLabels(svg)).toEqual(['-63', '-0.1'])
    expect(labels(svg, '.waveform-axis-x')).toContain('-5')
    expect(tickData(svg, '.waveform-grid-x')).toContain(-5)
  })

  it('hides near-end X labels only when they overlap an endpoint', () => {
    const data = [
      { x: -63, y: 0 },
      { x: -0.1, y: 1 },
    ]
    const narrow = render(data, { width: 520, xAxis: { tickCount: 13, fontSize: 26 } })
    const longEndpoint = render(data, {
      xAxis: {
        tickCount: 13,
        fontSize: 26,
        tickFormat: (value) => (value === -0.1 ? 'end: -0.1 ms' : String(value)),
      },
    })

    expect(labels(narrow, '.waveform-axis-x')).not.toContain('-5')
    expect(tickData(narrow, '.waveform-grid-x')).toContain(-5)
    expect(labels(longEndpoint, '.waveform-axis-x')).not.toContain('-5')
    expect(tickData(longEndpoint, '.waveform-grid-x')).toContain(-5)
  })

  it('applies the same centered-label clearance at the left endpoint', () => {
    const svg = render(
      [
        { x: -0.1, y: 0 },
        { x: 63, y: 1 },
      ],
      { xAxis: { tickCount: 13, fontSize: 26 } },
    )

    expect(labels(svg, '.waveform-axis-x')).toContain('5')
    expect(labels(svg, '.waveform-axis-x')).not.toContain('0')
  })

  it('does not reserve endpoint clearance when endpoint values are hidden', () => {
    const svg = render(
      [
        { x: -63, y: 0 },
        { x: -0.1, y: 1 },
      ],
      { width: 520, xAxis: { tickCount: 13, fontSize: 26, showEndValues: false } },
    )

    expect(labels(svg, '.waveform-axis-x')).toContain('-5')
    expect(svg.querySelector('.waveform-axis-x-endpoints')).toBeNull()
  })

  it('supports hiding endpoint values or the complete X axis', () => {
    const endpointsHidden = render(
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      { xAxis: { showEndValues: false, hideEndTicks: false } },
    )
    const axisHidden = render(
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      { xAxis: { visible: false } },
    )

    expect(endpointsHidden.querySelector('.waveform-axis-x-endpoints')).toBeNull()
    expect(labels(endpointsHidden, '.waveform-axis-x')).toEqual(expect.arrayContaining(['0', '1']))
    expect(axisHidden.querySelector('.waveform-axis-x')).toBeNull()
    expect(axisHidden.querySelector('.waveform-axis-x-endpoints')).toBeNull()
  })

  it('updates endpoint values after data and option changes', () => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
    document.body.append(container)
    const chart = new Waveform(
      container,
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      {
        responsive: { enabled: false },
      },
    )

    expect(endpointLabels(container.querySelector('svg')!)).toEqual(['0', '1'])
    chart.updateData([
      { x: 10, y: 0 },
      { x: 20, y: 1 },
    ])
    expect(endpointLabels(container.querySelector('svg')!)).toEqual(['10', '20'])
    chart.updateOptions({ xAxis: { showEndValues: false } })
    expect(container.querySelector('.waveform-axis-x-endpoints')).toBeNull()
  })

  it('updates and clears the custom X tick step through updateOptions', () => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
    document.body.append(container)
    const chart = new Waveform(
      container,
      [
        { x: 0, y: 0 },
        { x: 24, y: 1 },
      ],
      {
        responsive: { enabled: false },
        xAxis: { tickStep: 6, tickCount: 2, hideEndTicks: false, showEndValues: false },
      },
    )

    expect(labels(container.querySelector('svg')!, '.waveform-axis-x')).toEqual([
      '0',
      '6',
      '12',
      '18',
      '24',
    ])

    chart.updateOptions({ xAxis: { tickStep: 12 } })
    expect(labels(container.querySelector('svg')!, '.waveform-axis-x')).toEqual(['0', '12', '24'])

    chart.updateOptions({ xAxis: { tickStep: undefined } })
    expect(labels(container.querySelector('svg')!, '.waveform-axis-x')).toEqual(['0', '10', '20'])
  })

  it('uses the exact data extent for the automatic Y domain', () => {
    const svg = render([
      { x: 0, y: 1.1 },
      { x: 1, y: 9.9 },
    ])
    const points = seriesPathPoints(svg)

    expect(points[0][1]).toBe(frameHeight(svg))
    expect(points[1][1]).toBe(0)
  })

  it('uses an independent data extent for each legacy Y axis', () => {
    const svg = render(
      [
        {
          name: 'left',
          data: [
            { x: 0, y: -10 },
            { x: 1, y: 0 },
          ],
        },
        {
          name: 'right',
          yAxis: 'right',
          data: [
            { x: 0, y: 10 },
            { x: 1, y: 30 },
          ],
        },
      ],
      { secondaryYAxis: { visible: true } },
    )
    const height = frameHeight(svg)
    const leftPoints = seriesPathPoints(svg, 0)
    const rightPoints = seriesPathPoints(svg, 1)

    expect(leftPoints[0][1]).toBe(height)
    expect(leftPoints[1][1]).toBe(0)
    expect(rightPoints[0][1]).toBe(height)
    expect(rightPoints[1][1]).toBe(0)
  })

  it('keeps Y-axis labels two pixels from the frame by default', () => {
    const svg = render(
      [
        {
          name: 'left',
          data: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        },
        {
          name: 'right',
          yAxis: 'right',
          data: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        },
      ],
      { secondaryYAxis: { visible: true } },
    )

    expect(svg.querySelector('.waveform-axis-y--left .tick text')?.getAttribute('x')).toBe('-2')
    expect(svg.querySelector('.waveform-axis-y--right .tick text')?.getAttribute('x')).toBe('2')
  })

  it('aligns both Y-axis minimum baselines with the frame bottom', () => {
    const svg = render(
      [
        {
          name: 'left',
          data: [
            { x: 0, y: 1 },
            { x: 1, y: 9 },
          ],
        },
        {
          name: 'right',
          yAxis: 'right',
          data: [
            { x: 0, y: 10 },
            { x: 1, y: 30 },
          ],
        },
      ],
      { secondaryYAxis: { visible: true } },
    )
    for (const [side, minimum] of [
      ['left', '1'],
      ['right', '10'],
    ]) {
      const ticks = svg.querySelectorAll(`.waveform-axis-y--${side} .tick`)
      const bottomTick = ticks[0]
      const baseline =
        Number(bottomTick.getAttribute('transform')?.match(/translate\(0,([^)]*)\)/)?.[1]) +
        Number(bottomTick.querySelector('text')?.getAttribute('y'))

      expect(bottomTick.querySelector('text')?.textContent).toBe(minimum)
      expect(Math.abs(baseline - frameHeight(svg))).toBeLessThanOrEqual(0.5)
      expect(bottomTick.querySelector('text')?.getAttribute('dy')).toBe('0')
      expect(ticks[1].querySelector('text')?.getAttribute('dy')).toBe('0.32em')
    }
  })

  it('keeps corner alignment after data updates', () => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
    document.body.append(container)
    const chart = new Waveform(
      container,
      [
        {
          name: 'left',
          data: [
            { x: 0, y: 1 },
            { x: 1, y: 9 },
          ],
        },
        {
          name: 'right',
          yAxis: 'right',
          data: [
            { x: 0, y: 10 },
            { x: 1, y: 30 },
          ],
        },
      ],
      { responsive: { enabled: false }, secondaryYAxis: { visible: true } },
    )

    chart.updateData([
      {
        name: 'left',
        data: [
          { x: 100, y: 2 },
          { x: 3000, y: 8 },
        ],
      },
      {
        name: 'right',
        yAxis: 'right',
        data: [
          { x: 100, y: 20 },
          { x: 3000, y: 40 },
        ],
      },
    ])
    const svg = container.querySelector('svg')!
    const start = svg.querySelector('.waveform-axis-x-endpoint--start')!
    const end = svg.querySelector('.waveform-axis-x-endpoint--end')!
    const leftMin = svg.querySelector('.waveform-axis-y--left .tick text')!
    const rightMin = svg.querySelector('.waveform-axis-y--right .tick text')!

    expect(start.textContent).toBe('100')
    expect(start.getAttribute('x')).toBe('0')
    expect(start.getAttribute('text-anchor')).toBe('middle')
    expect(end.textContent).toBe('3000')
    expect(end.getAttribute('x')).toBe(
      svg.querySelector('.waveform-frame-border')?.getAttribute('width'),
    )
    expect(end.getAttribute('text-anchor')).toBe('middle')
    expect(leftMin.textContent).toBe('2')
    expect(leftMin.getAttribute('dy')).toBe('0')
    expect(rightMin.textContent).toBe('20')
    expect(rightMin.getAttribute('dy')).toBe('0')
  })

  it('shifts the default left title ten pixels right and honors explicit offsets', () => {
    const data: WaveformData = [
      {
        name: 'left',
        data: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
      {
        name: 'right',
        yAxis: 'right',
        data: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
    ]
    const defaults = render(data, {
      yAxis: { title: { visible: true, text: 'Left' } },
      secondaryYAxis: { visible: true, title: { visible: true, text: 'Right' } },
    })
    const plotX = translateX(defaults.querySelector('svg > g')!)
    const innerWidth = Number(
      defaults.querySelector('.waveform-frame-border')?.getAttribute('width'),
    )
    const leftTitleX = translateX(
      defaults.querySelector('.waveform-axis-y-title[data-axis-id="left"]')!,
    )
    const rightTitleX = translateX(
      defaults.querySelector('.waveform-axis-y-title[data-axis-id="right"]')!,
    )

    expect(plotX - leftTitleX - 6 - (2 + 3 * 11 * 0.6)).toBeCloseTo(2)
    expect(rightTitleX - (plotX + innerWidth) - 6 - (2 + 3 * 11 * 0.6)).toBeCloseTo(12)

    const explicit = render(data, {
      yAxis: { title: { visible: true, text: 'Left', offset: 80 } },
      secondaryYAxis: { visible: true, title: { visible: true, text: 'Right', offset: 72 } },
    })
    const explicitPlotX = translateX(explicit.querySelector('svg > g')!)
    const explicitInnerWidth = Number(
      explicit.querySelector('.waveform-frame-border')?.getAttribute('width'),
    )

    expect(
      explicitPlotX -
        translateX(explicit.querySelector('.waveform-axis-y-title[data-axis-id="left"]')!),
    ).toBe(80)
    expect(
      translateX(explicit.querySelector('.waveform-axis-y-title[data-axis-id="right"]')!) -
        (explicitPlotX + explicitInnerWidth),
    ).toBe(72)
  })

  it('applies explicit Y bounds on top of each axis data extent', () => {
    const svg = render(
      [
        {
          name: 'left',
          data: [
            { x: 0, y: -10 },
            { x: 1, y: 0 },
          ],
        },
        {
          name: 'right',
          yAxis: 'right',
          data: [
            { x: 0, y: 10 },
            { x: 1, y: 30 },
          ],
        },
      ],
      { yAxis: { min: -20 }, secondaryYAxis: { visible: true, max: 50 } },
    )
    const height = frameHeight(svg)
    const leftPoints = seriesPathPoints(svg, 0)
    const rightPoints = seriesPathPoints(svg, 1)

    expect(leftPoints[0][1]).toBeCloseTo(height * 0.5)
    expect(leftPoints[1][1]).toBe(0)
    expect(rightPoints[0][1]).toBe(height)
    expect(rightPoints[1][1]).toBeCloseTo(height * 0.5)
  })

  it('renders at most one axis per side and merges same-side series domains', () => {
    const valueAxes: NonNullable<WaveformOptions['yAxes']> = [
      { id: 'temperature', position: 'left', title: { visible: true, text: 'Temperature' } },
      { id: 'pressure', position: 'left', title: { visible: true, text: 'Pressure' } },
      { id: 'flow', position: 'right', title: { visible: true, text: 'Flow' } },
      { id: 'voltage', position: 'right', title: { visible: true, text: 'Voltage' } },
    ]
    const svg = render(
      [
        {
          name: 'temperature',
          yAxis: 'temperature',
          data: [
            { x: 0, y: 10 },
            { x: 1, y: 20 },
          ],
        },
        {
          name: 'pressure',
          yAxis: 'pressure',
          data: [
            { x: 0, y: 1000 },
            { x: 1, y: 2000 },
          ],
        },
        {
          name: 'flow',
          yAxis: 'flow',
          data: [
            { x: 0, y: -5 },
            { x: 1, y: 5 },
          ],
        },
        {
          name: 'voltage',
          yAxis: 'voltage',
          data: [
            { x: 0, y: 100 },
            { x: 1, y: 200 },
          ],
        },
      ],
      {
        yAxes: valueAxes,
        grid: { y: { axisId: 'pressure' } },
      },
    )
    const height = frameHeight(svg)
    const axes = Array.from(svg.querySelectorAll<SVGGElement>('.waveform-axis-y'))

    expect(axes.map((axis) => axis.getAttribute('data-axis-id'))).toEqual(['temperature', 'flow'])
    expect(
      Array.from(svg.querySelectorAll('.waveform-axis-y-title'), (title) =>
        title.getAttribute('data-axis-id'),
      ),
    ).toEqual(['temperature', 'flow'])
    expect(axes[0].getAttribute('transform')).toBeNull()
    expect(axes[1].getAttribute('transform')).toMatch(/^translate\([\d.]+,0\)$/)
    expect(seriesPathPoints(svg, 0).map((point) => point[1])).toEqual([height, expect.any(Number)])
    expect(seriesPathPoints(svg, 0)[1][1]).toBeGreaterThan(height * 0.9)
    expect(seriesPathPoints(svg, 1)[0][1]).toBeCloseTo((height * 1000) / 1990)
    expect(seriesPathPoints(svg, 1)[1][1]).toBe(0)
    expect(seriesPathPoints(svg, 2)[0][1]).toBe(height)
    expect(seriesPathPoints(svg, 2)[1][1]).toBeGreaterThan(height * 0.9)
    expect(seriesPathPoints(svg, 3)[0][1]).toBeCloseTo((height * 100) / 205)
    expect(seriesPathPoints(svg, 3)[1][1]).toBe(0)
    expect(svg.querySelector('.waveform-grid-y')?.getAttribute('data-axis-id')).toBe('temperature')
  })

  it('falls back invalid bindings and axis references to the first unique axis', () => {
    const svg = render(
      [
        {
          name: 'fallback',
          yAxis: 'missing',
          data: [
            { x: 0, y: 5 },
            { x: 1, y: 15 },
          ],
        },
      ],
      {
        yAxes: [
          { id: '', position: 'right' },
          { id: 'primary', min: 0, max: 20 },
          { id: 'primary', position: 'right' },
        ],
        grid: { y: { axisId: 'missing' } },
        zeroLine: { axisId: 'missing' },
      },
    )

    expect(svg.querySelectorAll('.waveform-axis-y')).toHaveLength(1)
    expect(svg.querySelector('.waveform-grid-y')?.getAttribute('data-axis-id')).toBe('primary')
    expect(svg.querySelector('.waveform-zero-line')).toBeNull()
    expect(seriesPathPoints(svg)[0][1]).toBeCloseTo(frameHeight(svg) * 0.75)
  })

  it('falls back an empty axis array and omits an unbound axis', () => {
    const fallback = render(
      [
        { x: 0, y: 2 },
        { x: 1, y: 4 },
      ],
      { yAxes: [] },
    )
    const unbound = render(
      [
        { x: 0, y: 2 },
        { x: 1, y: 4 },
      ],
      { yAxes: [{ id: 'data' }, { id: 'empty', position: 'right', min: 10 }] },
    )

    expect(fallback.querySelector('.waveform-axis-y')?.getAttribute('data-axis-id')).toBe('left')
    expect(unbound.querySelector('[data-axis-id="empty"]')).toBeNull()
  })

  it('uses configured value axes for the Y grid and zero line', () => {
    const svg = render(
      [
        {
          yAxis: 'positive',
          data: [
            { x: 0, y: 10 },
            { x: 1, y: 20 },
          ],
        },
        {
          yAxis: 'signed',
          data: [
            { x: 0, y: -5 },
            { x: 1, y: 5 },
          ],
        },
      ],
      {
        yAxes: [{ id: 'positive' }, { id: 'signed', position: 'right' }],
        grid: { y: { axisId: 'signed' } },
        zeroLine: { axisId: 'signed' },
      },
    )

    expect(svg.querySelector('.waveform-grid-y')?.getAttribute('data-axis-id')).toBe('signed')
    expect(svg.querySelector('.waveform-zero-line')?.getAttribute('data-axis-id')).toBe('signed')
    expect(Number(svg.querySelector('.waveform-zero-line')?.getAttribute('y1'))).toBe(
      frameHeight(svg) / 2,
    )
  })

  it('keeps hidden axis scales active and replaces named axes at runtime', () => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
    document.body.append(container)
    const chart = new Waveform(
      container,
      [
        {
          yAxis: 'hidden',
          data: [
            { x: 0, y: 10 },
            { x: 1, y: 20 },
          ],
        },
      ],
      {
        responsive: { enabled: false },
        yAxes: [{ id: 'visible' }, { id: 'hidden', visible: false }],
      },
    )

    expect(container.querySelectorAll('.waveform-axis-y')).toHaveLength(0)
    expect(seriesPathPoints(container.querySelector('svg')!).map((point) => point[1])).toEqual([
      frameHeight(container.querySelector('svg')!),
      0,
    ])

    chart.updateOptions({ yAxes: [{ id: 'replacement', min: 0, max: 40 }] })
    const updated = container.querySelector('svg')!
    expect(updated.querySelector('.waveform-axis-y')?.getAttribute('data-axis-id')).toBe(
      'replacement',
    )
    expect(seriesPathPoints(updated)[0][1]).toBeCloseTo(frameHeight(updated) * 0.75)
  })

  it('keeps a usable Y domain when all values are equal', () => {
    const svg = render([
      { x: 0, y: 7 },
      { x: 1, y: 7 },
    ])
    const height = frameHeight(svg)

    expect(seriesPathPoints(svg).map((point) => point[1])).toEqual([height / 2, height / 2])
  })

  it('recomputes the Y domain after data updates', () => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
    document.body.append(container)
    const chart = new Waveform(
      container,
      [
        { x: 0, y: 0 },
        { x: 1, y: 5 },
        { x: 2, y: 10 },
      ],
      {
        responsive: { enabled: false },
      },
    )
    const initialSvg = container.querySelector('svg')!

    expect(seriesPathPoints(initialSvg)[1][1]).toBe(frameHeight(initialSvg) / 2)

    chart.updateData([
      { x: 0, y: 0 },
      { x: 1, y: 5 },
      { x: 2, y: 20 },
    ])
    const updatedSvg = container.querySelector('svg')!
    expect(seriesPathPoints(updatedSvg)[1][1]).toBe(frameHeight(updatedSvg) * 0.75)
  })

  it('includes the exact Y-domain endpoints and pins the end value to the top edge', () => {
    const svg = render(
      [
        { x: 0, y: 1.1 },
        { x: 1, y: 9.9 },
      ],
      { yAxis: { tickCount: 6 } },
    )
    const yAxis = svg.querySelector('.waveform-axis-y--left')!
    const yLabels = labels(svg, '.waveform-axis-y--left')
    const endLabel = yAxis.querySelector('.waveform-axis-y-end-value')!
    const axisTickPositions = Array.from(yAxis.querySelectorAll('.tick'), (tick) =>
      tick.getAttribute('transform'),
    )
    const gridTickPositions = Array.from(svg.querySelectorAll('.waveform-grid-y .tick'), (tick) =>
      tick.getAttribute('transform'),
    )

    expect(yLabels).toHaveLength(6)
    expect(yLabels[0]).toBe('1.1')
    expect(yLabels[yLabels.length - 1]).toBe('9.9')
    expect(endLabel.textContent).toBe('9.9')
    expect(endLabel.parentElement?.getAttribute('transform')).toBe('translate(0,0.5)')
    expect(gridTickPositions).toEqual(axisTickPositions)
  })

  it('places the shared scientific exponent above the axis', () => {
    const svg = render([
      { x: 0, y: 32748.3 },
      { x: 1, y: 33482.7 },
    ])
    const yLabels = labels(svg, '.waveform-axis-y--left')
    const endLabel = svg.querySelector('.waveform-axis-y--left .waveform-axis-y-end-value')!

    expect(yLabels[0]).toBe('3.2748')
    expect(yLabels[yLabels.length - 1]).toBe('3.3483')
    expect(endLabel.textContent).toBe('3.3483')
    expect(Array.from(endLabel.querySelectorAll('tspan'), (item) => item.textContent)).toEqual([])
    expect(yLabels.filter((label) => label.startsWith('E'))).toHaveLength(0)
    expect(svg.querySelector('.waveform-axis-y-header')?.textContent).toBe('E+04')
  })

  it('uses scientific notation through 0.001 and plain values above it', () => {
    const small = render([
      { x: 0, y: 0.0002 },
      { x: 1, y: 0.001 },
    ])
    const smallLabels = labels(small, '.waveform-axis-y--left')
    expect(smallLabels[0]).toBe('0.2')
    expect(smallLabels[smallLabels.length - 1]).toBe('1')
    expect(small.querySelector('.waveform-axis-y-header')?.textContent).toBe('E-03')

    const boundary = render([
      { x: 0, y: 0.002 },
      { x: 1, y: 0.01 },
    ])
    const boundaryLabels = labels(boundary, '.waveform-axis-y--left')
    expect(boundaryLabels[boundaryLabels.length - 1]).toBe('0.01')
    expect(boundary.querySelector('.waveform-axis-y-header')).toBeNull()
  })

  it.each(['legacy', 'nice'] as const)(
    'switches notation at inclusive boundaries with %s ticks',
    (tickStrategy) => {
      const container = document.createElement('div')
      document.body.append(container)
      const chart = new Waveform(
        container,
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        {
          width: 800,
          responsive: { enabled: false },
          yAxis: { unit: 'V', tickStrategy },
        },
      )
      for (const [min, max, exponent] of [
        [0, 0.001, 'E-03'],
        [-0.001, 0, 'E-03'],
        [-0.001, 0.001, 'E-03'],
        [0, 0.001001, ''],
        [0, 0.008, ''],
        [0, 999.999, ''],
        [0, 1000, 'E+03'],
        [-1000, 0, 'E+03'],
      ] as const) {
        chart.updateOptions({ yAxis: { min, max } })
        const header = container.querySelector('.waveform-axis-y-header')
        expect(header?.textContent).toBe(exponent ? `V\u00a0\u00a0${exponent}` : 'V')
        expect(header?.getAttribute('y')).toBe('-8')
        const ticks = Array.from(
          container.querySelectorAll('.waveform-axis-y .tick text'),
          (node) => node.textContent ?? '',
        )
        expect(ticks.every((label) => !label.includes('E') && !label.includes('V'))).toBe(true)
      }
      chart.destroy()
    },
  )

  it('uses one shared scientific exponent on each Y axis', () => {
    const svg = render(
      [
        {
          name: 'left',
          data: [
            { x: 0, y: 1000 },
            { x: 1, y: 3000 },
          ],
        },
        {
          name: 'right',
          yAxis: 'right',
          data: [
            { x: 0, y: 0.0001 },
            { x: 1, y: 0.0003 },
          ],
        },
      ],
      { yAxis: { unit: 'A' }, secondaryYAxis: { visible: true, unit: 'V' } },
    )

    const leftLabels = labels(svg, '.waveform-axis-y--left')
    const rightLabels = labels(svg, '.waveform-axis-y--right')
    expect(leftLabels[leftLabels.length - 1]).toBe('3')
    expect(rightLabels[rightLabels.length - 1]).toBe('3')
    expect(svg.querySelector('.waveform-axis-y--left .waveform-axis-y-header')?.textContent).toBe(
      'A\u00a0\u00a0E+03',
    )
    expect(svg.querySelector('.waveform-axis-y--right .waveform-axis-y-header')?.textContent).toBe(
      'E-04\u00a0\u00a0V',
    )
  })

  it('keeps an explicit Y-axis tick formatter authoritative', () => {
    const svg = render(
      [
        { x: 0, y: 1000 },
        { x: 1, y: 3123 },
      ],
      { yAxis: { tickFormat: (value) => `value:${value}` } },
    )

    const yLabels = labels(svg, '.waveform-axis-y--left')
    expect(yLabels.every((label) => label.startsWith('value:'))).toBe(true)
    expect(yLabels.some((label) => label.startsWith('E'))).toBe(false)
    expect(svg.querySelector('.waveform-axis-y-header')).toBeNull()
    expect(svg.querySelector('.waveform-axis-y-end-value')?.textContent).toBe('value:3123')
  })

  it('preserves fixed decimals and multiline custom Y-axis labels', () => {
    const data = [
      { x: 0, y: 1000 },
      { x: 1, y: 3000 },
    ]
    const fixed = render(data, { yAxis: { tickFormat: '.2f', unit: 'V' } })
    expect(fixed.querySelector('.waveform-axis-y-end-value')?.textContent).toBe('3000.00')
    const multiline = render(data, { yAxis: { tickFormat: (value) => `raw\n${value}` } })
    expect(
      Array.from(
        multiline.querySelectorAll('.waveform-axis-y-end-value tspan'),
        (node) => node.textContent,
      ),
    ).toEqual(['raw', '3000'])
  })

  it('updates notation, units, and automatic padding after data and options change', () => {
    const container = document.createElement('div')
    document.body.append(container)
    const chart = new Waveform(
      container,
      [
        { x: 0, y: 0 },
        { x: 1, y: 3 },
      ],
      {
        width: 360,
        padding: { left: 0 },
        responsive: { enabled: false },
        yAxis: { unit: 'V' },
      },
    )
    const endLabel = () => container.querySelector('.waveform-axis-y-header')!
    const plotWidth = () =>
      Number(container.querySelector('.waveform-frame-border')!.getAttribute('width'))
    expect(endLabel().textContent).toBe('V')
    const ordinaryWidth = plotWidth()

    chart.updateData([
      { x: 0, y: 1000 },
      { x: 1, y: 3000 },
    ])
    expect(endLabel().textContent).toBe('V\u00a0\u00a0E+03')
    const scientificWidth = plotWidth()
    expect(scientificWidth).toBe(ordinaryWidth)

    chart.updateOptions({ yAxis: { unit: ' millivolts / second ' } })
    expect(endLabel().textContent).toBe('millivolts / second\u00a0\u00a0E+03')
    expect(plotWidth()).toBe(scientificWidth)
    expect(plotWidth()).toBeGreaterThan(0)
    expect(endLabel().querySelector('tspan')).toBeNull()

    chart.updateData([
      { x: 0, y: 0.0001 },
      { x: 1, y: 0.0003 },
    ])
    expect(endLabel().textContent).toBe('millivolts / second\u00a0\u00a0E-04')
    chart.updateOptions({ yAxis: { unit: 'V' } })
    chart.updateData([
      { x: 0, y: 0 },
      { x: 1, y: 3 },
    ])
    expect(endLabel().textContent).toBe('V')
    expect(plotWidth()).toBe(ordinaryWidth)
    chart.destroy()
  })
})
