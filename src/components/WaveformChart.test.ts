import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { flushAnimationFrames, pendingAnimationFrameCount, resizeObservers } from '../test/setup'
import WaveformChart from './WaveformChart.vue'
import { prepareWaveformSeries } from './core/useWaveformData'
import { waveformLegendErrorBarPath, waveformLegendLinePath } from './rendering/seriesStyle'
import { normalizeWaveformData, normalizeWaveformSeries, type WaveformData } from './waveform'

async function mountSizedChart(data: WaveformData, extraProps = {}) {
  const wrapper = mount(WaveformChart, {
    props: { data, ...extraProps },
  })
  resizeObservers.at(-1)?.resize(800, 360)
  await flushPromises()
  return wrapper
}

describe('normalizeWaveformData', () => {
  it('converts samples into time-based points', () => {
    expect(
      normalizeWaveformData({
        kind: 'samples',
        values: [2, 4, 6],
        sampleRate: 2,
        startTime: 1,
      }),
    ).toEqual([
      { x: 1, y: 2 },
      { x: 1.5, y: 4 },
      { x: 2, y: 6 },
    ])
  })

  it('sorts explicit points and filters non-finite values', () => {
    expect(
      normalizeWaveformData({
        kind: 'points',
        points: [
          { x: 2, y: 4 },
          { x: Number.NaN, y: 3 },
          { x: 1, y: 2 },
        ],
      }),
    ).toEqual([
      { x: 1, y: 2 },
      { x: 2, y: 4 },
    ])
  })

  it('returns no points for an invalid sample rate', () => {
    expect(normalizeWaveformData({ kind: 'samples', values: [1, 2], sampleRate: 0 })).toEqual([])
  })

  it('normalizes errors and preserves a pure error-bar series', () => {
    const [series] = normalizeWaveformSeries({
      kind: 'series',
      series: [
        {
          name: 'styled',
          lineType: 'none',
          pointType: 'none',
          errorBar: { visible: true, width: -1, capWidth: Number.NaN },
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 2, error: 1, lowerError: -1, upperError: 2 },
              { x: 1, y: 3, error: Number.NaN },
            ],
          },
        },
      ],
    })

    expect(series).toMatchObject({
      lineType: 'none',
      pointType: 'none',
      errorBar: { visible: true, width: 1.5, capWidth: 8 },
      points: [
        { x: 0, y: 2, error: 1, upperError: 2 },
        { x: 1, y: 3 },
      ],
    })
  })

  it('falls back to a line only when every series visual is disabled', () => {
    const [series] = normalizeWaveformSeries({
      kind: 'series',
      series: [
        {
          name: 'invisible',
          lineType: 'none',
          pointType: 'none',
          errorBar: { visible: false },
          data: { kind: 'points', points: [{ x: 0, y: 1 }] },
        },
      ],
    })

    expect(series).toMatchObject({
      lineType: 'linear',
      pointType: 'none',
      errorBar: { visible: false },
    })
  })

  it('includes visible error bounds in the prepared Y domain', () => {
    const [series] = prepareWaveformSeries({
      kind: 'series',
      series: [
        {
          name: 'errors',
          errorBar: { visible: true },
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 2, lowerError: 3, upperError: 4 },
              { x: 1, y: 3 },
            ],
          },
        },
      ],
    })

    expect(series?.yDomain[0]).toBeLessThanOrEqual(-1)
    expect(series?.yDomain[1]).toBeGreaterThanOrEqual(6)
  })

  it('normalizes multiple named series and removes empty series', () => {
    expect(
      normalizeWaveformSeries({
        kind: 'series',
        series: [
          {
            trackId: 'comparison-track',
            name: 'BT2_2M',
            unit: 'T',
            data: { kind: 'points', points: [{ x: 1, y: 2 }] },
          },
          {
            name: 'empty',
            data: { kind: 'samples', values: [1], sampleRate: 0 },
          },
        ],
      }),
    ).toEqual([
      {
        id: 'series-0',
        trackId: 'comparison-track',
        name: 'BT2_2M',
        unit: 'T',
        color: undefined,
        lineType: 'linear',
        pointType: 'none',
        errorBar: { visible: false, width: 1.5, capWidth: 8 },
        points: [{ x: 1, y: 2 }],
      },
    ])
  })
})

describe('legend series geometry', () => {
  it('keeps line samples centered and clamps error-bar caps to the swatch', () => {
    expect(waveformLegendLinePath('linear')).toBe('M1 8H25')
    expect(waveformLegendLinePath('step-start')).toBe('M1 8H25')
    expect(waveformLegendLinePath('step-middle')).toBe('M1 8H25')
    expect(waveformLegendLinePath('step-end')).toBe('M1 8H25')
    expect(waveformLegendLinePath('step-after')).toBe('M1 8H25')
    expect(waveformLegendLinePath('none')).toBeNull()
    expect(waveformLegendErrorBarPath(10)).toBe('M8 2H18M13 2V14M8 14H18')
    expect(waveformLegendErrorBarPath(100)).toBe('M1 2H25M13 2V14M1 14H25')
  })
})

describe('WaveformChart', () => {
  const gridSeries = (count: number): WaveformData => ({
    kind: 'series',
    series: Array.from({ length: count }, (_, index) => ({
      id: `channel-${index}`,
      name: `通道 ${index + 1}`,
      data: {
        kind: 'points',
        points: [
          { x: 0, y: index },
          { x: 1, y: index + 1 },
        ],
      },
    })),
  })

  it('places start, middle, and end step transitions at the expected X positions', async () => {
    const lineTypes = ['step-start', 'step-middle', 'step-end', 'step-after'] as const
    const wrapper = await mountSizedChart({
      kind: 'series',
      series: lineTypes.map((lineType) => ({
        id: lineType,
        trackId: 'steps',
        name: lineType,
        lineType,
        data: {
          kind: 'points',
          points: [
            { x: 0, y: 0 },
            { x: 2, y: 10 },
          ],
        },
      })),
    })
    const pathCoordinates = (lineType: (typeof lineTypes)[number]) =>
      Array.from(
        (
          wrapper.get(`.waveform-chart__line[data-series-id="${lineType}"]`).attributes('d') ?? ''
        ).matchAll(/[ML]([\d.-]+),([\d.-]+)/g),
        (match) => ({ x: Number(match[1]), y: Number(match[2]) }),
      )

    const start = pathCoordinates('step-start')
    const middle = pathCoordinates('step-middle')
    const end = pathCoordinates('step-end')
    const after = pathCoordinates('step-after')
    expect(start.map((point) => point.x)).toEqual([start[0]?.x, start[0]?.x, start.at(-1)?.x])
    expect(middle[1]?.x).toBe(middle[2]?.x)
    expect(middle[1]?.x).toBe((middle[0]!.x + middle.at(-1)!.x) / 2)
    expect(end.map((point) => point.x)).toEqual([end[0]?.x, end.at(-1)?.x, end.at(-1)?.x])
    expect(after).toEqual(end)

    wrapper.unmount()
  })

  it('renders per-series lines, point symbols, error bars, and matching legend swatches', async () => {
    const wrapper = await mountSizedChart({
      kind: 'series',
      series: [
        {
          id: 'triangle-errors',
          trackId: 'styled-track',
          name: '三角误差',
          lineType: 'none',
          pointType: 'triangle',
          errorBar: { visible: true },
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 1, error: 0.25 },
              { x: 1, y: 2, error: 0.5 },
            ],
          },
        },
        {
          id: 'line-only',
          trackId: 'styled-track',
          name: '纯线',
          lineType: 'linear',
          pointType: 'none',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 2 },
              { x: 1, y: 3 },
            ],
          },
        },
        {
          id: 'step-errors',
          trackId: 'styled-track',
          name: '阶梯误差',
          lineType: 'step-after',
          pointType: 'circle',
          errorBar: { visible: true, color: '#222222', width: 2, capWidth: 10 },
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 3, lowerError: 0.5, upperError: 1 },
              { x: 1, y: 4 },
            ],
          },
        },
        {
          id: 'errors-only',
          trackId: 'styled-track',
          name: '纯误差棒',
          lineType: 'none',
          pointType: 'none',
          errorBar: { visible: true },
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 4, error: 0.5 },
              { x: 1, y: 5, error: 0.5 },
            ],
          },
        },
      ],
    })

    expect(wrapper.find('.waveform-chart__line[data-series-id="triangle-errors"]').exists()).toBe(
      false,
    )
    const stepLine = wrapper.get('.waveform-chart__line[data-series-id="step-errors"]')
    expect(stepLine.attributes('data-line-type')).toBe('step-after')
    expect(stepLine.attributes('d')).toMatch(/^M[\d.-]+,([\d.-]+)L[\d.-]+,\1L/)
    expect(
      wrapper
        .get('.waveform-chart__points[data-series-id="triangle-errors"]')
        .attributes('data-point-type'),
    ).toBe('triangle')
    expect(wrapper.findAll('.waveform-chart__point')).toHaveLength(2)
    expect(
      wrapper
        .get('.waveform-chart__points[data-series-id="triangle-errors"] .waveform-chart__point')
        .attributes('d'),
    ).toMatch(/M.*M/)
    expect(wrapper.findAll('.waveform-chart__error-bar')).toHaveLength(3)
    expect(
      wrapper
        .get('.waveform-chart__error-bars[data-series-id="step-errors"] .waveform-chart__error-bar')
        .attributes('stroke'),
    ).toBe('#222222')
    const errorsOnlySeries = wrapper.get('.waveform-chart__series[data-series-id="errors-only"]')
    expect(errorsOnlySeries.find('.waveform-chart__line').exists()).toBe(false)
    expect(errorsOnlySeries.find('.waveform-chart__point').exists()).toBe(false)
    expect(errorsOnlySeries.find('.waveform-chart__error-bar').exists()).toBe(true)

    const swatches = wrapper.findAll('.waveform-legend__swatch')
    expect(swatches.map((swatch) => swatch.attributes('data-line-type'))).toEqual([
      'none',
      'linear',
      'step-after',
      'none',
    ])
    expect(swatches[0]?.attributes('data-error-bar-visible')).toBe('true')
    expect(swatches[2]?.attributes('data-error-bar-visible')).toBe('true')
    expect(swatches[3]?.attributes('data-error-bar-visible')).toBe('true')
    expect(swatches[0]!.findAll('path').map((path) => path.classes())).toEqual([
      ['waveform-legend__error-bar'],
      ['waveform-legend__point'],
    ])
    const stepSwatchPaths = swatches[2]!.findAll('path')
    expect(stepSwatchPaths.map((path) => path.classes())).toEqual([
      ['waveform-legend__line'],
      ['waveform-legend__error-bar'],
      ['waveform-legend__point'],
    ])
    expect(stepSwatchPaths[0]?.attributes()).toMatchObject({
      d: 'M1 8H25',
      stroke: '#389e0d',
      'stroke-width': '1.5',
    })
    expect(stepSwatchPaths[1]?.attributes()).toMatchObject({
      d: 'M8 2H18M13 2V14M8 14H18',
      stroke: '#222222',
      'stroke-width': '2',
      'stroke-linecap': 'butt',
    })
    expect(stepSwatchPaths[2]?.attributes('transform')).toBe('translate(13 8)')
    expect(swatches[3]!.findAll('path').map((path) => path.classes())).toEqual([
      ['waveform-legend__error-bar'],
    ])

    const renderedSeriesNodes = wrapper
      .findAll('.waveform-chart__line, .waveform-chart__point, .waveform-chart__error-bar')
      .map((node) => node.element)
    const overlay = wrapper.get('.waveform-chart__overlay--independent')
    const overlayWidth = Number(overlay.attributes('width'))
    const overlayHeight = Number(overlay.attributes('height'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: overlayHeight }),
    })
    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', {
        clientX: overlayWidth / 2,
        clientY: overlayHeight / 2,
        bubbles: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(
      wrapper
        .findAll('.waveform-chart__line, .waveform-chart__point, .waveform-chart__error-bar')
        .map((node) => node.element),
    ).toEqual(renderedSeriesNodes)

    wrapper.unmount()
  })

  const visibilitySeries = (): WaveformData => ({
    kind: 'series',
    series: [
      {
        id: 'low',
        trackId: 'shared-frame',
        name: '低量程',
        data: {
          kind: 'points',
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 10 },
          ],
        },
      },
      {
        id: 'high',
        trackId: 'shared-frame',
        name: '高量程',
        data: {
          kind: 'points',
          points: [
            { x: 10, y: 1000 },
            { x: 20, y: 2000 },
          ],
        },
      },
    ],
  })

  it('binds overlaid series to at most four value axes in multi-axis mode', async () => {
    const data: WaveformData = {
      kind: 'series',
      series: Array.from({ length: 5 }, (_, index) => ({
        id: `overlaid-${index}`,
        trackId: 'shared-frame',
        name: `叠加通道 ${index + 1}`,
        data: {
          kind: 'points',
          points: [
            { x: 0, y: index * 100 },
            { x: 1, y: index * 100 + 10 },
          ],
        },
      })),
    }
    const wrapper = await mountSizedChart(data, { overlayMode: 'multi-axis' })

    expect(wrapper.attributes('data-overlay-mode')).toBe('multi-axis')
    expect(
      wrapper
        .findAll('.waveform-chart__axis--y')
        .map((axis) => axis.attributes('data-y-axis-side')),
    ).toEqual(['left', 'left', 'right', 'right'])
    expect(
      wrapper.findAll('.waveform-chart__line').map((line) => line.attributes('data-y-axis-index')),
    ).toEqual(['0', '1', '2', '3', '3'])
    expect(wrapper.findAll('.waveform-track__multi-axis-title')).toHaveLength(4)

    wrapper.unmount()
  })

  it('does not render empty multi-axis title backgrounds', async () => {
    const data: WaveformData = {
      kind: 'series',
      series: [
        {
          id: 'empty-title-a',
          trackId: 'shared-frame',
          name: '',
          data: { kind: 'samples', values: [0, 1], sampleRate: 1 },
        },
        {
          id: 'empty-title-b',
          trackId: 'shared-frame',
          name: '   ',
          data: { kind: 'samples', values: [10, 20], sampleRate: 1 },
        },
      ],
    }
    const wrapper = await mountSizedChart(data, { overlayMode: 'multi-axis', yLabel: '' })

    expect(wrapper.findAll('.waveform-chart__axis--y')).toHaveLength(2)
    expect(wrapper.findAll('.waveform-track__multi-axis-title')).toHaveLength(0)
    expect(wrapper.findAll('.waveform-chart__y-axis-label-bg')).toHaveLength(0)

    wrapper.unmount()
  })

  it('resolves a separate scientific multiplier for every Y axis', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            trackId: 'shared-frame',
            name: '普通量程',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
            },
          },
          {
            trackId: 'shared-frame',
            name: '大量程',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 254 },
              ],
            },
          },
          {
            trackId: 'shared-frame',
            name: '小量程',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 0.0002 },
              ],
            },
          },
        ],
      },
      { overlayMode: 'multi-axis' },
    )

    expect(
      wrapper
        .findAll('.waveform-chart__axis-exponent--y')
        .map((label) => [label.attributes('data-y-axis-index'), label.text()]),
    ).toEqual([
      ['1', 'E+02'],
      ['2', 'E-04'],
    ])
  })

  it('reprojects annotations with the Y axis assigned to their series', async () => {
    const data: WaveformData = {
      kind: 'series',
      series: [
        {
          id: 'low',
          trackId: 'shared-frame',
          name: '低量程',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 10 },
            ],
          },
        },
        {
          id: 'high',
          trackId: 'shared-frame',
          name: '高量程',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 1000 },
              { x: 1, y: 2000 },
            ],
          },
        },
      ],
    }
    const wrapper = await mountSizedChart(data, {
      annotations: [{ id: 'high-note', seriesId: 'high', x: 0.5, y: 1500, text: '高值' }],
    })
    const singleAxisY = wrapper.get('.waveform-annotation__arrow').attributes('y2')

    await wrapper.setProps({ overlayMode: 'multi-axis' })
    await flushPromises()

    expect(wrapper.get('.waveform-annotation__arrow').attributes('y2')).not.toBe(singleAxisY)

    wrapper.unmount()
  })

  it('paginates channels into a row-major two by one grid', async () => {
    const wrapper = await mountSizedChart(gridSeries(5), {
      grid: { rowCount: 2, columnCount: 1 },
    })

    expect(wrapper.findAll('.waveform-chart__track')).toHaveLength(2)
    expect(
      wrapper.findAll('.waveform-chart__line').map((line) => line.attributes('data-series-id')),
    ).toEqual(['channel-0', 'channel-1'])
    const previousButton = () => wrapper.get('.ant-pagination-prev button')
    const nextButton = () => wrapper.get('.ant-pagination-next button')

    expect(wrapper.get('.ant-pagination-item-1').classes()).toContain('ant-pagination-item-active')
    expect(wrapper.get('.ant-pagination-prev').classes()).toContain('ant-pagination-disabled')

    await nextButton().trigger('click')
    expect(
      wrapper.findAll('.waveform-chart__line').map((line) => line.attributes('data-series-id')),
    ).toEqual(['channel-2', 'channel-3'])
    expect(wrapper.emitted('page-change')?.at(-1)).toEqual([2, 3])

    await previousButton().trigger('click')
    expect(wrapper.get('.ant-pagination-item-1').classes()).toContain('ant-pagination-item-active')
    expect(wrapper.emitted('page-change')?.at(-1)).toEqual([1, 3])

    await nextButton().trigger('click')
    await nextButton().trigger('click')
    expect(
      wrapper.findAll('.waveform-chart__line').map((line) => line.attributes('data-series-id')),
    ).toEqual(['channel-4'])
    expect(wrapper.get('.ant-pagination-item-3').classes()).toContain('ant-pagination-item-active')
    expect(wrapper.get('.ant-pagination-next').classes()).toContain('ant-pagination-disabled')
  })

  it('overlays series with the same track ID without changing the next frame', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'primary',
            trackId: 'frame-1',
            name: 'BT2_2M',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
            },
          },
          {
            id: 'second-frame',
            name: 'BT1_2M',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 2 },
                { x: 1, y: 3 },
              ],
            },
          },
          {
            id: 'comparison',
            trackId: 'frame-1',
            name: 'TEST_CH_1',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0.5 },
                { x: 1, y: 1.5 },
              ],
            },
          },
        ],
      },
      { frameNumber: 1, grid: { rowCount: 2, columnCount: 1 } },
    )

    const tracks = wrapper.findAll('.waveform-chart__track')
    expect(tracks).toHaveLength(2)
    expect(
      tracks[0].findAll('.waveform-chart__line').map((line) => line.attributes('data-series-id')),
    ).toEqual(['primary', 'comparison'])
    expect(
      tracks[1].findAll('.waveform-chart__line').map((line) => line.attributes('data-series-id')),
    ).toEqual(['second-frame'])
    expect(tracks[0].find('.waveform-chart__y-axis-label').exists()).toBe(false)
    expect(tracks[0].findAll('.waveform-chart__axis--y .tick').length).toBeGreaterThan(0)
    expect(tracks[1].get('.waveform-chart__y-axis-label').text()).toBe('BT1_2M')
    expect(wrapper.findAll('.waveform-chart__legend')).toHaveLength(1)
    const legend = wrapper.get('.waveform-chart__legend')
    expect(legend.attributes('data-position')).toBe('top-right')
    expect(legend.attributes('data-orientation')).toBe('vertical')
    expect(legend.get('.waveform-legend__panel').attributes('style')).toContain(
      'background-color: rgba(255, 255, 255, 0.7)',
    )
    expect(legend.findAll('.waveform-chart__legend-item').map((item) => item.text())).toEqual([
      'BT2_2M',
      'TEST_CH_1',
    ])
    expect(
      legend
        .findAll('.waveform-legend__swatch')
        .map((swatch) => swatch.get('path').attributes('stroke')),
    ).toEqual(['#0960bd', '#389e0d'])
    expect(wrapper.findAll('.waveform-chart__watermark').map((item) => item.text())).toEqual([
      '1',
      '2',
    ])
    expect(wrapper.find('.ant-pagination').exists()).toBe(false)

    const firstTrackOverlay = tracks[0].get('.waveform-chart__overlay')
    const overlayWidth = Number(firstTrackOverlay.attributes('width'))
    const overlayHeight = Number(firstTrackOverlay.attributes('height'))
    Object.defineProperty(firstTrackOverlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: overlayHeight }),
    })
    firstTrackOverlay.element.dispatchEvent(
      new MouseEvent('pointermove', {
        clientX: overlayWidth / 2,
        clientY: overlayHeight / 2,
        bubbles: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()

    const tooltipSeries = wrapper.findAll('.waveform-chart__tooltip-series')
    expect(tooltipSeries).toHaveLength(2)
    expect(tooltipSeries.map((item) => item.text())).toEqual([
      expect.stringContaining('BT2_2M'),
      expect.stringContaining('TEST_CH_1'),
    ])
  })

  it('resolves automatic legend orientation and supports explicit overrides', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'first',
            trackId: 'shared',
            name: 'first',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
            },
          },
          {
            id: 'second',
            trackId: 'shared',
            name: 'second',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 1 },
                { x: 1, y: 2 },
              ],
            },
          },
        ],
      },
      { grid: { rowCount: 1, columnCount: 1 } },
    )
    const positions = [
      'top-left',
      'top',
      'top-right',
      'right',
      'bottom-right',
      'bottom',
      'bottom-left',
      'left',
    ] as const

    for (const position of positions) {
      await wrapper.setProps({ legend: { position, orientation: 'auto' } })
      const legend = wrapper.get('.waveform-chart__legend')
      const expectedOrientation =
        position === 'top' || position === 'bottom' ? 'horizontal' : 'vertical'
      expect(legend.attributes('data-position')).toBe(position)
      expect(legend.attributes('data-orientation')).toBe(expectedOrientation)
      expect(legend.get('.waveform-legend__viewport').classes()).toContain(
        `waveform-legend__viewport--${position}`,
      )
      expect(
        legend
          .get('.waveform-legend__panel')
          .classes()
          .includes('waveform-legend__panel--vertical'),
      ).toBe(expectedOrientation === 'vertical')
    }

    await wrapper.setProps({ legend: { position: 'top', orientation: 'vertical' } })
    expect(wrapper.get('.waveform-chart__legend').attributes('data-orientation')).toBe('vertical')
    expect(wrapper.get('.waveform-legend__panel').classes()).toContain(
      'waveform-legend__panel--vertical',
    )

    await wrapper.setProps({ legend: { position: 'left', orientation: 'horizontal' } })
    expect(wrapper.get('.waveform-chart__legend').attributes('data-orientation')).toBe('horizontal')
    expect(wrapper.get('.waveform-legend__panel').classes()).toContain(
      'waveform-legend__panel--horizontal',
    )

    expect(wrapper.attributes('data-chart-left-margin')).toBe('64')
  })

  it('applies a configurable alpha background to every visible legend', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: Array.from({ length: 4 }, (_, index) => ({
          id: `series-${index}`,
          trackId: `frame-${Math.floor(index / 2)}`,
          name: `series ${index}`,
          data: {
            kind: 'points',
            points: [
              { x: 0, y: index },
              { x: 1, y: index + 1 },
            ],
          },
        })),
      },
      {
        grid: { rowCount: 2, columnCount: 1 },
        legend: { backgroundColor: 'rgba(14, 165, 233, 0.25)' },
      },
    )

    const legendPanels = wrapper.findAll('.waveform-legend__panel')
    expect(legendPanels).toHaveLength(2)
    legendPanels.forEach((panel) => {
      expect(panel.attributes('style')).toContain('background-color: rgba(14, 165, 233, 0.25)')
    })

    await wrapper.setProps({ legend: { backgroundColor: '' } })
    wrapper.findAll('.waveform-legend__panel').forEach((panel) => {
      expect(panel.attributes('style')).toContain('background-color: rgba(255, 255, 255, 0.7)')
    })
  })

  it('keeps legends display-only unless interaction is explicitly enabled', async () => {
    const wrapper = await mountSizedChart(visibilitySeries(), {
      grid: { rowCount: 1, columnCount: 1 },
    })

    const items = wrapper.findAll('.waveform-chart__legend-item')
    expect(items).toHaveLength(2)
    expect(items.every((item) => item.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.get('.waveform-legend__panel').classes()).not.toContain(
      'waveform-legend__panel--interactive',
    )
    expect(wrapper.emitted('update:hidden-series-ids')).toBeUndefined()
  })

  it('toggles series, axes, tooltips, and annotations from an interactive legend', async () => {
    const wrapper = await mountSizedChart(visibilitySeries(), {
      annotations: [{ id: 'high-note', seriesId: 'high', x: 15, y: 1500, text: '高值' }],
      grid: { rowCount: 1, columnCount: 1 },
      legend: { interactive: true },
      overlayMode: 'multi-axis',
    })

    expect(wrapper.findAll('.waveform-chart__axis--y')).toHaveLength(2)
    expect(wrapper.find('[data-annotation-id="high-note"]').exists()).toBe(true)
    const annotationLayer = wrapper.get('.waveform-annotation-layer').element
    const legendLayer = wrapper.get('.waveform-chart__legend-layer').element
    expect(
      annotationLayer.compareDocumentPosition(legendLayer) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    const highLegendItem = wrapper.findAll('.waveform-chart__legend-item')[1]
    expect(highLegendItem.attributes('aria-pressed')).toBe('true')

    await highLegendItem.trigger('click')
    await flushPromises()

    expect(
      wrapper.findAll('.waveform-chart__line').map((line) => line.attributes('data-series-id')),
    ).toEqual(['low'])
    expect(wrapper.findAll('.waveform-chart__axis--y')).toHaveLength(1)
    expect(wrapper.find('[data-annotation-id="high-note"]').exists()).toBe(false)
    expect(wrapper.findAll('.waveform-chart__legend-item')[1].classes()).toContain('is-hidden')
    expect(wrapper.findAll('.waveform-chart__legend-item')[1].attributes('aria-pressed')).toBe(
      'false',
    )
    expect(wrapper.emitted('update:hidden-series-ids')?.at(-1)).toEqual([['high']])
    expect(wrapper.emitted('series-visibility-change')?.at(-1)).toEqual([
      { seriesId: 'high', visible: false, hiddenSeriesIds: ['high'] },
    ])

    const overlay = wrapper.get('.waveform-chart__overlay--independent')
    const overlayWidth = Number(overlay.attributes('width'))
    const overlayHeight = Number(overlay.attributes('height'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: overlayHeight }),
    })
    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', {
        clientX: overlayWidth / 2,
        clientY: overlayHeight / 2,
        bubbles: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.findAll('.waveform-chart__tooltip-series')).toHaveLength(1)
    expect(wrapper.get('.waveform-chart__tooltip-series').text()).toContain('低量程')

    await wrapper.findAll('.waveform-chart__legend-item')[1].trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.waveform-chart__line')).toHaveLength(2)
    expect(wrapper.find('[data-annotation-id="high-note"]').exists()).toBe(true)
    expect(wrapper.emitted('series-visibility-change')?.at(-1)).toEqual([
      { seriesId: 'high', visible: true, hiddenSeriesIds: [] },
    ])
  })

  it('waits for controlled visibility updates and preserves unknown controlled IDs', async () => {
    const wrapper = await mountSizedChart(visibilitySeries(), {
      grid: { rowCount: 1, columnCount: 1 },
      hiddenSeriesIds: ['high', 'temporarily-absent'],
      legend: { interactive: true },
    })

    expect(
      wrapper.findAll('.waveform-chart__line').map((line) => line.attributes('data-series-id')),
    ).toEqual(['low'])
    await wrapper.findAll('.waveform-chart__legend-item')[0].trigger('click')
    expect(wrapper.emitted('update:hidden-series-ids')?.at(-1)).toEqual([
      ['high', 'temporarily-absent', 'low'],
    ])
    expect(
      wrapper.findAll('.waveform-chart__line').map((line) => line.attributes('data-series-id')),
    ).toEqual(['low'])

    await wrapper.setProps({ hiddenSeriesIds: ['low'] })
    await flushPromises()
    expect(
      wrapper.findAll('.waveform-chart__line').map((line) => line.attributes('data-series-id')),
    ).toEqual(['high'])
  })

  it('retains uncontrolled visibility by stable ID and clears removed IDs', async () => {
    const original = visibilitySeries()
    const wrapper = await mountSizedChart(original, {
      grid: { rowCount: 1, columnCount: 1 },
      legend: { interactive: true },
    })
    await wrapper.findAll('.waveform-chart__legend-item')[1].trigger('click')

    const reversed: WaveformData = {
      kind: 'series',
      series: [...(original.kind === 'series' ? original.series : [])].reverse(),
    }
    await wrapper.setProps({ data: reversed })
    await flushPromises()
    expect(
      wrapper.findAll('.waveform-chart__line').map((line) => line.attributes('data-series-id')),
    ).toEqual(['low'])

    await wrapper.setProps({
      data: {
        kind: 'series',
        series: original.kind === 'series' ? [original.series[0]!] : [],
      },
    })
    await flushPromises()
    await wrapper.setProps({ data: original })
    await flushPromises()
    expect(wrapper.findAll('.waveform-chart__line')).toHaveLength(2)
  })

  it('keeps a recoverable legend and stops chart interaction when every series is hidden', async () => {
    const wrapper = await mountSizedChart(visibilitySeries(), {
      defaultHiddenSeriesIds: ['low', 'high'],
      grid: { rowCount: 1, columnCount: 1 },
      legend: { interactive: true },
      overlayMode: 'multi-axis',
    })

    expect(wrapper.findAll('.waveform-chart__line')).toHaveLength(0)
    expect(wrapper.findAll('.waveform-chart__axis')).toHaveLength(0)
    expect(wrapper.findAll('.waveform-chart__overlay')).toHaveLength(0)
    expect(wrapper.findAll('.waveform-chart__legend-item')).toHaveLength(2)
    expect(wrapper.get('.waveform-track__no-visible-series').text()).toBe('暂无可见曲线')

    await wrapper.findAll('.waveform-chart__legend-item')[0].trigger('click')
    await flushPromises()
    expect(
      wrapper.findAll('.waveform-chart__line').map((line) => line.attributes('data-series-id')),
    ).toEqual(['low'])
    expect(wrapper.findAll('.waveform-chart__axis--x')).toHaveLength(1)
    expect(wrapper.findAll('.waveform-chart__axis--y')).toHaveLength(1)
    expect(wrapper.findAll('.waveform-chart__overlay--independent')).toHaveLength(1)
  })

  it('closes an annotation editor when its series is hidden from the legend', async () => {
    const wrapper = await mountSizedChart(visibilitySeries(), {
      grid: { rowCount: 1, columnCount: 1 },
      legend: { interactive: true },
    })
    const overlay = wrapper.get('.waveform-chart__overlay--independent')
    const overlayWidth = Number(overlay.attributes('width'))
    const overlayHeight = Number(overlay.attributes('height'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: overlayHeight }),
    })
    overlay.element.dispatchEvent(
      new MouseEvent('contextmenu', {
        clientX: overlayWidth * 0.75,
        clientY: overlayHeight / 2,
        bubbles: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.find('.waveform-annotation-editor').exists()).toBe(true)

    const component = wrapper.vm as typeof wrapper.vm & {
      annotationInteraction: { editorDraft: { value: { annotation: { seriesId: string } } | null } }
    }
    const draftSeriesId = component.annotationInteraction.editorDraft.value?.annotation.seriesId
    const item = wrapper
      .findAll('.waveform-chart__legend-item')
      .find((legendItem) =>
        legendItem.text().includes(draftSeriesId === 'high' ? '高量程' : '低量程'),
      )
    expect(item).toBeDefined()
    await item!.trigger('click')
    await flushPromises()
    expect(wrapper.find('.waveform-annotation-editor').exists()).toBe(false)
  })

  it('renders independent cells with separate x axes and overlays', async () => {
    const wrapper = await mountSizedChart(gridSeries(4), {
      displayMode: 'independent',
      grid: { rowCount: 2, columnCount: 2 },
    })

    expect(wrapper.findAll('.waveform-chart__track')).toHaveLength(4)
    expect(wrapper.findAll('.waveform-chart__axis--x')).toHaveLength(4)
    expect(wrapper.findAll('.waveform-chart__overlay--independent')).toHaveLength(4)
    const tracks = wrapper.findAll('.waveform-chart__track')
    const firstTop = Number(tracks[0].attributes('data-track-top'))
    const secondRowTop = Number(tracks[2].attributes('data-track-top'))
    const firstHeight = Number(tracks[0].attributes('data-track-height'))
    expect(secondRowTop).toBeGreaterThan(firstTop + firstHeight + 20)
  })

  it('reserves horizontal clearance for Y-axis labels in multi-column grids', async () => {
    for (const displayMode of ['independent', 'separated', 'compact'] as const) {
      const wrapper = await mountSizedChart(gridSeries(4), {
        displayMode,
        grid: { rowCount: 2, columnCount: 2 },
      })
      const tracks = wrapper.findAll('.waveform-chart__track')
      const firstLeft = Number(tracks[0].attributes('data-track-left') ?? 0)
      const firstWidth = Number(tracks[0].attributes('data-track-width'))
      const secondLeft = Number(tracks[1].attributes('data-track-left'))
      const labelX = Number(tracks[1].attributes('data-y-axis-label-x'))

      expect(secondLeft - (firstLeft + firstWidth)).toBeGreaterThanOrEqual(Math.abs(labelX) + 16)
      expect(tracks[1].find('.waveform-chart__y-axis-label-bg').exists()).toBe(true)
    }
  })

  it('expands the Y-axis label gutter for signed values and long exponents', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: Array.from({ length: 4 }, (_, index) => ({
          id: `wide-axis-${index}`,
          name: `宽范围 ${index + 1}`,
          data: {
            kind: 'points',
            points: [
              { x: 0, y: -1e120 },
              { x: 0.5, y: 0 },
              { x: 1, y: 1e120 },
            ],
          },
        })),
      },
      { displayMode: 'compact', grid: { rowCount: 2, columnCount: 2 } },
    )
    const tracks = wrapper.findAll('.waveform-chart__track')
    const labelX = Number(tracks[0].attributes('data-y-axis-label-x'))
    const firstWidth = Number(tracks[0].attributes('data-track-width'))
    const secondLeft = Number(tracks[1].attributes('data-track-left'))
    const labelBackgroundX = Number(
      tracks[0].get('.waveform-chart__y-axis-label-bg').attributes('x'),
    )

    expect(labelX).toBe(-103)
    expect(labelBackgroundX).toBe(labelX - 12)
    expect(Number(wrapper.attributes('data-chart-left-margin'))).toBe(119)
    expect(secondLeft - firstWidth).toBeGreaterThanOrEqual(119)
  })

  it('keeps a tick-only gutter when channel labels are empty', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: Array.from({ length: 2 }, (_, index) => ({
          id: `unnamed-${index}`,
          name: '',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: -1e120 },
              { x: 1, y: 1e120 },
            ],
          },
        })),
      },
      { yLabel: '', grid: { rowCount: 1, columnCount: 2 } },
    )
    const tracks = wrapper.findAll('.waveform-chart__track')
    const firstWidth = Number(tracks[0].attributes('data-track-width'))
    const secondLeft = Number(tracks[1].attributes('data-track-left'))

    expect(wrapper.findAll('.waveform-chart__y-axis-label')).toHaveLength(0)
    expect(Number(wrapper.attributes('data-chart-left-margin'))).toBe(89)
    expect(secondLeft - firstWidth).toBeGreaterThanOrEqual(89)
  })

  it('keeps the Y-axis label gutter stable while paging between value ranges', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'short-axis',
            name: '短范围',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
            },
          },
          {
            id: 'wide-axis',
            name: '宽范围',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: -1e120 },
                { x: 1, y: 1e120 },
              ],
            },
          },
        ],
      },
      { grid: { rowCount: 1, columnCount: 1 } },
    )
    const initialMargin = wrapper.attributes('data-chart-left-margin')
    const initialLabelX = wrapper.get('.waveform-chart__track').attributes('data-y-axis-label-x')

    await wrapper.get('.ant-pagination-next button').trigger('click')

    expect(wrapper.attributes('data-chart-left-margin')).toBe(initialMargin)
    expect(wrapper.get('.waveform-chart__track').attributes('data-y-axis-label-x')).toBe(
      initialLabelX,
    )
  })

  it('hides only secondary-column Y-axis labels when the grid is too narrow', async () => {
    const wrapper = await mountSizedChart(gridSeries(4), {
      displayMode: 'independent',
      grid: { rowCount: 2, columnCount: 2 },
    })

    resizeObservers.at(-1)?.resize(120, 360)
    await flushPromises()

    expect(wrapper.findAll('.waveform-chart__y-axis-label')).toHaveLength(2)
    expect(wrapper.findAll('.waveform-chart__axis--y')).toHaveLength(4)
    const tracks = wrapper.findAll('.waveform-chart__track')
    const firstWidth = Number(tracks[0].attributes('data-track-width'))
    const secondLeft = Number(tracks[1].attributes('data-track-left'))
    expect(secondLeft - firstWidth).toBeGreaterThanOrEqual(39)
  })

  it('uses one shared overlay and bottom-row x axes for separated and compact grids', async () => {
    for (const displayMode of ['separated', 'compact'] as const) {
      const wrapper = await mountSizedChart(gridSeries(4), {
        displayMode,
        grid: { rowCount: 2, columnCount: 2 },
      })
      expect(wrapper.findAll('.waveform-chart__overlay--shared')).toHaveLength(1)
      expect(wrapper.findAll('.waveform-chart__axis--x')).toHaveLength(2)
      const tracks = wrapper.findAll('.waveform-chart__track')
      const firstTop = Number(tracks[0].attributes('data-track-top'))
      const secondRowTop = Number(tracks[2].attributes('data-track-top'))
      const firstHeight = Number(tracks[0].attributes('data-track-height'))
      if (displayMode === 'compact') expect(secondRowTop).toBe(firstTop + firstHeight)
      else expect(secondRowTop).toBeGreaterThan(firstTop + firstHeight)
    }
  })

  it('keeps unused compact cells visually empty while preserving bottom X axes', async () => {
    const data = gridSeries(4)
    if (data.kind === 'series') {
      data.series.forEach((series, index) => {
        series.data = {
          kind: 'points',
          points: [
            { x: 100, y: index },
            { x: 200, y: index + 1 },
          ],
        }
      })
    }
    const wrapper = await mountSizedChart(data, {
      displayMode: 'compact',
      grid: { rowCount: 2, columnCount: 3 },
    })

    const tracks = wrapper.findAll('.waveform-chart__track')
    const emptyTracks = wrapper.findAll('.waveform-chart__track--empty')
    const firstTrackTop = Number(tracks[0].attributes('data-track-top'))
    const firstTrackHeight = Number(tracks[0].attributes('data-track-height'))
    const secondRowFirstTrackTop = Number(tracks[3].attributes('data-track-top'))

    expect(tracks).toHaveLength(6)
    expect(emptyTracks).toHaveLength(2)
    expect(wrapper.find('.waveform-chart__grid-slot-placeholder').exists()).toBe(false)
    expect(secondRowFirstTrackTop).toBe(firstTrackTop + firstTrackHeight)
    expect(wrapper.findAll('.waveform-chart__axis--x')).toHaveLength(3)
    expect(wrapper.findAll('.waveform-chart__line')).toHaveLength(4)
    expect(emptyTracks[0].findAll('.waveform-chart__grid')).toHaveLength(0)
    expect(emptyTracks[0].find('.waveform-chart__plot-background').exists()).toBe(false)
    expect(emptyTracks[0].find('.waveform-chart__plot-frame').exists()).toBe(false)
    expect(emptyTracks[0].find('.waveform-chart__axis--y').exists()).toBe(false)
    expect(emptyTracks[0].find('.waveform-chart__line').exists()).toBe(false)
    expect(emptyTracks[0].find('.waveform-chart__y-axis-label').exists()).toBe(false)
    expect(emptyTracks[0].find('.waveform-chart__watermark').exists()).toBe(false)

    const populatedBottomTrack = tracks[3]
    expect(emptyTracks[0].get('.waveform-chart__axis-endpoint--start').text()).toBe(
      populatedBottomTrack.get('.waveform-chart__axis-endpoint--start').text(),
    )
    expect(emptyTracks[0].get('.waveform-chart__axis-endpoint--end').text()).toBe(
      populatedBottomTrack.get('.waveform-chart__axis-endpoint--end').text(),
    )
  })

  it('shows the global empty state when compact data has no valid channels', async () => {
    const wrapper = await mountSizedChart(
      { kind: 'samples', values: [1], sampleRate: -1 },
      { displayMode: 'compact', grid: { rowCount: 2, columnCount: 3 } },
    )

    expect(wrapper.get('.waveform-chart__empty').text()).toContain('暂无有效波形数据')
    expect(wrapper.findAll('.waveform-chart__track')).toHaveLength(0)
    expect(wrapper.findAll('.waveform-chart__axis--x')).toHaveLength(0)
    expect(wrapper.findAll('.waveform-chart__line')).toHaveLength(0)
  })

  it('resets the page when the grid configuration changes', async () => {
    const wrapper = await mountSizedChart(gridSeries(5), {
      grid: { rowCount: 1, columnCount: 1 },
    })
    await wrapper.get('.ant-pagination-next button').trigger('click')
    expect(wrapper.get('.ant-pagination-item-2').classes()).toContain('ant-pagination-item-active')

    await wrapper.setProps({ grid: { rowCount: 2, columnCount: 1 } })
    await flushPromises()
    expect(wrapper.get('.ant-pagination-item-1').classes()).toContain('ant-pagination-item-active')
  })

  it('keeps the shared x domain stable while paging separated and compact grids', async () => {
    for (const displayMode of ['separated', 'compact'] as const) {
      const wrapper = await mountSizedChart(gridSeries(3), {
        displayMode,
        grid: { rowCount: 1, columnCount: 1 },
      })
      const initialEnd = wrapper.get('.waveform-chart__axis-endpoint--end').text()
      await wrapper.get('.ant-pagination-next button').trigger('click')
      expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe(initialEnd)
    }
  })

  it('uses each track x domain in independent mode instead of the shared initial domain', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'narrow-track',
            name: '窄范围',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 0.006, y: 1 },
              ],
            },
          },
          {
            id: 'wide-track',
            name: '宽范围',
            data: {
              kind: 'points',
              points: [
                { x: -8, y: 0 },
                { x: 5, y: 1 },
              ],
            },
          },
        ],
      },
      {
        displayMode: 'independent',
        grid: { rowCount: 1, columnCount: 2 },
        initialXDomain: [-8, 5],
      },
    )

    const tracks = wrapper.findAll('.waveform-chart__track')
    expect(tracks[0]?.get('.waveform-chart__axis-endpoint--end').text()).toBe('6.00')
    expect(tracks[1]?.get('.waveform-chart__axis-endpoint--end').text()).toBe('5.00')
  })

  it('uses an explicit initial x domain override for an independent track', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'narrow-track',
            name: '窄范围',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 0.006, y: 1 },
              ],
            },
          },
        ],
      },
      {
        displayMode: 'independent',
        initialXDomain: [-8, 5],
        initialXDomains: { 'narrow-track': [0, 1] },
      },
    )

    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('1.00')
  })

  it('keeps annotations bound to their channel while paging', async () => {
    const wrapper = await mountSizedChart(gridSeries(3), {
      grid: { rowCount: 1, columnCount: 1 },
      annotations: [
        { id: 'channel-2-note', seriesId: 'channel-1', x: 1, y: 2, text: '当前页标注' },
      ],
    })
    expect(wrapper.find('[data-annotation-id="channel-2-note"]').exists()).toBe(false)
    await wrapper.get('.ant-pagination-next button').trigger('click')
    expect(wrapper.find('[data-annotation-id="channel-2-note"]').exists()).toBe(true)
  })
  it('renders a path for sample data and responds to width changes', async () => {
    const wrapper = await mountSizedChart({
      kind: 'samples',
      values: [0, 1, -1, 0.5],
      sampleRate: 4,
    })
    const initialPath = wrapper.get('.waveform-chart__line').attributes('d')

    expect(initialPath).toContain('L')
    expect(wrapper.get('.waveform-chart__svg').attributes('width')).toBe('800')
    expect(wrapper.find('.waveform-annotation-toolbar').exists()).toBe(false)
    expect(wrapper.attributes('data-interaction-mode')).toBeUndefined()

    resizeObservers.at(-1)?.resize(500, 360)
    await flushPromises()

    expect(wrapper.get('.waveform-chart__svg').attributes('width')).toBe('500')
    expect(wrapper.get('.waveform-chart__line').attributes('d')).not.toBe(initialPath)
  })

  it('uses fixed dimensions when both width and height are specified', async () => {
    const wrapper = mount(WaveformChart, {
      props: {
        data: { kind: 'samples', values: [0, 1], sampleRate: 1 },
        width: 640,
        height: 420,
      },
    })

    expect(wrapper.attributes('style')).toContain('width: 640px')
    expect(wrapper.attributes('style')).toContain('height: 420px')
    expect(wrapper.get('.waveform-chart__svg').attributes('width')).toBe('640')
    expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('420')

    resizeObservers.at(-1)?.resize(640, 420)
    await flushPromises()

    expect(wrapper.get('.waveform-chart__svg').attributes('width')).toBe('640')
    expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('420')
  })

  it('allows fixed width and adaptive height to work independently', async () => {
    const wrapper = mount(WaveformChart, {
      props: {
        data: { kind: 'samples', values: [0, 1], sampleRate: 1 },
        width: 640,
      },
    })

    expect(wrapper.attributes('style')).toContain('width: 640px')
    expect(wrapper.attributes('style')).toContain('height: 100%')

    resizeObservers.at(-1)?.resize(640, 500)
    await flushPromises()

    expect(wrapper.get('.waveform-chart__svg').attributes('width')).toBe('640')
    expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('500')
  })

  it('allows adaptive width and fixed height to work independently', async () => {
    const wrapper = mount(WaveformChart, {
      props: {
        data: { kind: 'samples', values: [0, 1], sampleRate: 1 },
        height: 420,
      },
    })

    expect(wrapper.attributes('style')).toContain('width: 100%')
    expect(wrapper.attributes('style')).toContain('height: 420px')

    resizeObservers.at(-1)?.resize(900, 420)
    await flushPromises()

    expect(wrapper.get('.waveform-chart__svg').attributes('width')).toBe('900')
    expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('420')
  })

  it('fills both dimensions and responds to container size changes by default', async () => {
    const wrapper = mount(WaveformChart, {
      props: { data: { kind: 'samples', values: [0, 1], sampleRate: 1 } },
    })

    expect(wrapper.attributes('style')).toContain('width: 100%')
    expect(wrapper.attributes('style')).toContain('height: 100%')
    expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('180')

    resizeObservers.at(-1)?.resize(800, 520)
    await flushPromises()
    expect(wrapper.get('.waveform-chart__svg').attributes('width')).toBe('800')
    expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('520')

    resizeObservers.at(-1)?.resize(500, 300)
    await flushPromises()
    expect(wrapper.get('.waveform-chart__svg').attributes('width')).toBe('500')
    expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('300')
  })

  it('does not render or reserve space for missing, hidden, or blank titles', async () => {
    for (const title of [undefined, { visible: false, text: '隐藏标题' }, { text: '   ' }]) {
      const wrapper = await mountSizedChart(
        { kind: 'samples', values: [0, 1], sampleRate: 1 },
        title ? { title } : {},
      )

      expect(wrapper.find('.waveform-chart__title-area').exists()).toBe(false)
      expect(wrapper.attributes('data-title-area-height')).toBe('0')
      expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('360')
    }
  })

  it.each(['independent', 'separated', 'compact'] as const)(
    'keeps the titled empty state inside the drawing area in %s mode',
    async (displayMode) => {
      const wrapper = await mountSizedChart(
        { kind: 'samples', values: [1], sampleRate: -1 },
        { displayMode, title: { text: '空数据标题' } },
      )

      expect(wrapper.get('.waveform-chart__title-text').text()).toBe('空数据标题')
      expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('316')
      expect(wrapper.get('.waveform-chart__empty').attributes('y')).toBe('158')
    },
  )

  it('renders one chart title with alignment and all supported text styles', async () => {
    const wrapper = await mountSizedChart(
      { kind: 'samples', values: [0, 1], sampleRate: 1 },
      {
        title: {
          text: '  shot: #4712  ',
          align: 'right',
          textStyle: {
            color: '#c026d3',
            fontSize: 18,
            fontFamily: 'Consolas',
            rotation: 0,
            fontWeight: 700,
            fontStyle: 'italic',
            textDecoration: 'underline',
            letterSpacing: '2px',
          },
        },
      },
    )

    const area = wrapper.get('.waveform-chart__title-area')
    const visual = wrapper.get('.waveform-chart__title-visual')
    const title = wrapper.get('.waveform-chart__title-text')
    expect(area.attributes('role')).toBe('heading')
    expect(area.attributes('style')).toContain('justify-content: flex-end')
    expect(title.text()).toBe('shot: #4712')
    expect(title.attributes('style')).toContain('color: rgb(192, 38, 211)')
    expect(title.attributes('style')).toContain('font-size: 18px')
    expect(title.attributes('style')).toContain('font-family: Consolas')
    expect(title.attributes('style')).toContain('font-weight: 700')
    expect(title.attributes('style')).toContain('font-style: italic')
    expect(title.attributes('style')).toContain('text-decoration: underline')
    expect(title.attributes('style')).toContain('letter-spacing: 2px')
    expect(visual.attributes('style')).toContain('width: 752px')
    expect(title.attributes('style')).toContain('width: 752px')
    expect(title.attributes('style')).toContain('rotate(0deg)')
    expect(wrapper.attributes('data-title-area-height')).toBe('44')
    expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('316')
  })

  it('normalizes invalid title numbers and wraps long titles at narrow widths', async () => {
    const wrapper = await mountSizedChart(
      { kind: 'samples', values: [0, 1], sampleRate: 1 },
      {
        title: {
          text: '这是一个用于验证窄屏省略行为的很长波形分析标题',
          textStyle: { fontSize: Number.NaN, rotation: Number.POSITIVE_INFINITY },
        },
      },
    )
    resizeObservers.at(-1)?.resize(160, 360)
    await flushPromises()

    const title = wrapper.get('.waveform-chart__title-text')
    expect(title.attributes('style')).toContain('font-size: 14px')
    expect(title.attributes('style')).toContain('Microsoft YaHei')
    expect(title.attributes('style')).toContain('font-weight: 400')
    expect(title.attributes('style')).toContain('rotate(0deg)')
    expect(title.attributes('style')).toContain('white-space: normal')
    expect(title.attributes('style')).toContain('overflow-wrap: anywhere')
    expect(title.attributes('title')).toBeUndefined()
    expect(title.attributes('data-title-wrapped')).toBe('true')
    expect(Number(wrapper.attributes('data-title-area-height'))).toBeGreaterThan(44)
  })

  it.each([45, 90, -90, 180])(
    'scales a complete long title into the rotated title area at %s degrees',
    async (rotation) => {
      const wrapper = await mountSizedChart(
        { kind: 'samples', values: [0, 1], sampleRate: 1 },
        {
          title: {
            text: '这是一个用于验证旋转缩放行为的完整波形分析标题',
            textStyle: { rotation },
          },
        },
      )
      const titleHeight = Number(wrapper.attributes('data-title-area-height'))
      const title = wrapper.get('.waveform-chart__title-text')

      expect(titleHeight).toBeGreaterThanOrEqual(44)
      expect(titleHeight).toBeLessThanOrEqual(160)
      expect(Number(wrapper.get('.waveform-chart__svg').attributes('height'))).toBe(
        360 - titleHeight,
      )
      expect(title.text()).toBe('这是一个用于验证旋转缩放行为的完整波形分析标题')
      expect(title.attributes('style')).toContain(`rotate(${rotation}deg)`)
      expect(title.attributes('style')).toContain('white-space: nowrap')
      expect(Number(title.attributes('data-title-scale'))).toBeLessThanOrEqual(1)
      expect(title.attributes('data-title-wrapped')).toBeUndefined()
    },
  )

  it('updates fixed and adaptive drawing heights when the title changes', async () => {
    const fixedWrapper = mount(WaveformChart, {
      props: {
        data: { kind: 'samples', values: [0, 1], sampleRate: 1 },
        height: 420,
        title: { text: '固定高度标题' },
      },
    })
    expect(fixedWrapper.get('.waveform-chart__svg').attributes('height')).toBe('376')

    await fixedWrapper.setProps({ title: { visible: false, text: '固定高度标题' } })
    expect(fixedWrapper.get('.waveform-chart__svg').attributes('height')).toBe('420')

    const adaptiveWrapper = await mountSizedChart(
      { kind: 'samples', values: [0, 1], sampleRate: 1 },
      { title: { text: '自适应高度标题' } },
    )
    expect(adaptiveWrapper.get('.waveform-chart__svg').attributes('height')).toBe('316')
    resizeObservers.at(-1)?.resize(800, 500)
    await flushPromises()
    expect(adaptiveWrapper.get('.waveform-chart__svg').attributes('height')).toBe('456')
  })

  it('includes the title offset in root-relative tooltip positioning', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { title: { text: 'shot: #4712' }, grid: { rowCount: 1, columnCount: 1 } },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    const overlayWidth = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: 246 }),
    })

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: overlayWidth / 2, clientY: 100, bubbles: true }),
    )
    flushAnimationFrames()
    await flushPromises()

    const tooltipTop = Number.parseFloat(
      (wrapper.get('.waveform-chart__tooltip').element as HTMLElement).style.top,
    )
    expect(tooltipTop).toBeGreaterThanOrEqual(44)
  })

  it('includes the title offset in annotation editor anchors', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { title: { text: 'shot: #4712' }, grid: { rowCount: 1, columnCount: 1 } },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    const overlayWidth = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: 246 }),
    })
    overlay.element.dispatchEvent(
      new MouseEvent('contextmenu', {
        clientX: overlayWidth / 2,
        clientY: 100,
        bubbles: true,
      }),
    )
    await flushPromises()

    const component = wrapper.vm as typeof wrapper.vm & {
      annotationInteraction: {
        editorDraft: {
          value: { anchor: { x: number; y: number } } | null
        }
      }
    }
    expect(component.annotationInteraction.editorDraft.value?.anchor.y).toBe(162)
  })

  it('suppresses native context menus across the waveform component', async () => {
    const wrapper = await mountSizedChart(gridSeries(2), {
      title: { text: '波形标题' },
      grid: { rowCount: 1, columnCount: 1, showPagination: true },
      showAnnotationToolbar: true,
    })

    for (const selector of [
      '.waveform-chart__title-area',
      '.waveform-chart__grid',
      '.waveform-chart__overlay',
      '.waveform-chart__pagination',
      '.waveform-annotation-toolbar',
    ]) {
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
      const dispatched = wrapper.get(selector).element.dispatchEvent(event)

      expect(dispatched).toBe(false)
      expect(event.defaultPrevented).toBe(true)
    }

    const sharedWrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
      { displayMode: 'separated' },
    )
    const sharedEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    const sharedDispatched = sharedWrapper
      .get('.waveform-chart__overlay--shared')
      .element.dispatchEvent(sharedEvent)

    expect(sharedDispatched).toBe(false)
    expect(sharedEvent.defaultPrevented).toBe(true)
  })

  it('preserves native context menus for editable controls', async () => {
    const wrapper = await mountSizedChart({ kind: 'samples', values: [0, 1], sampleRate: 1 })
    const editableElements = [
      document.createElement('input'),
      document.createElement('textarea'),
      document.createElement('div'),
    ]
    editableElements[2]?.setAttribute('contenteditable', 'true')

    for (const element of editableElements) {
      wrapper.element.appendChild(element)
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
      const dispatched = element.dispatchEvent(event)

      expect(dispatched).toBe(true)
      expect(event.defaultPrevented).toBe(false)
    }
  })

  it('applies size fallbacks for minimum, negative, and non-finite values', async () => {
    const minimumWrapper = mount(WaveformChart, {
      props: {
        data: { kind: 'samples', values: [0, 1], sampleRate: 1 },
        width: -20,
        height: -20,
      },
    })

    expect(minimumWrapper.attributes('style')).toContain('width: 0px')
    expect(minimumWrapper.attributes('style')).toContain('height: 180px')
    expect(minimumWrapper.get('.waveform-chart__svg').attributes('height')).toBe('180')

    const adaptiveWrapper = mount(WaveformChart, {
      props: {
        data: { kind: 'samples', values: [0, 1], sampleRate: 1 },
        width: Number.POSITIVE_INFINITY,
        height: Number.NaN,
      },
    })

    expect(adaptiveWrapper.attributes('style')).toContain('width: 100%')
    expect(adaptiveWrapper.attributes('style')).toContain('height: 100%')
  })

  it('keeps a 100k-point SVG path bounded by the plot width', async () => {
    const sourcePoints = Array.from({ length: 100_000 }, (_, index) => ({
      x: index / 1_000,
      y: index === 50_001 ? 100 : Math.sin(index / 50),
    }))
    const wrapper = await mountSizedChart(
      { kind: 'points', points: sourcePoints },
      { rendering: { downsampleThreshold: 1_000, maxPointsPerPixel: 4 } },
    )
    const overlayWidth = Number(wrapper.get('.waveform-chart__overlay').attributes('width'))
    const path = wrapper.get('.waveform-chart__line').attributes('d') ?? ''
    const renderedPointCount = path.match(/[ML]/g)?.length ?? 0

    expect(renderedPointCount).toBeGreaterThan(0)
    expect(renderedPointCount).toBeLessThanOrEqual(Math.floor(overlayWidth * 4) + 2)
    expect(path).toContain(',0')
  })

  it('bounds dense decorations by pixel spacing while keeping one SVG path per series', async () => {
    const sourcePoints = Array.from({ length: 1_000 }, (_, index) => ({
      x: index,
      y: Math.sin(index / 20),
      error: 0.1,
    }))
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'dense-decorations',
            name: '密集标记',
            pointType: 'triangle',
            errorBar: { visible: true },
            data: { kind: 'points', points: sourcePoints },
          },
        ],
      },
      { rendering: { pointMinSpacing: 10, errorBarMinSpacing: 12 } },
    )
    const overlayWidth = Number(wrapper.get('.waveform-chart__overlay').attributes('width'))
    const pointPaths = wrapper.findAll('.waveform-chart__point')
    const errorBarPaths = wrapper.findAll('.waveform-chart__error-bar')
    const pointCount = pointPaths[0]?.attributes('d')?.match(/M/g)?.length ?? 0
    const errorBarCount = (errorBarPaths[0]?.attributes('d')?.match(/M/g)?.length ?? 0) / 3

    expect(pointPaths).toHaveLength(1)
    expect(errorBarPaths).toHaveLength(1)
    expect(pointCount).toBeLessThanOrEqual(Math.ceil(overlayWidth / 10) + 2)
    expect(errorBarCount).toBeLessThanOrEqual(Math.ceil(overlayWidth / 12) + 2)
  })

  it('renders explicit points and supports a single point', async () => {
    const wrapper = await mountSizedChart({ kind: 'points', points: [{ x: 3, y: 8 }] })

    expect(wrapper.get('.waveform-chart__line').attributes('d')).toContain('M')
    expect(wrapper.find('.waveform-chart__empty').exists()).toBe(false)
  })

  it('shows an empty state for empty and invalid data', async () => {
    const wrapper = await mountSizedChart({ kind: 'samples', values: [1], sampleRate: -1 })

    expect(wrapper.get('.waveform-chart__empty').text()).toContain('暂无有效波形数据')
    expect(wrapper.find('.waveform-chart__line').exists()).toBe(false)
  })

  it('emits the nearest point on hover and clears it on leave', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { grid: { rowCount: 1, columnCount: 1 } },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    const overlayWidth = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: 290 }),
    })

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 700, clientY: 120, bubbles: true }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.emitted('point-hover')?.at(-1)).toEqual([{ x: 1, y: 5 }])
    expect(wrapper.find('.waveform-chart__tooltip').exists()).toBe(true)
    expect(wrapper.get('.waveform-chart__tooltip').text()).toContain('ms: 1,000.0000')
    const crosshairLines = wrapper.findAll('.waveform-chart__crosshair line')
    expect(crosshairLines).toHaveLength(1)
    expect(crosshairLines[0].attributes('x1')).toBe(crosshairLines[0].attributes('x2'))
    expect(crosshairLines[0].attributes('y1')).toBe('0')
    expect(wrapper.find('.waveform-chart__crosshair circle').exists()).toBe(false)

    await overlay.trigger('pointerleave')
    expect(wrapper.emitted('point-hover')?.at(-1)).toEqual([null])
  })

  it('coalesces pointer moves per frame and cancels pending hover work', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { grid: { rowCount: 1, columnCount: 1 } },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    const overlayWidth = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: 290 }),
    })
    const emittedBeforeMove = wrapper.emitted('point-hover')?.length ?? 0

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 0, clientY: 100, bubbles: true }),
    )
    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: overlayWidth, clientY: 120, bubbles: true }),
    )

    expect(pendingAnimationFrameCount()).toBe(1)
    expect(wrapper.emitted('point-hover')?.length ?? 0).toBe(emittedBeforeMove)
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.emitted('point-hover')).toHaveLength(emittedBeforeMove + 1)
    expect(wrapper.emitted('point-hover')?.at(-1)).toEqual([{ x: 1, y: 5 }])

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 0, clientY: 100, bubbles: true }),
    )
    expect(pendingAnimationFrameCount()).toBe(1)
    await overlay.trigger('pointerleave')
    const emittedAfterLeave = wrapper.emitted('point-hover')?.length ?? 0
    expect(pendingAnimationFrameCount()).toBe(0)
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.emitted('point-hover')).toHaveLength(emittedAfterLeave)
    expect(wrapper.emitted('point-hover')?.at(-1)).toEqual([null])

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: overlayWidth, clientY: 100, bubbles: true }),
    )
    expect(pendingAnimationFrameCount()).toBe(1)
    wrapper.unmount()
    expect(pendingAnimationFrameCount()).toBe(0)
  })

  it('renders reference grid styling and an optional frame watermark', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
      { frameNumber: 12 },
    )

    expect(wrapper.findAll('.waveform-chart__grid--major line').length).toBeGreaterThan(0)
    expect(wrapper.findAll('.waveform-chart__grid--minor line').length).toBeGreaterThan(0)
    expect(wrapper.find('.waveform-chart__plot-frame').exists()).toBe(true)
    expect(wrapper.get('.waveform-chart__plot-frame').attributes()).toMatchObject({
      fill: 'none',
      stroke: '#1f2937',
      'stroke-width': '1',
    })
    expect(
      wrapper.get('.waveform-chart__plot-frame').attributes('stroke-dasharray'),
    ).toBeUndefined()
    expect(wrapper.get('.waveform-chart__plot-background').attributes('fill')).toBe('transparent')
    expect(wrapper.get('.waveform-chart__watermark').text()).toBe('12')
    expect(getComputedStyle(wrapper.get('.waveform-chart__watermark').element).userSelect).toBe(
      'none',
    )
    expect(wrapper.get('.waveform-chart__line').attributes('stroke')).toBe('#0960bd')
  })

  it('applies one custom frame style to every non-empty track', async () => {
    const wrapper = await mountSizedChart(gridSeries(2), {
      grid: { rowCount: 2, columnCount: 1 },
      frameStyle: {
        borderColor: 'rgba(255, 0, 0, 0.7)',
        borderWidth: 2.5,
        borderStyle: 'dashed',
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
      },
    })

    const tracks = wrapper.findAll('.waveform-chart__track')
    const frames = wrapper.findAll('.waveform-chart__plot-frame')
    const backgrounds = wrapper.findAll('.waveform-chart__plot-background')

    expect(frames).toHaveLength(2)
    expect(backgrounds).toHaveLength(2)
    frames.forEach((frame) => {
      expect(frame.attributes()).toMatchObject({
        stroke: 'rgba(255, 0, 0, 0.7)',
        'stroke-width': '2.5',
        'stroke-dasharray': '6 4',
      })
    })
    backgrounds.forEach((background) => {
      expect(background.attributes('fill')).toBe('rgba(16, 185, 129, 0.2)')
    })

    tracks.forEach((track) => {
      const renderingLayers = track.findAll(
        '.waveform-chart__plot-background, .waveform-chart__grid',
      )
      expect(renderingLayers[0].classes()).toContain('waveform-chart__plot-background')
    })
  })

  it('falls back to the default width for invalid frame widths', async () => {
    const wrapper = await mountSizedChart(gridSeries(1), {
      frameStyle: { borderWidth: -1 },
    })

    expect(wrapper.get('.waveform-chart__plot-frame').attributes('stroke-width')).toBe('1')

    await wrapper.setProps({ frameStyle: { borderWidth: Number.NaN } })
    expect(wrapper.get('.waveform-chart__plot-frame').attributes('stroke-width')).toBe('1')
  })

  it('continues minor x-grid lines beyond the final major tick to the exact endpoint', async () => {
    const wrapper = await mountSizedChart({
      kind: 'points',
      points: [
        { x: -8, y: 0 },
        { x: 4.9903, y: 1 },
      ],
    })
    const majorGridPositions = wrapper
      .findAll('.waveform-chart__grid--major line')
      .map((line) => Number(line.attributes('x1')))
      .filter(Number.isFinite)
    const minorGridPositions = wrapper
      .findAll('.waveform-chart__grid--minor line')
      .map((line) => Number(line.attributes('x1')))
      .filter(Number.isFinite)
    const trackWidth = Number(wrapper.get('.waveform-chart__track').attributes('data-track-width'))

    expect(Math.max(...minorGridPositions)).toBeGreaterThan(Math.max(...majorGridPositions))
    expect(Math.max(...minorGridPositions)).toBeLessThan(trackWidth)
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').attributes('x')).toBe(
      String(trackWidth),
    )
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('4.99')
    expect(wrapper.get('.waveform-chart__axis-exponent--x').text()).toBe('E+03')
  })

  it('uses one shared scientific exponent only for large and tiny Y-axis domains', async () => {
    const cases = [
      { values: [0, 50], exponent: null },
      { values: [0, 254], exponent: 'E+02' },
      { values: [0, 0.0002], exponent: 'E-04' },
    ]

    for (const { values, exponent } of cases) {
      const wrapper = await mountSizedChart({
        kind: 'points',
        points: values.map((y, x) => ({ x, y })),
      })
      const labels = wrapper
        .get('.waveform-chart__axis--y')
        .findAll('.tick text')
        .map((tick) => tick.text())
      const exponentLabel = wrapper.find('.waveform-chart__axis-exponent--y')

      if (exponent === null) {
        expect(exponentLabel.exists()).toBe(false)
      } else {
        expect(exponentLabel.text()).toBe(exponent)
        expect(labels.every((label) => !label.startsWith('E'))).toBe(true)
        expect(labels.every((label) => /^-?\d+\.\d{2}$/.test(label))).toBe(true)
      }

      wrapper.unmount()
    }
  })

  it('uses milliseconds by default and supports seconds with a custom label', async () => {
    const data: WaveformData = {
      kind: 'points',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    }
    const millisecondsChart = await mountSizedChart(data)
    const millisecondTicks = millisecondsChart
      .get('.waveform-chart__axis--x')
      .findAll('.tick text')
      .map((tick) => tick.text())

    expect(millisecondsChart.text()).toContain('时间（ms）')
    expect(millisecondTicks.length).toBeGreaterThan(0)
    expect(millisecondsChart.get('.waveform-chart__axis-endpoint--end').text()).toBe('1.00')
    expect(millisecondsChart.get('.waveform-chart__axis-exponent--x').text()).toBe('E+03')
    expect(millisecondsChart.find('.waveform-chart__watermark').exists()).toBe(false)

    const secondsChart = await mountSizedChart(data, { timeUnit: 's', xLabel: 'Elapsed time' })
    expect(secondsChart.text()).toContain('Elapsed time')
    expect(secondsChart.get('.waveform-chart__axis-endpoint--end').text()).toBe('1.00')
    expect(secondsChart.find('.waveform-chart__axis-exponent--x').exists()).toBe(false)
  })

  it('pins the exact visible range values to both x-axis endpoints', async () => {
    const wrapper = await mountSizedChart({
      kind: 'samples',
      values: Array.from({ length: 2000 }, (_, index) => Math.sin(index / 10)),
      sampleRate: 1000,
    })
    const start = wrapper.get('.waveform-chart__axis-endpoint--start')
    const end = wrapper.get('.waveform-chart__axis-endpoint--end')
    const middleTickLabels = wrapper
      .get('.waveform-chart__axis--x')
      .findAll('.tick text')
      .map((tick) => tick.text())

    expect(start.attributes('x')).toBe('0')
    expect(start.attributes('text-anchor')).toBe('start')
    expect(start.text()).toBe('0.00')
    expect(end.attributes('x')).toBe(
      wrapper.get('.waveform-chart__track').attributes('data-track-width'),
    )
    expect(end.attributes('text-anchor')).toBe('end')
    expect(end.text()).toBe('2.00')
    expect(middleTickLabels.length).toBeGreaterThan(0)
    expect(middleTickLabels).not.toContain('0.00')
    expect(wrapper.get('.waveform-chart__axis-exponent--x').text()).toBe('E+03')
    expect(wrapper.findAll('.waveform-chart__grid--major line').length).toBeGreaterThan(
      middleTickLabels.length,
    )
    const middleTick = wrapper.get('.waveform-chart__axis--x .tick text')
    const endpointGroup = wrapper.get('.waveform-chart__axis-endpoints')
    const xAxis = wrapper.get('.waveform-chart__axis--x')
    expect(start.attributes('y')).toBe(middleTick.attributes('y'))
    expect(start.attributes('dy')).toBe(middleTick.attributes('dy'))
    expect(end.attributes('y')).toBe(middleTick.attributes('y'))
    expect(end.attributes('dy')).toBe(middleTick.attributes('dy'))
    expect(endpointGroup.attributes('font-family')).toBe(xAxis.attributes('font-family'))
    expect(endpointGroup.attributes('font-size')).toBe(xAxis.attributes('font-size'))
  })

  it('keeps zoom-change domains in source seconds', async () => {
    const wrapper = await mountSizedChart({
      kind: 'points',
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 1 },
      ],
    })
    const overlay = wrapper.get('.waveform-chart__overlay')
    const overlayWidth = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: 290 }),
    })

    const initialStart = wrapper.get('.waveform-chart__axis-endpoint--start').text()
    const initialEnd = wrapper.get('.waveform-chart__axis-endpoint--end').text()

    overlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -4000,
        clientX: overlayWidth / 2,
        clientY: 145,
        bubbles: true,
        cancelable: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()

    const emittedDomain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as
      [number, number] | undefined
    expect(emittedDomain).toBeDefined()
    expect(emittedDomain?.[0]).toBeGreaterThanOrEqual(0)
    expect(emittedDomain?.[1]).toBeLessThanOrEqual(2)
    expect(wrapper.get('.waveform-chart__axis-endpoint--start').attributes('x')).toBe('0')
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').attributes('x')).toBe(
      String(overlayWidth),
    )
    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).not.toBe(initialStart)
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).not.toBe(initialEnd)
    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).toContain('.')
  })

  it('keeps independent multi-column zoom inside the active track domain', async () => {
    const wrapper = await mountSizedChart(gridSeries(2), {
      displayMode: 'independent',
      grid: { rowCount: 1, columnCount: 2 },
    })
    const overlays = wrapper.findAll('.waveform-chart__overlay--independent')
    const endpoints = () =>
      wrapper.findAll('.waveform-chart__axis-endpoint--end').map((item) => item.text())
    const initialEndpoints = endpoints()
    const firstWidth = Number(overlays[0].attributes('width'))
    Object.defineProperty(overlays[0].element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: firstWidth, height: 260 }),
    })

    overlays[0].element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -4_000,
        clientX: firstWidth - 1,
        clientY: 130,
        bubbles: true,
        cancelable: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()

    const domain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
    expect(domain[0]).toBeGreaterThanOrEqual(0)
    expect(domain[1]).toBeLessThanOrEqual(1)
    expect(endpoints()[0]).not.toBe(initialEndpoints[0])
    expect(endpoints()[1]).toBe(initialEndpoints[1])
  })

  it('emits one zoom-end payload after a shared zoom gesture completes', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = await mountSizedChart({
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 2, y: 1 },
        ],
      })
      const overlay = wrapper.get('.waveform-chart__overlay')
      const overlayWidth = Number(overlay.attributes('width'))
      Object.defineProperty(overlay.element, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: overlayWidth, height: 290 }),
      })

      overlay.element.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: -4000,
          clientX: overlayWidth / 2,
          clientY: 145,
          bubbles: true,
          cancelable: true,
        }),
      )
      expect(wrapper.emitted('zoom-end')).toBeUndefined()
      flushAnimationFrames()
      // Wait for zoom-end debounce (internal throttle + flush)
      await vi.advanceTimersByTimeAsync(200)
      await flushPromises()

      const endEvents = wrapper.emitted('zoom-end') ?? []
      expect(endEvents).toHaveLength(1)
      const payload = endEvents[0]?.[0] as { start: number; end: number }
      expect(payload.start).toBeGreaterThanOrEqual(0)
      expect(payload.end).toBeLessThanOrEqual(2)
      expect(payload.start).toBeLessThan(payload.end)
      expect(payload.end - payload.start).toBeCloseTo(2 / 40)
    } finally {
      vi.useRealTimers()
    }
  })

  it('zooms only the x axis and identifies the box gesture', async () => {
    const wrapper = await mountSizedChart({
      kind: 'points',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 10 },
        { x: 2, y: 20 },
      ],
    })
    const overlay = wrapper.get('.waveform-chart__overlay--independent')
    const width = Number(overlay.attributes('width'))
    const height = Number(overlay.attributes('height'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height }),
    })

    const dispatchPointer = (type: string, clientX: number, clientY: number) => {
      const event = new MouseEvent(type, { button: 0, clientX, clientY, bubbles: true })
      Object.defineProperty(event, 'pointerId', { value: 7 })
      overlay.element.dispatchEvent(event)
    }
    dispatchPointer('pointerdown', width * 0.25, height / 2)
    dispatchPointer('pointermove', width * 0.75, height / 2 + 2)
    await flushPromises()
    expect(wrapper.find('.waveform-chart__zoom-selection').exists()).toBe(true)
    dispatchPointer('pointerup', width * 0.75, height * 0.75)
    await flushPromises()

    const payload = wrapper.emitted('zoom-end')?.at(-1)?.[0] as
      | {
          start: number
          end: number
          yStart?: number
          yEnd?: number
          trackIndex: number
          seriesIds: string[]
          gesture: string
        }
      | undefined
    expect(payload).toMatchObject({ trackIndex: 0, seriesIds: ['series-0'], gesture: 'box' })
    expect(payload?.end).toBeGreaterThan(payload?.start ?? Number.POSITIVE_INFINITY)
    expect(payload?.yStart).toBeDefined()
    expect(payload?.yEnd).toBeDefined()
    expect(wrapper.find('.waveform-chart__zoom-selection').exists()).toBe(false)
  })

  it('limits box zoom to the configured minimum x span', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 10 },
          { x: 2, y: 20 },
        ],
      },
      { minZoomSpan: 0.25 },
    )
    const overlay = wrapper.get('.waveform-chart__overlay--independent')
    const width = Number(overlay.attributes('width'))
    const height = Number(overlay.attributes('height'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height }),
    })
    const dispatchPointer = (type: string, clientX: number, clientY: number) => {
      const event = new MouseEvent(type, { button: 0, clientX, clientY, bubbles: true })
      Object.defineProperty(event, 'pointerId', { value: 8 })
      overlay.element.dispatchEvent(event)
    }
    dispatchPointer('pointerdown', width / 2, height / 2)
    dispatchPointer('pointermove', width / 2 + 8, height / 2 + 8)
    dispatchPointer('pointerup', width / 2 + 8, height / 2 + 8)
    await flushPromises()

    const payload = wrapper.emitted('zoom-end')?.at(-1)?.[0] as { start: number; end: number }
    expect(payload.end - payload.start).toBeGreaterThanOrEqual(0.25 - 1e-8)
  })

  it('does not zoom a track when its visible sample count is below the configured minimum', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 10 },
          { x: 2, y: 20 },
        ],
      },
      { minVisiblePoints: 10 },
    )
    const overlay = wrapper.get('.waveform-chart__overlay--independent')
    const width = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height: 290 }),
    })
    overlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -1000,
        clientX: width / 2,
        clientY: 145,
        bubbles: true,
        cancelable: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()

    expect(wrapper.emitted('zoom-change')).toBeUndefined()
    expect(wrapper.emitted('zoom-end')).toBeUndefined()
  })

  it('ignores shared viewport dragging', async () => {
    const wrapper = await mountSizedChart({
      kind: 'points',
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 1 },
      ],
    })
    const overlay = wrapper.get('.waveform-chart__overlay')
    const width = Number(overlay.attributes('width'))
    const createDragEvent = (type: string, init: MouseEventInit) => {
      const event = new MouseEvent(type, init)
      Object.defineProperty(event, 'view', { value: window })
      return event
    }
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height: 290 }),
    })
    overlay.element.dispatchEvent(
      createDragEvent('mousedown', {
        button: 0,
        clientX: width / 2,
        clientY: 145,
        bubbles: true,
        cancelable: true,
      }),
    )
    window.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: width / 2 + 80,
        clientY: 145,
        bubbles: true,
      }),
    )
    window.dispatchEvent(createDragEvent('mouseup', { bubbles: true }))
    flushAnimationFrames()
    await flushPromises()

    expect(wrapper.emitted('zoom-change')).toBeUndefined()
    expect(wrapper.emitted('zoom-end')).toBeUndefined()
    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).toBe('0.00')
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('2.00')
  })

  it('ignores independent viewport dragging', async () => {
    const wrapper = await mountSizedChart(gridSeries(2), {
      displayMode: 'independent',
      grid: { rowCount: 1, columnCount: 2 },
    })
    const overlay = wrapper.findAll('.waveform-chart__overlay--independent')[0]
    const width = Number(overlay.attributes('width'))
    const createDragEvent = (type: string, init: MouseEventInit) => {
      const event = new MouseEvent(type, init)
      Object.defineProperty(event, 'view', { value: window })
      return event
    }
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height: 260 }),
    })

    overlay.element.dispatchEvent(
      createDragEvent('mousedown', {
        button: 0,
        clientX: width / 2,
        clientY: 130,
        bubbles: true,
        cancelable: true,
      }),
    )
    window.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: width / 2 + 60,
        clientY: 130,
        bubbles: true,
      }),
    )
    window.dispatchEvent(createDragEvent('mouseup', { bubbles: true }))
    flushAnimationFrames()
    await flushPromises()

    expect(wrapper.emitted('zoom-change')).toBeUndefined()
    expect(wrapper.emitted('zoom-end')).toBeUndefined()
  })

  it('includes track and series IDs in independent zoom-end payloads', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = await mountSizedChart(gridSeries(2), {
        displayMode: 'independent',
        grid: { rowCount: 1, columnCount: 2 },
      })
      const overlay = wrapper.findAll('.waveform-chart__overlay--independent')[0]
      const overlayWidth = Number(overlay.attributes('width'))
      Object.defineProperty(overlay.element, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: overlayWidth, height: 260 }),
      })

      overlay.element.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: -4000,
          clientX: overlayWidth / 2,
          clientY: 130,
          bubbles: true,
          cancelable: true,
        }),
      )
      flushAnimationFrames()
      await vi.advanceTimersByTimeAsync(200)
      await flushPromises()

      const payload = wrapper.emitted('zoom-end')?.at(-1)?.[0] as
        { trackIndex: number; seriesIds: string[] } | undefined
      expect(payload).toMatchObject({ trackIndex: 0, seriesIds: ['channel-0'] })
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the global minimum zoom span after replacing the data window', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 1 },
        ],
      },
      { minZoomSpan: 10 },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    const width = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height: 290 }),
    })
    const zoomAtCenter = async () => {
      overlay.element.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: -4000,
          clientX: width / 2,
          clientY: 145,
          bubbles: true,
          cancelable: true,
        }),
      )
      flushAnimationFrames()
      await flushPromises()
    }

    await zoomAtCenter()
    const firstDomain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
    expect(firstDomain[1] - firstDomain[0]).toBeCloseTo(10)

    await wrapper.setProps({
      data: {
        kind: 'points',
        points: [
          { x: firstDomain[0], y: 0 },
          { x: firstDomain[1], y: 1 },
        ],
      },
    })
    await flushPromises()
    await zoomAtCenter()

    const secondDomain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
    expect(secondDomain[1] - secondDomain[0]).toBeCloseTo(10)
  })

  it('keeps one global domain while loading narrower and wider windows', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 1 },
        ],
      },
      { displayMode: 'separated', initialXDomain: [0, 100] },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    const width = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height: 290 }),
    })
    const dispatchWheel = async (deltaY: number) => {
      overlay.element.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY,
          clientX: width / 2,
          clientY: 145,
          bubbles: true,
          cancelable: true,
        }),
      )
      flushAnimationFrames()
      await flushPromises()
    }

    await dispatchWheel(-4000)
    const zoomedDomain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
    expect(zoomedDomain[1] - zoomedDomain[0]).toBeCloseTo(2.5)

    await wrapper.setProps({
      data: {
        kind: 'points',
        points: [
          { x: 48, y: 0 },
          { x: 52, y: 1 },
        ],
      },
    })
    await flushPromises()
    const preservedDomain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
    expect(preservedDomain[1] - preservedDomain[0]).toBeCloseTo(2.5)

    const eventCount = wrapper.emitted('zoom-change')?.length ?? 0
    await dispatchWheel(4000)
    const currentDomain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
    expect(wrapper.emitted('zoom-change')?.length ?? 0).toBe(eventCount)
    expect(currentDomain[1] - currentDomain[0]).toBeCloseTo(2.5)
  })

  it('resets a shared viewport on double-click and emits zoom-reset', async () => {
    const wrapper = await mountSizedChart({
      kind: 'points',
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 1 },
      ],
    })
    const overlay = wrapper.get('.waveform-chart__overlay')
    const width = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height: 290 }),
    })
    overlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -4000,
        clientX: width / 2,
        clientY: 145,
        bubbles: true,
        cancelable: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).not.toBe('0.00')

    overlay.element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))
    await flushPromises()

    expect(wrapper.emitted('zoom-reset')).toHaveLength(1)
    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).toBe('0.00')
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('2.00')
  })

  it('exposes resetViewport for independent tracks', async () => {
    const wrapper = await mountSizedChart(gridSeries(2), {
      displayMode: 'independent',
      grid: { rowCount: 1, columnCount: 2 },
    })
    const overlay = wrapper.findAll('.waveform-chart__overlay--independent')[0]
    const width = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height: 260 }),
    })
    overlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -4000,
        clientX: width / 2,
        clientY: 130,
        bubbles: true,
        cancelable: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.findAll('.waveform-chart__axis-endpoint--start')[0].text()).not.toBe('0.00')

    const chart = wrapper.vm as unknown as { resetViewport: () => void }
    chart.resetViewport()
    await flushPromises()

    expect(wrapper.findAll('.waveform-chart__axis-endpoint--start')[0].text()).toBe('0.00')
    expect(wrapper.findAll('.waveform-chart__axis-endpoint--end')[0].text()).toBe('1.00')
  })

  it('keeps other independent tracks unchanged when one data window is replaced', async () => {
    const wrapper = await mountSizedChart(gridSeries(2), {
      displayMode: 'independent',
      grid: { rowCount: 1, columnCount: 2 },
    })
    const originalEndpoints = wrapper
      .findAll('.waveform-chart__axis-endpoint--end')
      .map((endpoint) => endpoint.text())

    await wrapper.setProps({
      data: {
        kind: 'series',
        series: [
          {
            id: 'channel-0',
            name: '通道 1',
            data: {
              kind: 'points',
              points: [
                { x: 0.25, y: 0 },
                { x: 0.75, y: 1 },
              ],
            },
          },
          {
            id: 'channel-1',
            name: '通道 2',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 1 },
                { x: 1, y: 2 },
              ],
            },
          },
        ],
      },
    })
    await flushPromises()

    const nextEndpoints = wrapper
      .findAll('.waveform-chart__axis-endpoint--end')
      .map((endpoint) => endpoint.text())
    expect(nextEndpoints[0]).not.toBe(originalEndpoints[0])
    expect(nextEndpoints[1]).toBe(originalEndpoints[1])
  })

  it('rebuilds cached domains only when the data reference changes', async () => {
    const firstData: WaveformData = {
      kind: 'points',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    }
    const wrapper = await mountSizedChart(firstData)
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('1.00')

    firstData.points.push({ x: 2, y: 2 })
    await flushPromises()
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('1.00')

    await wrapper.setProps({ data: { ...firstData, points: [...firstData.points] } })
    await flushPromises()
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('2.00')
  })

  it('keeps controlled annotations when replacing the loaded data window', async () => {
    const annotations = [
      { id: 'window-note', seriesId: 'series-0', x: 0.5, y: 0.5, text: '窗口标注' },
    ]
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
      { annotations },
    )
    expect(wrapper.find('[data-annotation-id="window-note"]').exists()).toBe(true)

    await wrapper.setProps({
      data: {
        kind: 'points',
        points: [
          { x: 2, y: 0 },
          { x: 3, y: 1 },
        ],
      },
    })
    await flushPromises()

    expect(wrapper.find('[data-annotation-id="window-note"]').exists()).toBe(false)
    expect(annotations).toEqual([
      { id: 'window-note', seriesId: 'series-0', x: 0.5, y: 0.5, text: '窗口标注' },
    ])

    await wrapper.setProps({
      data: {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
    })
    await flushPromises()
    expect(wrapper.find('[data-annotation-id="window-note"]').exists()).toBe(true)
  })

  it('renders named multi-channel paths as independent tracks by default', async () => {
    const wrapper = await mountSizedChart({
      kind: 'series',
      series: [
        {
          name: 'BT2_2M',
          unit: 'T',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 2 },
            ],
          },
        },
        {
          name: 'BT1_2M',
          unit: 'T',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: -1 },
              { x: 2, y: 3 },
            ],
          },
        },
      ],
    })
    const paths = wrapper.findAll('.waveform-chart__line')

    expect(paths).toHaveLength(2)
    expect(wrapper.findAll('.waveform-chart__svg')).toHaveLength(1)
    expect(wrapper.findAll('.waveform-chart__track')).toHaveLength(2)
    expect(wrapper.findAll('.waveform-chart__axis--x')).toHaveLength(2)
    expect(wrapper.findAll('.waveform-chart__overlay--independent')).toHaveLength(2)
    expect(paths[0].attributes('stroke')).toBe('#0960bd')
    expect(paths[1].attributes('stroke')).toBe('#ff7f0e')
    expect(paths[0].attributes('data-series-name')).toBe('BT2_2M')
    const yAxisLabels = wrapper.findAll('.waveform-chart__y-axis-label')
    expect(yAxisLabels.map((label) => label.text())).toEqual(['BT2_2M', 'BT1_2M'])
    expect(yAxisLabels.map((label) => label.attributes('fill'))).toEqual(['#0960bd', '#ff7f0e'])
    const labelX = Number(
      yAxisLabels[0].attributes('transform')?.match(/^translate\(([-\d.]+),/)?.[1],
    )
    expect(labelX).toBeLessThan(-46)
    expect(Number(wrapper.get('.waveform-chart__y-axis-label-bg').attributes('x'))).toBe(
      labelX - 12,
    )
    expect(yAxisLabels.every((label) => !label.text().includes('(T)'))).toBe(true)
    expect(wrapper.findAll('.waveform-chart__track-label')).toHaveLength(0)
    expect(
      wrapper.findAll('.waveform-chart__axis-endpoint--end').map((item) => item.text()),
    ).toEqual(['1.00', '2.00'])
  })

  it('keeps the zero Y-axis label on upper compact tracks', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            name: 'first',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
            },
          },
          {
            name: 'second',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: -1 },
                { x: 1, y: 2 },
              ],
            },
          },
        ],
      },
      { displayMode: 'compact' },
    )

    const tracks = wrapper.findAll('.waveform-chart__track')
    const firstAxisTicks = tracks[0].findAll('.waveform-chart__axis--y .tick')
    const zeroTicks = firstAxisTicks.filter((tick) => Number(tick.text()) === 0)
    const firstTrackHeight = Number(tracks[0].attributes('data-track-height'))
    const zeroTickY = Number(
      zeroTicks[0].attributes('transform')?.match(/translate\(0,\s*([\d.]+)\)/)?.[1],
    )

    expect(zeroTicks).toHaveLength(1)
    expect(Math.abs(zeroTickY - firstTrackHeight)).toBeLessThanOrEqual(1)
  })

  it.each(['independent', 'separated', 'compact'] as const)(
    'shows a non-zero Y-axis start value once in %s mode',
    async (displayMode) => {
      const wrapper = await mountSizedChart(
        {
          kind: 'series',
          series: [
            {
              name: 'first',
              data: {
                kind: 'points',
                points: [
                  { x: 0, y: 0.11 },
                  { x: 1, y: 0.89 },
                ],
              },
            },
            {
              name: 'second',
              data: {
                kind: 'points',
                points: [
                  { x: 0, y: 4 },
                  { x: 1, y: 5 },
                ],
              },
            },
          ],
        },
        { displayMode },
      )

      const firstTrack = wrapper.findAll('.waveform-chart__track')[0]
      const firstTrackHeight = Number(firstTrack.attributes('data-track-height'))
      const startTicks = firstTrack.findAll('.waveform-chart__axis--y .tick').filter((tick) => {
        const match = tick.attributes('transform')?.match(/translate\(0,\s*([\d.]+)\)/)
        return match ? Math.abs(Number(match[1]) - firstTrackHeight) <= 1 : false
      })

      expect(startTicks).toHaveLength(1)
      expect(Number(startTicks[0].text())).toBe(0.1)
    },
  )

  it.each(['independent', 'separated'] as const)(
    'shows the Y-axis end value once on every track in %s mode',
    async (displayMode) => {
      const wrapper = await mountSizedChart(
        {
          kind: 'series',
          series: [
            {
              name: 'first',
              data: {
                kind: 'points',
                points: [
                  { x: 0, y: 0.11 },
                  { x: 1, y: 0.89 },
                ],
              },
            },
            {
              name: 'second',
              data: {
                kind: 'points',
                points: [
                  { x: 0, y: 4.11 },
                  { x: 1, y: 4.89 },
                ],
              },
            },
          ],
        },
        { displayMode },
      )

      const expectedEndValues = [0.9, 4.9]
      wrapper.findAll('.waveform-chart__track').forEach((track, index) => {
        const endTicks = track.findAll('.waveform-chart__axis--y .tick').filter((tick) => {
          const match = tick.attributes('transform')?.match(/translate\(0,\s*([\d.]+)\)/)
          return match ? Math.abs(Number(match[1])) <= 1 : false
        })

        expect(endTicks).toHaveLength(1)
        expect(Number(endTicks[0].text())).toBe(expectedEndValues[index])
      })
    },
  )

  it('shows Y-axis end values only on the top row in compact mode', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            name: 'top-left',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0.11 },
                { x: 1, y: 0.89 },
              ],
            },
          },
          {
            name: 'top-right',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 1.11 },
                { x: 1, y: 1.89 },
              ],
            },
          },
          {
            name: 'bottom-left',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 2 },
                { x: 1, y: 3 },
              ],
            },
          },
          {
            name: 'bottom-right',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 4 },
                { x: 1, y: 5 },
              ],
            },
          },
        ],
      },
      { displayMode: 'compact', grid: { rowCount: 2, columnCount: 2 } },
    )

    const tracks = wrapper.findAll('.waveform-chart__track')
    const endTicks = tracks.map((track) =>
      track.findAll('.waveform-chart__axis--y .tick').filter((tick) => {
        const match = tick.attributes('transform')?.match(/translate\(0,\s*([\d.]+)\)/)
        return match ? Math.abs(Number(match[1])) <= 1 : false
      }),
    )

    expect(endTicks[0]).toHaveLength(1)
    expect(Number(endTicks[0][0].text())).toBe(0.9)
    expect(endTicks[1]).toHaveLength(1)
    expect(Number(endTicks[1][0].text())).toBe(1.9)
    expect(endTicks[2]).toHaveLength(0)
    expect(endTicks[3]).toHaveLength(0)
  })

  it('keeps one separate shared exponent for every compact Y axis', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            name: 'large',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 254 },
              ],
            },
          },
          {
            name: 'tiny',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 0.0002 },
              ],
            },
          },
        ],
      },
      { displayMode: 'compact' },
    )

    const axes = wrapper.findAll('.waveform-chart__axis--y')
    const exponents = wrapper.findAll('.waveform-chart__axis-exponent--y')
    expect(axes).toHaveLength(2)
    expect(exponents.map((label) => label.text())).toEqual(['E+02', 'E-04'])
    axes.forEach((axis) => {
      const labels = axis.findAll('.tick text').map((tick) => tick.text())
      expect(labels.every((label) => !label.startsWith('E'))).toBe(true)
      expect(labels.every((label) => /^-?\d+\.\d{2}$/.test(label))).toBe(true)
    })
  })

  it('prefers a trimmed series name and falls back to yLabel for unnamed data', async () => {
    const namedChart = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            name: '  BT2_2M  ',
            unit: 'T',
            data: { kind: 'points', points: [{ x: 0, y: 1 }] },
          },
        ],
      },
      { yLabel: 'T' },
    )
    const unnamedChart = await mountSizedChart(
      { kind: 'points', points: [{ x: 0, y: 1 }] },
      { yLabel: '自定义幅值' },
    )

    expect(namedChart.get('.waveform-chart__y-axis-label').text()).toBe('BT2_2M')
    expect(unnamedChart.get('.waveform-chart__y-axis-label').text()).toBe('自定义幅值')
  })

  it('synchronizes every channel tooltip in separated mode and preserves the legacy event', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            name: 'BT2_2M',
            unit: 'T',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 1 },
                { x: 1, y: 2 },
              ],
            },
          },
          {
            name: 'BT1_2M',
            unit: 'T',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 3 },
                { x: 1, y: 4 },
              ],
            },
          },
        ],
      },
      { displayMode: 'separated' },
    )
    const overlay = wrapper.get('.waveform-chart__overlay--shared')
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 712, height: 290 }),
    })

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 700, clientY: 120, bubbles: true }),
    )
    flushAnimationFrames()
    await flushPromises()

    const tooltip = wrapper.get('.waveform-chart__tooltip')
    expect(tooltip.text()).toContain('BT2_2M:')
    expect(tooltip.text()).toContain('2 T')
    expect(tooltip.text()).toContain('BT1_2M:')
    expect(tooltip.text()).toContain('4 T')
    const crosshairLines = wrapper.findAll('.waveform-chart__crosshair line')
    expect(crosshairLines).toHaveLength(2)
    crosshairLines.forEach((line) => {
      expect(line.attributes('x1')).toBe(line.attributes('x2'))
      expect(line.attributes('y1')).toBe('0')
    })
    expect(wrapper.find('.waveform-chart__crosshair circle').exists()).toBe(false)
    expect(wrapper.emitted('point-hover')?.at(-1)).toEqual([{ x: 1, y: 2 }])
  })

  it('keeps synchronized hover feedback in compact mode', async () => {
    const wrapper = await mountSizedChart(gridSeries(2), { displayMode: 'compact' })
    const overlay = wrapper.get('.waveform-chart__overlay--shared')
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 712, height: 290 }),
    })

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 700, clientY: 120, bubbles: true }),
    )
    flushAnimationFrames()
    await flushPromises()

    expect(wrapper.findAll('.waveform-chart__crosshair line')).toHaveLength(2)
    expect(wrapper.findAll('.waveform-chart__tooltip-series')).toHaveLength(2)
    expect(wrapper.emitted('point-hover')?.at(-1)).toEqual([{ x: 1, y: 1 }])
  })

  it('keeps separated tracks apart while sharing one x-axis and one interaction layer', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            name: 'A',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 2, y: 1 },
              ],
            },
          },
          {
            name: 'B',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 10 },
                { x: 2, y: 20 },
              ],
            },
          },
        ],
      },
      { displayMode: 'separated' },
    )
    const tracks = wrapper.findAll('.waveform-chart__track')
    const firstTop = Number(tracks[0].attributes('data-track-top'))
    const firstHeight = Number(tracks[0].attributes('data-track-height'))
    const secondTop = Number(tracks[1].attributes('data-track-top'))

    expect(wrapper.findAll('.waveform-chart__svg')).toHaveLength(1)
    expect(wrapper.findAll('.waveform-chart__axis--x')).toHaveLength(1)
    expect(wrapper.findAll('.waveform-chart__axis--y')).toHaveLength(2)
    expect(wrapper.findAll('.waveform-chart__y-axis-label').map((label) => label.text())).toEqual([
      'A',
      'B',
    ])
    expect(wrapper.findAll('.waveform-chart__overlay--shared')).toHaveLength(1)
    expect(secondTop).toBeGreaterThan(firstTop + firstHeight)
  })

  it('joins compact tracks without a gap and keeps only the bottom x-axis', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            name: 'A',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: -1 },
                { x: 1, y: 1 },
              ],
            },
          },
          {
            name: 'B',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 100 },
                { x: 1, y: 200 },
              ],
            },
          },
        ],
      },
      { displayMode: 'compact' },
    )
    const tracks = wrapper.findAll('.waveform-chart__track')
    const firstTop = Number(tracks[0].attributes('data-track-top'))
    const firstHeight = Number(tracks[0].attributes('data-track-height'))
    const secondTop = Number(tracks[1].attributes('data-track-top'))

    expect(wrapper.attributes('data-display-mode')).toBe('compact')
    expect(wrapper.findAll('.waveform-chart__axis--x')).toHaveLength(1)
    expect(wrapper.findAll('.waveform-chart__y-axis-label').map((label) => label.text())).toEqual([
      'A',
      'B',
    ])
    expect(secondTop).toBeCloseTo(firstTop + firstHeight, 6)
    expect(wrapper.findAll('.waveform-chart__axis--y')[0].text()).not.toBe(
      wrapper.findAll('.waveform-chart__axis--y')[1].text(),
    )
  })

  it('zooms only the active independent track and resets when the mode changes', async () => {
    const wrapper = await mountSizedChart({
      kind: 'series',
      series: [
        {
          name: 'A',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 0 },
              { x: 2, y: 1 },
            ],
          },
        },
        {
          name: 'B',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 2 },
              { x: 2, y: 3 },
            ],
          },
        },
      ],
    })
    const endpoints = () =>
      wrapper.findAll('.waveform-chart__axis-endpoint--end').map((item) => item.text())
    const initialEndpoints = endpoints()
    const firstOverlay = wrapper.findAll('.waveform-chart__overlay--independent')[0]
    Object.defineProperty(firstOverlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 712, height: 130 }),
    })

    firstOverlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -4000,
        clientX: 356,
        clientY: 65,
        bubbles: true,
        cancelable: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()

    expect(endpoints()[0]).not.toBe(initialEndpoints[0])
    expect(endpoints()[1]).toBe(initialEndpoints[1])

    await wrapper.setProps({ displayMode: 'separated' })
    await flushPromises()

    expect(wrapper.findAll('.waveform-chart__axis--x')).toHaveLength(1)
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('2.00')
  })

  it('updates rendering props and disables zoom interaction', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 1 },
          { x: 1, y: 2 },
        ],
      },
      { zoomable: true, lineColor: '#ff0000' },
    )

    expect(wrapper.get('.waveform-chart__line').attributes('stroke')).toBe('#ff0000')
    expect(wrapper.get('.waveform-chart__overlay').classes()).toContain('is-zoomable')

    await wrapper.setProps({ zoomable: false, lineColor: '#00aa00' })
    await flushPromises()

    expect(wrapper.get('.waveform-chart__line').attributes('stroke')).toBe('#00aa00')
    expect(wrapper.get('.waveform-chart__overlay').classes()).not.toContain('is-zoomable')
  })

  it('binds zoom only while zooming is enabled', async () => {
    const wrapper = await mountSizedChart({
      kind: 'points',
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 1 },
      ],
    })
    const overlay = wrapper.get('.waveform-chart__overlay')
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 712, height: 290 }),
    })
    const initialZoomEventCount = wrapper.emitted('zoom-change')?.length ?? 0
    overlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -4000,
        clientX: 356,
        clientY: 145,
        bubbles: true,
        cancelable: true,
      }),
    )
    overlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -200,
        clientX: 356,
        clientY: 145,
        bubbles: true,
        cancelable: true,
      }),
    )
    expect(pendingAnimationFrameCount()).toBe(1)
    expect(wrapper.emitted('zoom-change')?.length ?? 0).toBe(initialZoomEventCount)
    flushAnimationFrames()
    await flushPromises()

    expect(wrapper.emitted('zoom-change')?.length ?? 0).toBe(initialZoomEventCount + 1)

    await wrapper.setProps({ zoomable: false })
    await flushPromises()
    const zoomEventCount = wrapper.emitted('zoom-change')?.length ?? 0
    overlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -4000,
        clientX: 356,
        clientY: 145,
        bubbles: true,
        cancelable: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()

    expect(wrapper.emitted('zoom-change')?.length ?? 0).toBe(zoomEventCount)
    expect(overlay.classes()).not.toContain('is-zoomable')
  })

  it('keeps the annotation toolbar available behind the compatibility prop', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { showAnnotationToolbar: true },
    )

    expect(wrapper.find('.waveform-annotation-toolbar').exists()).toBe(true)
    await wrapper.get('button[aria-label="添加标注"]').trigger('click')
    expect(wrapper.attributes('data-interaction-mode')).toBe('annotation')
  })

  it('creates a controlled annotation from externally selected annotation mode', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { interactionMode: 'annotation' },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    const overlayWidth = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: 290 }),
    })
    const path = wrapper.get('.waveform-chart__line').attributes('d') ?? ''
    const endpoint = path.match(/L([\d.-]+),([\d.-]+)$/)
    expect(endpoint).not.toBeNull()

    expect(wrapper.attributes('data-interaction-mode')).toBe('annotation')
    overlay.element.dispatchEvent(
      new MouseEvent('click', {
        clientX: Number(endpoint?.[1]),
        clientY: Number(endpoint?.[2]),
        bubbles: true,
        cancelable: true,
      }),
    )
    await flushPromises()

    expect(wrapper.find('.waveform-annotation-editor').exists()).toBe(true)
    await wrapper.get('textarea[aria-label="标注文本"]').setValue('峰值点')
    await wrapper.get('.waveform-annotation-editor button.is-primary').trigger('click')

    const annotations = wrapper.emitted('update:annotations')?.at(-1)?.[0] as
      Array<{ seriesId: string; x: number; y: number; text: string }> | undefined
    expect(annotations).toHaveLength(1)
    expect(annotations?.[0]).toMatchObject({ seriesId: 'series-0', x: 1, y: 5, text: '峰值点' })
    expect(wrapper.emitted('annotation-create')).toHaveLength(1)
    expect(wrapper.attributes('data-interaction-mode')).toBe('annotation')
  })

  it('supports right-click creation anywhere in the plot without drawing an anchor or guide line', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { grid: { rowCount: 1, columnCount: 1 } },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    const overlayWidth = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: 290 }),
    })

    overlay.element.dispatchEvent(
      new MouseEvent('contextmenu', {
        clientX: overlayWidth / 2,
        clientY: 145,
        bubbles: true,
      }),
    )
    await flushPromises()
    expect(wrapper.find('.waveform-annotation-editor').exists()).toBe(true)
    expect(wrapper.get('.waveform-annotation-editor').attributes('aria-modal')).toBe('true')
    expect(wrapper.find('.waveform-annotation-editor__panel').exists()).toBe(true)
    const textarea = wrapper.get('textarea[aria-label="标注文本"]')
    const textareaContextMenu = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
    })
    expect(textarea.element.dispatchEvent(textareaContextMenu)).toBe(true)
    expect(textareaContextMenu.defaultPrevented).toBe(false)
    await textarea.setValue('右键标注')
    await wrapper.get('.waveform-annotation-editor button.is-primary').trigger('click')

    // Annotation snaps to nearest sample point (x=1, y=5)
    expect(wrapper.emitted('update:annotations')?.at(-1)?.[0]).toMatchObject([
      { seriesId: 'series-0', x: 1, y: 5 },
    ])
    await wrapper.setProps({
      annotations: [{ id: 'right-click', seriesId: 'series-0', x: 1, y: 5, text: '右键标注' }],
    })
    expect(wrapper.find('.waveform-annotation__vertical-line').exists()).toBe(false)
    expect(wrapper.find('.waveform-annotation__anchor').exists()).toBe(false)
    expect(wrapper.get('.waveform-annotation__arrow').attributes('x2')).not.toBe(
      String(overlayWidth / 2),
    )
  })

  it('limits modal channel options to the graph frame under the pointer', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'channel-a',
            name: '通道 A',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
            },
          },
          {
            id: 'channel-b',
            name: '通道 B',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 10 },
                { x: 1, y: 11 },
              ],
            },
          },
        ],
      },
      { displayMode: 'separated' },
    )
    const overlays = wrapper.findAll('.waveform-chart__overlay--shared')
    expect(overlays.length).toBeGreaterThan(0)
    Object.defineProperty(overlays[0].element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 712, height: 290 }),
    })

    overlays[0].element.dispatchEvent(
      new MouseEvent('contextmenu', { clientX: 356, clientY: 30, bubbles: true }),
    )
    await flushPromises()
    expect(
      wrapper
        .find('select[aria-label="选择标注波形"]')
        .findAll('option')
        .map((item) => item.text()),
    ).toEqual(['通道 A'])

    await wrapper.get('button[aria-label="关闭标注编辑器"]').trigger('click')
    overlays[0].element.dispatchEvent(
      new MouseEvent('contextmenu', { clientX: 356, clientY: 230, bubbles: true }),
    )
    await flushPromises()
    expect(
      wrapper
        .find('select[aria-label="选择标注波形"]')
        .findAll('option')
        .map((item) => item.text()),
    ).toEqual(['通道 B'])
  })

  it('intelligently chooses placement to avoid clipping at boundaries', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { annotations: [{ id: 'top-edge', seriesId: 'series-0', x: 0.5, y: 5, text: '顶部标注' }] },
    )

    // Smart placement chooses 'bottom' when annotation is near top boundary
    expect(wrapper.get('.waveform-annotation').attributes('data-placement')).toBe('bottom')
    expect(wrapper.get('.waveform-annotation__arrow').attributes('x1')).toBe(
      wrapper.get('.waveform-annotation__arrow').attributes('x2'),
    )
  })

  it('edits and immediately deletes existing annotations without mutating props', async () => {
    const sourceAnnotation = {
      id: 'note',
      seriesId: 'series-0',
      x: 1,
      y: 5,
      text: '原文字',
    }
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { annotations: [sourceAnnotation] },
    )

    await wrapper.get('[data-annotation-id="note"]').trigger('contextmenu', {
      clientX: 200,
      clientY: 100,
    })
    await wrapper.get('.waveform-annotation-context-menu button').trigger('click')
    await flushPromises()
    await wrapper.get('textarea[aria-label="标注文本"]').setValue('新文字')
    await wrapper.get('.waveform-annotation-editor button.is-primary').trigger('click')

    const updated = wrapper.emitted('update:annotations')?.at(-1)?.[0] as
      Array<{ text: string }> | undefined
    expect(updated?.[0].text).toBe('新文字')
    expect(sourceAnnotation.text).toBe('原文字')
    expect(wrapper.emitted('annotation-update')).toHaveLength(1)

    await wrapper.get('[data-annotation-id="note"]').trigger('contextmenu', {
      clientX: 200,
      clientY: 100,
    })
    await wrapper.findAll('.waveform-annotation-context-menu button')[1].trigger('click')
    expect(wrapper.emitted('update:annotations')?.at(-1)?.[0]).toEqual([])
    expect(wrapper.emitted('annotation-delete')).toHaveLength(1)
  })

  it('commits a dragged label offset once without changing its data anchor', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { annotations: [{ id: 'dragged', seriesId: 'series-0', x: 1, y: 5, text: '拖动' }] },
    )
    const annotation = wrapper.get('[data-annotation-id="dragged"]')
    const element = annotation.element as SVGElement & {
      setPointerCapture: (pointerId: number) => void
      releasePointerCapture: (pointerId: number) => void
      hasPointerCapture: (pointerId: number) => boolean
    }
    element.setPointerCapture = () => undefined
    element.releasePointerCapture = () => undefined
    element.hasPointerCapture = () => false

    const dispatchPointer = (type: string, values: Record<string, number>) => {
      const event = new Event(type, { bubbles: true })
      Object.defineProperties(event, {
        button: { value: values.button ?? 0 },
        clientX: { value: values.clientX ?? 0 },
        clientY: { value: values.clientY ?? 0 },
        pointerId: { value: values.pointerId ?? 1 },
      })
      element.dispatchEvent(event)
    }

    dispatchPointer('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
    expect(wrapper.emitted('update:annotations')).toBeUndefined()
    dispatchPointer('pointermove', { clientX: 130, clientY: 120, pointerId: 1 })
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.emitted('update:annotations')).toBeUndefined()
    dispatchPointer('pointermove', { clientX: 140, clientY: 130, pointerId: 1 })
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.emitted('update:annotations')).toBeUndefined()
    const boxBeforeUp = {
      x: wrapper.get('.waveform-annotation__box').attributes('x'),
      y: wrapper.get('.waveform-annotation__box').attributes('y'),
    }
    dispatchPointer('pointerup', { clientX: 140, clientY: 130, pointerId: 1 })
    await flushPromises()
    expect(wrapper.get('.waveform-annotation__box').attributes('x')).toBe(boxBeforeUp.x)
    expect(wrapper.get('.waveform-annotation__box').attributes('y')).toBe(boxBeforeUp.y)

    const updated = wrapper.emitted('update:annotations')?.at(-1)?.[0] as
      Array<{ x: number; y: number; labelOffsetX?: number; labelOffsetY?: number }> | undefined
    expect(updated).toMatchObject([{ x: 1, y: 5, labelOffsetX: 40, labelOffsetY: 30 }])
    expect(wrapper.emitted('update:annotations')).toHaveLength(1)
  })

  it('hides the tooltip through a label drag until the next real hover move', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { annotations: [{ id: 'dragged', seriesId: 'series-0', x: 1, y: 5, text: '拖动' }] },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    const overlayWidth = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: 290 }),
    })
    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: overlayWidth, clientY: 120, bubbles: true }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.find('.waveform-chart__tooltip').exists()).toBe(true)

    const annotation = wrapper.get('[data-annotation-id="dragged"]')
    const element = annotation.element as SVGElement & {
      setPointerCapture: (pointerId: number) => void
      releasePointerCapture: (pointerId: number) => void
      hasPointerCapture: (pointerId: number) => boolean
    }
    element.setPointerCapture = () => undefined
    element.releasePointerCapture = () => undefined
    element.hasPointerCapture = () => false
    const dispatchPointer = (type: string, values: Record<string, number>) => {
      const event = new Event(type, { bubbles: true })
      Object.defineProperties(event, {
        button: { value: values.button ?? 0 },
        clientX: { value: values.clientX ?? 0 },
        clientY: { value: values.clientY ?? 0 },
        pointerId: { value: values.pointerId ?? 1 },
      })
      element.dispatchEvent(event)
    }

    dispatchPointer('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
    await flushPromises()
    expect(wrapper.find('.waveform-chart__tooltip').exists()).toBe(false)
    dispatchPointer('pointermove', { clientX: 130, clientY: 120, pointerId: 1 })
    dispatchPointer('pointerup', { clientX: 130, clientY: 120, pointerId: 1 })
    await flushPromises()
    expect(wrapper.find('.waveform-chart__tooltip').exists()).toBe(false)

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: overlayWidth / 2, clientY: 120, bubbles: true }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.find('.waveform-chart__tooltip').exists()).toBe(false)

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: overlayWidth, clientY: 120, bubbles: true }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.find('.waveform-chart__tooltip').exists()).toBe(true)
  })

  it('controls visibility and interaction mode while filtering unknown series', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      {
        interactionMode: 'annotation',
        showAnnotationToolbar: true,
        annotations: [
          { id: 'valid', seriesId: 'series-0', x: 1, y: 5, text: '显示' },
          { id: 'unknown', seriesId: 'missing', x: 1, y: 5, text: '不显示' },
        ],
      },
    )

    expect(wrapper.attributes('data-interaction-mode')).toBe('annotation')
    expect(wrapper.findAll('.waveform-annotation')).toHaveLength(1)
    expect(wrapper.get('.waveform-chart__overlay').classes()).toContain('is-annotating')
    await wrapper.get('button[aria-label="隐藏标注"]').trigger('click')
    expect(wrapper.emitted('update:annotations-visible')?.at(-1)).toEqual([false])

    await wrapper.setProps({ annotationsVisible: false })
    expect(wrapper.find('.waveform-annotation').exists()).toBe(false)
  })

  it('reprojects annotations after zoom and keeps them in every display mode', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'a',
            name: 'A',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
                { x: 2, y: 0 },
              ],
            },
          },
        ],
      },
      { annotations: [{ id: 'note', seriesId: 'a', x: 1, y: 1, text: '峰值' }] },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 712, height: 290 }),
    })
    const initialX = wrapper.get('.waveform-annotation__arrow').attributes('x2')

    overlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -200,
        clientX: 600,
        clientY: 145,
        bubbles: true,
        cancelable: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.get('.waveform-annotation__arrow').attributes('x2')).not.toBe(initialX)

    for (const displayMode of ['separated', 'compact'] as const) {
      await wrapper.setProps({ displayMode })
      await flushPromises()
      expect(wrapper.find('[data-annotation-id="note"]').exists()).toBe(true)
    }
  })
})
