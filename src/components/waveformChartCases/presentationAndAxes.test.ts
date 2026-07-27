import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { type WaveformData } from '../waveform'

import { gridSeries, mountSizedChart } from '../../test/waveformChart'

describe('WaveformChart', () => {
  it('keeps clip path ids unique across chart instances', async () => {
    const data: WaveformData = {
      kind: 'series',
      series: [
        {
          id: 'channel-1',
          name: '通道 1',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ],
          },
        },
      ],
    }
    const first = await mountSizedChart(data)
    const second = await mountSizedChart(data)
    const firstClipPathId = first.get('clipPath').attributes('id')
    const secondClipPathId = second.get('clipPath').attributes('id')

    expect(firstClipPathId).toBeTruthy()
    expect(secondClipPathId).toBeTruthy()
    expect(firstClipPathId).not.toBe(secondClipPathId)
    expect(first.get('[clip-path]').attributes('clip-path')).toContain(firstClipPathId)
    expect(second.get('[clip-path]').attributes('clip-path')).toContain(secondClipPathId)

    first.unmount()
    second.unmount()
  })

  it('does not reuse Y scales between chart instances with the same default series ID', async () => {
    const first = await mountSizedChart({
      kind: 'points',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    })
    const second = await mountSizedChart({
      kind: 'points',
      points: [
        { x: 0, y: 10_000 },
        { x: 1, y: 20_000 },
      ],
    })

    expect(first.find('.waveform-chart__axis-exponent--y').exists()).toBe(false)
    expect(second.get('.waveform-chart__axis-exponent--y').text()).toBe('E+04')
  })

  it('renders a configurable zero line only when the Y domain contains zero', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: -2 },
          { x: 1, y: 4 },
        ],
      },
      { zeroLine: { visible: true, color: '#475467', width: 2, dash: '3 2' } },
    )

    const zeroLine = wrapper.get('.waveform-chart__zero-line')
    expect(zeroLine.attributes()).toMatchObject({
      stroke: '#475467',
      'stroke-width': '2',
      'stroke-dasharray': '3 2',
      'data-y-axis-index': '0',
    })
    expect(zeroLine.attributes('y1')).toBe(zeroLine.attributes('y2'))

    await wrapper.setProps({ zeroLine: { visible: false } })
    expect(wrapper.find('.waveform-chart__zero-line').exists()).toBe(false)

    const positive = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 2 },
          { x: 1, y: 4 },
        ],
      },
      { zeroLine: { visible: true } },
    )
    expect(positive.find('.waveform-chart__zero-line').exists()).toBe(false)
  })

  it('renders zero lines from each visible Y axis in multi-axis mode', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'small',
            trackId: 'overlay',
            name: 'small',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: -1 },
                { x: 1, y: 3 },
              ],
            },
          },
          {
            id: 'large',
            trackId: 'overlay',
            name: 'large',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: -10 },
                { x: 1, y: 2 },
              ],
            },
          },
        ],
      },
      { overlayMode: 'multi-axis', zeroLine: { visible: true } },
    )

    const zeroLines = wrapper.findAll('.waveform-chart__zero-line')
    expect(zeroLines).toHaveLength(2)
    expect(zeroLines.map((line) => line.attributes('data-y-axis-index'))).toEqual(['0', '1'])
    expect(zeroLines[0].attributes('y1')).not.toBe(zeroLines[1].attributes('y1'))
  })

  it('hides X and Y axis lines independently while preserving axis text and the frame', async () => {
    const wrapper = await mountSizedChart({
      kind: 'series',
      series: [
        {
          id: 'channel',
          name: 'Voltage',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: -1 },
              { x: 1, y: 1 },
            ],
          },
        },
      ],
    })
    const xAxis = wrapper.get('.waveform-chart__axis--x')
    const yAxis = wrapper.get('.waveform-chart__axis--y')

    expect(xAxis.classes()).not.toContain('waveform-track__axis--line-hidden')
    expect(yAxis.classes()).not.toContain('waveform-track__axis--line-hidden')

    await wrapper.setProps({ axes: { x: { lineVisible: false } } })
    await flushPromises()
    expect(xAxis.classes()).toContain('waveform-track__axis--line-hidden')
    expect(yAxis.classes()).not.toContain('waveform-track__axis--line-hidden')
    expect(xAxis.get('path.domain').attributes('display')).toBe('none')
    expect(
      xAxis.findAll('.tick line').every((line) => line.attributes('display') === undefined),
    ).toBe(true)
    expect(yAxis.get('path.domain').attributes('display')).toBeUndefined()

    await wrapper.setProps({
      axes: {
        x: { lineVisible: false },
        y: { lineVisible: false },
      },
      grid: {
        rowCount: 1,
        columnCount: 1,
        trackLines: { channel: { horizontal: false, vertical: false } },
      },
      frameStyle: { borderColor: '#dc2626', borderWidth: 2 },
    })
    await flushPromises()

    expect(xAxis.classes()).toContain('waveform-track__axis--line-hidden')
    expect(yAxis.classes()).toContain('waveform-track__axis--line-hidden')
    expect(yAxis.get('path.domain').attributes('display')).toBe('none')
    expect(
      yAxis.findAll('.tick line').every((line) => line.attributes('display') === undefined),
    ).toBe(true)
    expect(xAxis.findAll('text').length).toBeGreaterThan(0)
    expect(yAxis.findAll('text').length).toBeGreaterThan(0)
    expect(wrapper.findAll('.waveform-chart__axis-endpoint')).toHaveLength(2)
    expect(wrapper.get('.waveform-chart__y-axis-label').text()).toBe('Voltage')
    expect(wrapper.findAll('[data-grid-direction]')).toHaveLength(0)
    expect(wrapper.get('.waveform-chart__plot-frame').attributes()).toMatchObject({
      stroke: '#dc2626',
      'stroke-width': '2',
    })

    await wrapper.setProps({ axes: { x: { lineVisible: true }, y: { lineVisible: true } } })
    await flushPromises()
    expect(xAxis.get('path.domain').attributes('display')).toBeUndefined()
    expect(yAxis.get('path.domain').attributes('display')).toBeUndefined()
  })

  it('preserves a titled multi-axis plot and hides auxiliary layers in clean view', async () => {
    const data: WaveformData = {
      kind: 'series',
      series: [
        {
          id: 'first',
          trackId: 'overlay',
          name: 'first',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: -1 },
              { x: 1, y: 1 },
            ],
          },
        },
        {
          id: 'second',
          trackId: 'overlay',
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
    }
    const sharedProps = {
      grid: { rowCount: 1, columnCount: 1, showPagination: true },
      overlayMode: 'multi-axis' as const,
      frameNumber: 1,
      annotations: [{ id: 'note', seriesId: 'first', x: 0.5, y: 0, text: 'hidden note' }],
      zeroLine: { visible: true },
      title: { text: 'hidden title' },
    }
    const regularWrapper = await mountSizedChart(data, sharedProps)
    const wrapper = await mountSizedChart(data, {
      ...sharedProps,
      cleanView: true,
    })

    const regularTrack = regularWrapper.get('.waveform-chart__track')
    const cleanTrack = wrapper.get('.waveform-chart__track')
    const geometryAttributes = [
      'data-track-left',
      'data-track-top',
      'data-track-width',
      'data-track-height',
    ]

    expect(wrapper.get('.waveform-chart').attributes('data-chart-left-margin')).toBe(
      regularWrapper.get('.waveform-chart').attributes('data-chart-left-margin'),
    )
    expect(wrapper.get('.waveform-chart').attributes('data-title-area-height')).toBe(
      regularWrapper.get('.waveform-chart').attributes('data-title-area-height'),
    )
    geometryAttributes.forEach((attribute) => {
      expect(cleanTrack.attributes(attribute)).toBe(regularTrack.attributes(attribute))
    })
    expect(wrapper.get('.waveform-chart').classes()).toContain('waveform-chart--clean')
    expect(getComputedStyle(wrapper.get('.waveform-chart').element).borderColor).toBe(
      'rgba(0, 0, 0, 0)',
    )
    expect(wrapper.findAll('.waveform-chart__series')).toHaveLength(2)
    expect(wrapper.find('.waveform-chart__overlay--independent').exists()).toBe(true)
    expect(wrapper.get('.waveform-chart__title-area').attributes('aria-hidden')).toBe('true')
    expect(wrapper.find('.waveform-chart__title-visual').exists()).toBe(false)
    expect(wrapper.find('.waveform-chart__axis').exists()).toBe(false)
    expect(wrapper.find('.waveform-chart__grid').exists()).toBe(false)
    expect(wrapper.find('.waveform-chart__plot-frame').exists()).toBe(false)
    expect(wrapper.find('.waveform-chart__plot-background').exists()).toBe(false)
    expect(wrapper.find('.waveform-chart__watermark').exists()).toBe(false)
    expect(wrapper.find('.waveform-chart__legend-layer').exists()).toBe(false)
    expect(wrapper.find('.waveform-chart__label').exists()).toBe(false)
    expect(wrapper.find('.waveform-chart__zero-line').exists()).toBe(false)
    expect(wrapper.find('.waveform-annotation-layer').exists()).toBe(false)
    expect(wrapper.find('.ant-pagination').exists()).toBe(false)
  })

  it('preserves every track geometry in a multi-column clean view', async () => {
    const props = {
      displayMode: 'independent' as const,
      grid: { rowCount: 2, columnCount: 2 },
    }
    const regularWrapper = await mountSizedChart(gridSeries(4), props)
    const cleanWrapper = await mountSizedChart(gridSeries(4), { ...props, cleanView: true })
    const geometryAttributes = [
      'data-track-left',
      'data-track-top',
      'data-track-width',
      'data-track-height',
    ]
    const regularTracks = regularWrapper.findAll('.waveform-chart__track')
    const cleanTracks = cleanWrapper.findAll('.waveform-chart__track')

    expect(cleanTracks).toHaveLength(regularTracks.length)
    cleanTracks.forEach((track, index) => {
      geometryAttributes.forEach((attribute) => {
        expect(track.attributes(attribute)).toBe(regularTracks[index].attributes(attribute))
      })
    })
  })
})
