import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { flushAnimationFrames } from '../../test/setup'
import { type WaveformData } from '../waveform'

import { gridSeries, mountSizedChart } from '../../test/waveformChart'

describe('WaveformChart', () => {
  it('resolves a separate scientific multiplier for every Y axis', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            trackId: 'shared-frame',
            name: '普通量程',
            unit: 'V',
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
            unit: 'A',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 2540 },
              ],
            },
          },
          {
            trackId: 'shared-frame',
            name: '小量程',
            unit: 'T',
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
      wrapper.findAll('.waveform-chart__axis--y').map((axis) =>
        axis
          .findAll('.tick text')
          .map((label) => label.text())
          .filter((label) => label.startsWith('E')),
      ),
    ).toEqual([
      [],
      [expect.stringMatching(/^E\+03 \(A\) /)],
      [expect.stringMatching(/^E-04 \(T\) /)],
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
          {
            id: 'reference',
            trackId: 'frame-1',
            name: 'REF_CH_1',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0.25 },
                { x: 1, y: 1.25 },
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
    ).toEqual(['primary', 'comparison', 'reference'])
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
      'REF_CH_1',
    ])
    expect(
      legend
        .findAll('.waveform-legend__swatch')
        .map((swatch) => swatch.get('path').attributes('stroke')),
    ).toEqual(['#0960bd', '#2ca02c', '#d62728'])
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
    expect(tooltipSeries).toHaveLength(3)
    expect(tooltipSeries.map((item) => item.text())).toEqual([
      expect.stringContaining('BT2_2M'),
      expect.stringContaining('TEST_CH_1'),
      expect.stringContaining('REF_CH_1'),
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
          {
            id: 'third',
            trackId: 'shared',
            name: 'third',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 2 },
                { x: 1, y: 3 },
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

    expect(wrapper.attributes('data-chart-left-margin')).toBe('80')
  })
})
