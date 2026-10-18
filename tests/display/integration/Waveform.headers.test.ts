// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Waveform } from '../../../src/display/Waveform'
import type { WaveformData } from '../../../src/display/types/data'
import type { WaveformOptions } from '../../../src/display/types/options'

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
  Reflect.deleteProperty(SVGElement.prototype, 'getBBox')
})

function setup(data: WaveformData, options: WaveformOptions = {}) {
  const container = document.createElement('div')
  document.body.append(container)
  const chart = new Waveform(container, data, {
    width: 800,
    responsive: { enabled: false },
    ...options,
  })
  return { container, chart, svg: container.querySelector('svg')! }
}

function translation(node: Element): number[] {
  return node
    .getAttribute('transform')!
    .match(/-?[\d.]+/g)!
    .map(Number)
}

describe('axis headers and zero-line defaults', () => {
  it('fits full-width titles without native measurement and collapses safely without height', () => {
    const { chart, svg } = setup(
      [
        {
          data: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        },
        {
          data: [
            { x: 0, y: 1 },
            { x: 1, y: 0 },
          ],
        },
      ],
      {
        animationEnabled: false,
        height: 300,
        yAxis: { title: { visible: true, text: '中文长标题'.repeat(60), fontSize: 14 } },
      },
    )
    const title = () => svg.querySelector('.waveform-axis-y-title')!
    expect(Number(title().getAttribute('font-size'))).toBeLessThan(14)
    expect(title().textContent).toBe('中文长标题'.repeat(60))
    chart.updateOptions({ height: 1 })
    expect(Number(title().getAttribute('font-size'))).toBe(0)
    chart.updateOptions({ height: 300, yAxis: { title: { text: 'Value' } } })
    expect(title().getAttribute('font-size')).toBe('14')
    expect(svg.querySelectorAll('[visibility="hidden"][aria-hidden="true"]')).toHaveLength(0)
    chart.destroy()
  })

  it.each(['left', 'right'] as const)(
    'fits long %s value-axis titles to the plot and restores the requested size',
    (position) => {
      Object.defineProperty(SVGElement.prototype, 'getComputedTextLength', {
        configurable: true,
        value(this: SVGElement) {
          const size = Number(this.getAttribute('font-size') || 0)
          return Array.from(this.textContent ?? '').reduce(
            (width, char) => width + size * (char.codePointAt(0)! > 127 ? 1 : 0.6),
            0,
          )
        },
      })
      try {
        const { chart, svg } = setup(
          [
            {
              id: 'a',
              yAxis: 'target',
              data: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
            },
            {
              id: 'b',
              yAxis: 'target',
              data: [
                { x: 0, y: 1 },
                { x: 1, y: 0 },
              ],
            },
          ],
          {
            animationEnabled: false,
            height: 300,
            yAxes: [
              {
                id: 'target',
                position,
                title: { visible: true, text: '长标题'.repeat(60), unit: 'V', fontSize: 14 },
              },
            ],
          },
        )
        const title = () => svg.querySelector<SVGTextElement>('.waveform-axis-y-title')!
        const height = () =>
          Number(svg.querySelector('.waveform-frame-border')!.getAttribute('height'))
        expect(Number(title().getAttribute('font-size'))).toBeLessThan(14)
        expect(title().getComputedTextLength()).toBeLessThanOrEqual(height() - 4 + 1e-8)
        chart.updateOptions({ height: 180 })
        expect(title().getComputedTextLength()).toBeLessThanOrEqual(height() - 4 + 1e-8)
        chart.updateOptions({
          yAxes: [
            {
              id: 'target',
              position,
              title: { visible: true, text: 'Value', unit: 'V', fontSize: 14 },
            },
          ],
        })
        expect(title().getAttribute('font-size')).toBe('14')
        chart.destroy()
      } finally {
        Reflect.deleteProperty(SVGElement.prototype, 'getComputedTextLength')
      }
    },
  )

  it.each(['left', 'right'] as const)(
    'aligns actual %s glyph bounds and avoids the legend through updates',
    (position) => {
      Object.defineProperty(SVGElement.prototype, 'getBBox', {
        configurable: true,
        value() {
          return { x: 0, y: 0, width: 0, height: 0 }
        },
      })
      const bbox = vi
        .spyOn(SVGElement.prototype as SVGElement & { getBBox: () => DOMRect }, 'getBBox')
        .mockImplementation(function (this: SVGElement) {
          const size = Number(this.getAttribute('font-size') || 11)
          const width = (this.textContent?.length ?? 0) * size * 0.6
          const x = Number(this.getAttribute('x') || 0)
          return {
            x: this.closest('.tick') ? x - width : x + 2,
            y: -size,
            width,
            height: size,
          } as DOMRect
        })
      const { chart, container } = setup(
        [
          {
            name: 'First',
            data: [
              { x: 0, y: -3000 },
              { x: 1, y: 1 },
            ],
          },
          {
            name: 'Second',
            data: [
              { x: 0, y: -100 },
              { x: 1, y: 3 },
            ],
          },
        ],
        {
          yAxis: { unit: 'ms', position },
          legend: {
            orientation: 'horizontal',
            position: position === 'left' ? 'top-left' : 'top-right',
          },
        },
      )
      const verify = () => {
        const header = container.querySelector<SVGGraphicsElement>('.waveform-axis-y-header')!
        const boxes = Array.from(
          container.querySelectorAll<SVGGraphicsElement>('.waveform-axis-y .tick text'),
          (tick) => tick.getBBox(),
        )
        const edge =
          position === 'left'
            ? Math.min(...boxes.map((box) => box.x))
            : Math.max(...boxes.map((box) => box.x + box.width))
        expect(
          header.getBBox().x + (position === 'right' ? header.getBBox().width : 0),
        ).toBeCloseTo(edge)
        const plotX = translation(container.querySelector('svg > g')!)[0]
        if (position === 'left') {
          expect(
            translation(container.querySelector('.waveform-legend-item')!)[0],
          ).toBeGreaterThanOrEqual(plotX + header.getBBox().x + header.getBBox().width + 8)
        } else {
          expect(header.getAttribute('text-anchor')).toBe('end')
        }
      }
      verify()
      chart.updateOptions({ yAxis: { unit: 'volts', fontSize: 20 } })
      chart.updateData([
        {
          name: 'First',
          data: [
            { x: 0, y: -0.0001 },
            { x: 1, y: 0.0003 },
          ],
        },
        { name: 'Second', data: [{ x: 0, y: 0 }] },
      ])
      verify()
      expect(container.querySelector('.waveform-axis-y-header')?.textContent).toBe(
        position === 'left' ? 'volts\u00a0\u00a0E-04' : 'E-04\u00a0\u00a0volts',
      )
      bbox.mockImplementation(() => {
        throw new Error('Measurement unavailable')
      })
      expect(() => chart.updateOptions({ yAxis: { fontSize: 12 } })).not.toThrow()
      expect(container.querySelector('.waveform-axis-y-header')?.getAttribute('x')).not.toBe('NaN')
      chart.destroy()
      bbox.mockRestore()
      Reflect.deleteProperty(SVGElement.prototype, 'getBBox')
    },
  )

  it('aligns left headers to the outer tick-label edge and right headers to the axis and omits empty or custom-formatted headers', () => {
    const data = [
      {
        yAxis: 'a',
        data: [
          { x: 0, y: -3000 },
          { x: 1, y: 0 },
        ],
      },
      {
        yAxis: 'b',
        data: [
          { x: 0, y: 0.0001 },
          { x: 1, y: 0.0003 },
        ],
      },
    ]
    const { svg } = setup(data, {
      yAxes: [
        { id: 'a', unit: ' A ', position: 'left', tickPadding: 5 },
        { id: 'b', unit: 'V', position: 'right', tickPadding: 9 },
        { id: 'unused', unit: 'hidden', position: 'left' },
      ],
    })
    const headers = Array.from(svg.querySelectorAll('.waveform-axis-y-header'))
    expect(headers.map((node) => node.textContent)).toEqual([
      'A\u00a0\u00a0E+03',
      'E-04\u00a0\u00a0V',
    ])
    for (const header of headers) {
      expect(Number(header.getAttribute('x'))).toBeCloseTo(
        header.getAttribute('data-axis-id') === 'a' ? -31.4 : 28.8,
      )
      expect(header.getAttribute('y')).toBe('-8')
      expect(header.getAttribute('text-anchor')).toBe(
        header.getAttribute('data-axis-id') === 'a' ? 'start' : 'end',
      )
      expect(header.parentElement?.getAttribute('data-axis-id')).toBe(
        header.getAttribute('data-axis-id'),
      )
    }
    expect(
      setup([
        { x: 0, y: 0 },
        { x: 1, y: 3 },
      ]).svg.querySelector('.waveform-axis-y-header'),
    ).toBeNull()
    expect(
      setup(data, { yAxis: { unit: 'V', tickFormat: '.2f' } }).svg.querySelector(
        '.waveform-axis-y-header',
      ),
    ).toBeNull()
  })

  it('keeps left labels near the edge while reserving right headers and avoiding the legend', () => {
    const unit = 'millivolts / second'
    const { svg } = setup(
      [
        {
          name: 'First long channel',
          yAxis: 'left',
          data: [
            { x: 0, y: 0 },
            { x: 1, y: 3000 },
          ],
        },
        {
          name: 'Second long channel',
          yAxis: 'right',
          data: [
            { x: 0, y: 0 },
            { x: 1, y: 3000 },
          ],
        },
      ],
      {
        width: 420,
        padding: { left: 0, right: 0, top: 0 },
        yAxis: { unit, title: { visible: false } },
        secondaryYAxis: { visible: true, unit, title: { visible: false } },
        legend: { orientation: 'horizontal', position: 'top-left' },
        title: { visible: true, text: 'Title' },
      },
    )
    const [plotX, plotY] = translation(svg.querySelector('svg > g')!)
    const innerWidth = Number(svg.querySelector('.waveform-frame-border')!.getAttribute('width'))
    const width = Number(svg.getAttribute('viewBox')!.split(' ')[2])
    const headerWidth = 'millivolts / second\u00a0\u00a0E+03'
      .split('')
      .reduce((sum, char) => sum + 11 * (/\s/.test(char) ? 0.33 : 0.6), 0)
    expect(width).toBe(420)
    expect(svg.getAttribute('width')).toBe('420')
    expect(plotX).toBeLessThan(headerWidth)
    expect(width - plotX - innerWidth).toBeLessThan(headerWidth)
    expect(plotY).toBe(19)
    const legendRows = Array.from(
      svg.querySelectorAll('.waveform-legend-item'),
      (node) => translation(node)[1],
    )
    expect(legendRows[0]).toBe(46)
    const firstLegendX = translation(svg.querySelector('.waveform-legend-item')!)[0]
    const leftHeaderX = Number(
      svg.querySelector('.waveform-axis-y--left .waveform-axis-y-header')!.getAttribute('x'),
    )
    expect(firstLegendX).toBeGreaterThanOrEqual(plotX + leftHeaderX + headerWidth + 8)
    expect(
      Number(svg.querySelector('.waveform-frame-border')!.getAttribute('height')),
    ).toBeGreaterThan(0)
  })

  it('adds only missing header height and shifts the legend clear of changing headers', () => {
    const { chart, container } = setup(
      [
        {
          name: 'First',
          data: [
            { x: 0, y: 0 },
            { x: 1, y: 3 },
          ],
        },
        {
          name: 'Second',
          data: [
            { x: 0, y: 0 },
            { x: 1, y: 3 },
          ],
        },
      ],
      {
        padding: { top: 0, left: 300 },
        yAxis: { unit: 'V', fontSize: 20 },
        legend: { orientation: 'horizontal', position: 'top-left' },
      },
    )
    const plotY = () => translation(container.querySelector('svg > g')!)[1]
    const legendX = () => translation(container.querySelector('.waveform-legend-item')!)[0]
    const initialX = legendX()
    expect(plotY()).toBe(28)
    chart.updateOptions({ yAxis: { unit: 'millivolts / second' } })
    expect(plotY()).toBe(28)
    expect(legendX()).toBeGreaterThan(initialX)
    expect(container.querySelector('.waveform-axis-y-header')?.getAttribute('text-anchor')).toBe(
      'start',
    )
    chart.updateOptions({ padding: { top: 32 }, yAxis: { fontSize: 11 } })
    expect(plotY()).toBe(32)
    expect(legendX()).toBeGreaterThan(initialX)
    chart.updateOptions({ yAxis: { tickFormat: '.2f' } })
    expect(container.querySelector('.waveform-axis-y-header')).toBeNull()
    expect(plotY()).toBe(32)
    expect(legendX()).toBe(300)
    chart.destroy()
  })

  it('preserves explicit padding and disables automatic header layout on request', () => {
    const data = [
      { x: 0, y: 0 },
      { x: 1, y: 3000 },
    ]
    const explicit = setup(data, { padding: { left: 150 }, yAxis: { unit: 'V' } }).svg
    expect(translation(explicit.querySelector('svg > g')!)[0]).toBe(150)
    const fixed = setup(data, {
      width: 200,
      padding: { top: 20, left: 10 },
      layout: { autoPadding: false },
      yAxis: { unit: 'V' },
    }).svg
    expect(fixed.querySelector('svg > g')!.getAttribute('transform')).toBe('translate(10,20)')
    expect(fixed.getAttribute('viewBox')!.split(' ')[2]).toBe('200')
  })

  it('defaults the zero line to translucent red and supports independent runtime overrides', () => {
    const { container, chart } = setup([
      { x: 0, y: -1 },
      { x: 1, y: 1 },
    ])
    const line = () => container.querySelector('.waveform-zero-line')!
    expect(line().getAttribute('stroke')).toBe('#ff0000')
    expect(line().getAttribute('stroke-opacity')).toBe('0.5')
    expect(line().getAttribute('stroke-width')).toBe('1')
    expect(line().getAttribute('stroke-dasharray')).toBe('4 4')
    chart.updateOptions({ zeroLine: { color: '#123456', opacity: 0 } })
    expect(line().getAttribute('stroke')).toBe('#123456')
    expect(line().getAttribute('stroke-opacity')).toBe('0')
    chart.updateOptions({ zeroLine: { opacity: 1 } })
    expect(line().getAttribute('stroke')).toBe('#123456')
    expect(line().getAttribute('stroke-opacity')).toBe('1')
    chart.updateOptions({ zeroLine: { visible: false } })
    expect(container.querySelector('.waveform-zero-line')).toBeNull()
    chart.updateOptions({ zeroLine: { visible: true } })
    chart.updateData([
      { x: 0, y: 1 },
      { x: 1, y: 2 },
    ])
    expect(container.querySelector('.waveform-zero-line')).toBeNull()
    chart.destroy()
  })
})
