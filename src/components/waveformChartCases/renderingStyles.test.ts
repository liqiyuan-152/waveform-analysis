import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { flushAnimationFrames } from '../../test/setup'
import { type WaveformData } from '../waveform'

import { mountSizedChart } from '../../test/waveformChart'

describe('WaveformChart', () => {
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
          lineStyle: 'dashed',
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
          lineStyle: 'dash-dot',
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
    expect(stepLine.attributes('data-line-style')).toBe('dash-dot')
    expect(stepLine.attributes('stroke-dasharray')).toBe('8 5 1.5 5')
    expect(
      wrapper
        .get('.waveform-chart__line[data-series-id="line-only"]')
        .attributes('stroke-dasharray'),
    ).toBe('8 5')
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
    expect(swatches.map((swatch) => swatch.attributes('data-line-style'))).toEqual([
      'solid',
      'dashed',
      'dash-dot',
      'solid',
    ])
    expect(swatches[1]?.get('.waveform-legend__line').attributes('stroke-dasharray')).toBe('8 5')
    expect(swatches[2]?.get('.waveform-legend__line').attributes('stroke-dasharray')).toBe(
      '8 5 1.5 5',
    )
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
})
