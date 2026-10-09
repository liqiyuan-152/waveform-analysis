import { flushPromises, mount } from '@vue/test-utils'
import type { DOMWrapper, VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import WaveformChart from '@/components/WaveformChart.vue'
import type { WaveformData, WaveformSeries } from '@/index'

const unit = 'VERY-LONG-HIDDEN-UNIT'
const series = (id: string, trackId = id, minimum = 0, maximum = 30000): WaveformSeries => ({
  id,
  trackId,
  name: `CHANNEL_${id}`,
  unit,
  data: {
    kind: 'points',
    points: [
      { x: 0, y: minimum },
      { x: 1, y: maximum },
    ],
  },
})
const data = (...items: WaveformSeries[]): WaveformData => ({ kind: 'series', series: items })
const props = {
  width: 800,
  height: 500,
  layoutPreset: 'edge-compact' as const,
  unitDisplayMode: 'legend-single-series' as const,
  plotMargin: { top: 0, bottom: 44 },
  grid: { rowCount: 1 },
  xLabel: 'Time(ms)',
}

function plotWidth(wrapper: VueWrapper) {
  return Number(wrapper.get('.waveform-chart__track').attributes('data-track-width'))
}

function outerTitleLeft(
  wrapper: VueWrapper,
  track: Pick<DOMWrapper<Element>, 'attributes' | 'findAll'>,
) {
  return (
    Number(wrapper.attributes('data-chart-left-margin')) +
    Number(track.attributes('data-track-left')) +
    Math.min(
      ...track.findAll('.waveform-chart__y-axis-label-bg').map((bg) => Number(bg.attributes('x'))),
    )
  )
}

describe('edge-compact Y-axis space', () => {
  it.each([320, 800])(
    'matches the 24px right margin with the title band at width %s',
    async (width) => {
      const wrapper = mount(WaveformChart, { props: { ...props, width, data: data(series('A')) } })
      await flushPromises()
      const track = wrapper.get('.waveform-chart__track')
      const ticks = track.findAll('.waveform-chart__axis--y .tick text')
      const tickWidth = Math.max(...ticks.map((tick) => tick.text().length * 7))
      expect(track.get('.waveform-chart__axis--y').text()).toContain('E+04')
      expect(track.get('.waveform-chart__axis--y').text()).not.toContain(unit)
      expect(wrapper.get('.waveform-chart__y-axis-label').text()).toBe('CHANNEL_A')
      expect(Number(wrapper.attributes('data-chart-left-margin'))).toBe(tickWidth + 7 + 20 + 24)
      expect(outerTitleLeft(wrapper, track)).toBe(24)
      expect(
        width - Number(wrapper.attributes('data-chart-left-margin')) - plotWidth(wrapper),
      ).toBe(24)
      expect(Number(wrapper.get('.waveform-chart__x-label').attributes('y'))).toBe(491)
    },
  )

  it('gains plot width by excluding hidden units from all axis sizing paths', async () => {
    const wrapper = mount(WaveformChart, { props: { ...props, data: data(series('A')) } })
    const compactWidth = plotWidth(wrapper)
    await wrapper.setProps({ data: data({ ...series('A'), unit: undefined }) })
    expect(plotWidth(wrapper)).toBe(compactWidth)
    await wrapper.setProps({ data: data(series('A')), layoutPreset: 'default' })
    expect(plotWidth(wrapper)).toBeLessThan(compactWidth)
    expect(wrapper.get('.waveform-chart__x-label').attributes('y')).toBe('488')
    const legacyMargin = Number(wrapper.attributes('data-chart-left-margin'))
    await wrapper.setProps({ unitDisplayMode: 'axis' })
    expect(Number(wrapper.attributes('data-chart-left-margin'))).toBe(legacyMargin)
    await wrapper.setProps({ layoutPreset: 'edge-compact' })
    expect(wrapper.get('.waveform-chart__axis--y').text()).toContain(unit)
    expect(outerTitleLeft(wrapper, wrapper.get('.waveform-chart__track'))).toBe(24)
  })

  it.each([
    [-1e120, 1e120],
    [-0.0000012345, 0.0000012345],
    [-123.456789, 876.543211],
  ])(
    'reserves every visible scientific/long tick for domain %s to %s',
    async (minimum, maximum) => {
      const wrapper = mount(WaveformChart, {
        props: {
          ...props,
          data: data(series('LONG_CHANNEL_NAME', 'A', minimum, maximum)),
          yDomain: [minimum, maximum],
          axes: { y: { nice: false } },
        },
      })
      await flushPromises()
      const track = wrapper.get('.waveform-chart__track')
      const band = track.get('.waveform-chart__y-axis-label-bg')
      const bandRight = Number(band.attributes('x')) + Number(band.attributes('width'))
      track.findAll('.waveform-chart__axis--y .tick text').forEach((tick) => {
        const textLeft = Number(tick.attributes('x')) - tick.text().length * 7
        expect(textLeft).toBeGreaterThanOrEqual(bandRight)
      })
      expect(outerTitleLeft(wrapper, track)).toBe(24)
    },
  )

  it.each([3, 4])(
    'keeps %s axes and two columns clear of titles and adjacent plots',
    async (count) => {
      const items = Array.from({ length: 4 }, (_, track) =>
        Array.from({ length: count }, (_, index) =>
          series(`${track}_${index}`, `track-${track}`, -(10 ** (index + 1)), 10 ** (index + 2)),
        ),
      ).flat()
      const wrapper = mount(WaveformChart, {
        props: {
          ...props,
          width: 1600,
          height: 800,
          data: data(...items),
          overlayMode: 'multi-axis',
          grid: { rowCount: 2, columnCount: 2 },
        },
      })
      await flushPromises()
      const tracks = wrapper.findAll('.waveform-chart__track')
      expect(tracks).toHaveLength(4)
      expect(outerTitleLeft(wrapper, tracks[0])).toBe(24)
      tracks.forEach((track) => {
        expect(track.findAll('.waveform-chart__y-axis-label')).toHaveLength(count)
        expect(track.text()).not.toContain(unit)
        const bands = track.findAll('.waveform-chart__y-axis-label-bg')
        const axes = track.findAll('.waveform-chart__axis--y')
        axes.forEach((axis, index) => {
          const axisX = Number(axis.attributes('transform')?.match(/translate\(([^,]+)/)?.[1])
          const band = bands[index]
          const bandLeft = Number(band.attributes('x'))
          const bandRight = bandLeft + Number(band.attributes('width'))
          axis.findAll('.tick text').forEach((tick) => {
            const anchor = axisX + Number(tick.attributes('x'))
            if (axis.attributes('data-y-axis-side') === 'left') {
              expect(anchor - tick.text().length * 7).toBeGreaterThanOrEqual(bandRight)
            } else {
              expect(anchor + tick.text().length * 7).toBeLessThanOrEqual(bandLeft)
            }
          })
        })
      })
      const firstRight =
        Number(tracks[0].attributes('data-track-left')) +
        Math.max(
          ...tracks[0]
            .findAll('.waveform-chart__y-axis-label-bg')
            .map((band) => Number(band.attributes('x')) + 20),
        )
      const nextLeft =
        Number(tracks[1].attributes('data-track-left')) +
        Math.min(
          ...tracks[1]
            .findAll('.waveform-chart__y-axis-label-bg')
            .map((band) => Number(band.attributes('x'))),
        )
      expect(nextLeft).toBeGreaterThan(firstRight)
      const widths = tracks.map((track) => track.attributes('data-track-width'))
      await wrapper.setProps({ data: data(...items.map((item) => ({ ...item, unit: undefined }))) })
      expect(
        wrapper
          .findAll('.waveform-chart__track')
          .map((track) => track.attributes('data-track-width')),
      ).toEqual(widths)
    },
  )

  it('removes the 48px minimum when there are no visible axes', () => {
    const wrapper = mount(WaveformChart, {
      props: { ...props, data: data(series('A')), hiddenSeriesIds: ['A'] },
    })
    expect(wrapper.attributes('data-chart-left-margin')).toBe('24')
  })
})
