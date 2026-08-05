import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { flushAnimationFrames } from '../../test/setup'
import type { WaveformXAxisLabelFormatter } from '../../types'
import { type WaveformData } from '../waveform'

import { gridSeries, mountSizedChart } from '../../test/waveformChart'

describe('WaveformChart', () => {
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

  it('controls horizontal and vertical grid lines independently by track ID', async () => {
    const data = gridSeries(2)
    if (data.kind === 'series') {
      data.series[0].trackId = 'frame-a'
      data.series[1].trackId = 'frame-b'
    }
    const wrapper = await mountSizedChart(data, {
      grid: {
        rowCount: 1,
        columnCount: 2,
        trackLines: {
          'frame-a': { horizontal: false },
          'frame-b': { vertical: false },
        },
      },
    })

    const tracks = wrapper.findAll('.waveform-chart__track')
    expect(tracks).toHaveLength(2)
    expect(tracks[0].findAll('[data-grid-direction="horizontal"]')).toHaveLength(0)
    expect(tracks[0].findAll('[data-grid-direction="vertical"]').length).not.toBe(0)
    expect(tracks[1].findAll('[data-grid-direction="vertical"]')).toHaveLength(0)
    expect(tracks[1].findAll('[data-grid-direction="horizontal"]').length).not.toBe(0)
  })

  it('keeps per-track grid line visibility attached across pagination', async () => {
    const wrapper = await mountSizedChart(gridSeries(3), {
      grid: {
        rowCount: 1,
        columnCount: 1,
        trackLines: {
          'channel-1': { horizontal: false, vertical: false },
        },
      },
    })

    expect(wrapper.findAll('[data-grid-direction]')).not.toHaveLength(0)
    await wrapper.get('.ant-pagination-next button').trigger('click')
    expect(wrapper.findAll('[data-grid-direction]')).toHaveLength(0)
    await wrapper.get('.ant-pagination-next button').trigger('click')
    expect(wrapper.findAll('[data-grid-direction]')).not.toHaveLength(0)
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

  it('renders a dotted frame with rounded dots', async () => {
    const wrapper = await mountSizedChart(gridSeries(1), {
      frameStyle: { borderStyle: 'dotted' },
    })

    expect(wrapper.get('.waveform-chart__plot-frame').attributes()).toMatchObject({
      'stroke-dasharray': '1 3',
      'stroke-linecap': 'round',
    })
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
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('4990.3')
    expect(wrapper.find('.waveform-chart__axis-exponent--x').exists()).toBe(false)
  })

  it('uses one shared scientific exponent only for large and tiny Y-axis domains', async () => {
    const cases = [
      { values: [0, 50], yDomain: [0, 50] as [number, number], exponent: null },
      { values: [1000, 3000], yDomain: [1000, 3000] as [number, number], exponent: 'E+03' },
      {
        values: [0.0001, 0.0003],
        yDomain: [0.0001, 0.0003] as [number, number],
        exponent: 'E-04',
      },
    ]

    for (const { values, yDomain, exponent } of cases) {
      const data = {
        kind: 'points' as const,
        points: values.map((y, x) => ({ x, y })),
      }
      const originalValues = data.points.map((point) => point.y)
      const wrapper = await mountSizedChart(data, { yDomain })
      const labels = wrapper
        .get('.waveform-chart__axis--y')
        .findAll('.tick text')
        .map((tick) => tick.text())
      const exponentLabels = labels.filter((label) => label.startsWith('E'))

      if (exponent === null) {
        expect(exponentLabels).toHaveLength(0)
      } else {
        expect(exponentLabels).toHaveLength(1)
        expect(exponentLabels[0]).toMatch(new RegExp(`^${exponent.replace('+', '\\+')} `))
      }
      expect(wrapper.find('.waveform-chart__axis-exponent--y').exists()).toBe(false)
      expect(data.points.map((point) => point.y)).toEqual(originalValues)

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
    expect(millisecondsChart.get('.waveform-chart__axis-endpoint--end').text()).toBe('1000')
    expect(millisecondsChart.find('.waveform-chart__axis-exponent--x').exists()).toBe(false)
    expect(millisecondsChart.find('.waveform-chart__watermark').exists()).toBe(false)

    const secondsChart = await mountSizedChart(data, { timeUnit: 's', xLabel: 'Elapsed time' })
    expect(secondsChart.text()).toContain('Elapsed time')
    expect(secondsChart.get('.waveform-chart__axis-endpoint--end').text()).toBe('1')
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
    expect(start.text()).toBe('0')
    expect(end.attributes('x')).toBe(
      wrapper.get('.waveform-chart__track').attributes('data-track-width'),
    )
    expect(end.attributes('text-anchor')).toBe('end')
    expect(end.text()).toBe('1999')
    expect(middleTickLabels.length).toBeGreaterThan(0)
    expect(middleTickLabels).not.toContain('0')
    expect(wrapper.find('.waveform-chart__axis-exponent--x').exists()).toBe(false)
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

  it('formats X-axis ticks and endpoints with display-unit values and source context', async () => {
    const data: WaveformData = {
      kind: 'points',
      points: [
        { x: 0.125, y: 0 },
        { x: 1.875, y: 1 },
      ],
    }
    const originalPoints = data.points.map((point) => ({ ...point }))
    const labelFormatter: WaveformXAxisLabelFormatter = (value, context) =>
      `${context.kind}:${value / 10}`
    const formatter = vi.fn(labelFormatter)
    const wrapper = await mountSizedChart(data, {
      timeUnit: 'ms',
      axes: { x: { labelFormatter: formatter } },
    })

    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).toBe('start:12.5')
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('end:187.5')
    expect(
      wrapper
        .get('.waveform-chart__axis--x')
        .findAll('.tick text')
        .every((tick) => tick.text().startsWith('tick:')),
    ).toBe(true)

    const startCall = formatter.mock.calls.find(([, context]) => context.kind === 'start')
    const tickCall = formatter.mock.calls.find(([, context]) => context.kind === 'tick')
    const endCall = formatter.mock.calls.find(([, context]) => context.kind === 'end')
    expect(startCall).toEqual([
      125,
      {
        kind: 'start',
        rawValue: 0.125,
        timeUnit: 'ms',
        domain: [0.125, 1.875],
        displayDomain: [125, 1875],
      },
    ])
    expect(tickCall?.[0]).toBeTypeOf('number')
    expect(tickCall?.[1]).toMatchObject({
      kind: 'tick',
      timeUnit: 'ms',
      domain: [0.125, 1.875],
      displayDomain: [125, 1875],
    })
    expect(endCall?.[1]).toMatchObject({ kind: 'end', rawValue: 1.875 })
    expect(data.points).toEqual(originalPoints)

    await wrapper.setProps({
      axes: { x: { labelFormatter: (value: number) => `updated:${value}` } },
    })
    await flushPromises()
    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).toBe('updated:125')
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('updated:1875')
    expect(
      wrapper
        .get('.waveform-chart__axis--x')
        .findAll('.tick text')
        .every((tick) => tick.text().startsWith('updated:')),
    ).toBe(true)
    expect(data.points).toEqual(originalPoints)
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
    expect(
      Number.isFinite(Number(wrapper.get('.waveform-chart__axis-endpoint--start').text())),
    ).toBe(true)
  })
})
