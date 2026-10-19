import { describe, expect, it } from 'vitest'

import { updateMaximumTickVisibility } from '@/components/rendering/yAxisTickVisibility'
import { resizeChart } from '@tests/support/setup'
import { flushVueChartUpdates, mountSizedChart } from '@tests/support/waveformChart'
import type { WaveformData } from '@/types'

const data: WaveformData = {
  kind: 'series',
  series: Array.from({ length: 6 }, (_, index) => ({
    id: `series-${index}`,
    name: `Series ${index}`,
    trackId: `track-${Math.floor(index / 2)}`,
    data: { kind: 'samples', values: [index + 0.1, index + 0.9], sampleRate: 1 },
  })),
}
const yOptions = { nice: false, lowerPaddingEnabled: false, upperPaddingEnabled: false }
const options = {
  displayMode: 'compact',
  overlayMode: 'multi-axis',
  grid: { rowCount: 3, columnCount: 1 },
  axes: { y: yOptions },
}

describe('compact adjacent extrema labels', () => {
  it('pairs shared edges by position in a multi-column grid', async () => {
    const gridData: WaveformData = {
      kind: 'series',
      series: Array.from({ length: 4 }, (_, index) => ({
        id: `grid-${index}`,
        name: `Grid ${index}`,
        data: { kind: 'samples', values: [0, 1], sampleRate: 1 },
      })),
    }
    const wrapper = await mountSizedChart(gridData, {
      ...options,
      grid: { rowCount: 2, columnCount: 2 },
    })
    try {
      const tracks = wrapper.findAll('.waveform-track')
      expect(tracks).toHaveLength(4)
      const top = Math.min(...tracks.map((track) => Number(track.attributes('data-track-top'))))
      for (const track of tracks) {
        const firstRow = Number(track.attributes('data-track-top')) === top
        expect(Number(track.get('[data-minimum-tick] text').attributes('y')) < 0).toBe(firstRow)
        expect(Number(track.get('[data-maximum-tick] text').attributes('y')) > 0).toBe(!firstRow)
      }
    } finally {
      wrapper.unmount()
    }
  })

  it.each(['default', 'edge-compact'])(
    'separates both axes on multiple shared boundaries in %s without moving ticks',
    async (layoutPreset) => {
      const wrapper = await mountSizedChart(data, { ...options, layoutPreset })
      try {
        const verify = () => {
          const tracks = wrapper.findAll('.waveform-track')
          expect(tracks).toHaveLength(3)
          for (let row = 1; row < tracks.length; row++) {
            for (const side of ['left', 'right']) {
              const selector = `[data-y-axis-side="${side}"]`
              const minimum = tracks[row - 1]!.get(`${selector} [data-minimum-tick] text`)
              const maximum = tracks[row]!.get(`${selector} [data-maximum-tick] text`)
              expect(Number(minimum.attributes('y'))).toBeLessThan(0)
              expect(Number(maximum.attributes('y'))).toBeGreaterThan(0)
              expect(minimum.attributes('display')).toBeUndefined()
              expect(maximum.attributes('display')).toBeUndefined()
              // jsdom uses the production fallback's 11px font-height estimate.
              expect(Number(maximum.attributes('y')) - Number(minimum.attributes('y'))).toBeCloseTo(
                15,
              )
              expect(Number(minimum.element.parentElement!.getAttribute('data-tick-y'))).toBe(
                Number(tracks[row - 1]!.attributes('data-track-height')),
              )
              expect(Number(maximum.element.parentElement!.getAttribute('data-tick-y'))).toBe(0)
            }
          }
        }
        verify()
        const svg = wrapper.get('svg').element as SVGSVGElement
        const before = svg.innerHTML
        updateMaximumTickVisibility(svg)
        expect(svg.innerHTML).toBe(before)
        resizeChart(360, 280)
        await flushVueChartUpdates()
        verify()
        await wrapper.setProps({ displayMode: 'separated' })
        expect(
          wrapper
            .findAll('.waveform-track__axis--y .tick text')
            .every((text) => !text.attributes('y')),
        ).toBe(true)
        await wrapper.setProps({ displayMode: 'compact', hiddenSeriesIds: ['series-2'] })
        expect(
          wrapper
            .findAll('[data-minimum-tick] text')
            .every((text) => text.attributes('display') !== 'none'),
        ).toBe(true)
        await wrapper.setProps({ axes: { y: { ...yOptions, maximumTickVisible: false } } })
        expect(wrapper.find('[data-maximum-tick]').exists()).toBe(false)
        expect(
          wrapper
            .findAll('.waveform-track__axis--y .tick text')
            .every((text) => !text.attributes('y')),
        ).toBe(true)
      } finally {
        wrapper.unmount()
      }
    },
  )

  it('leaves non-overlapping labels in place and recalculates after domain changes', async () => {
    const wrapper = await mountSizedChart(data, {
      ...options,
      axes: { y: { ...yOptions, lowerPaddingRatio: 0.5, lowerPaddingEnabled: true } },
    })
    try {
      expect(
        wrapper
          .findAll('.waveform-track__axis--y .tick text')
          .every((text) => !text.attributes('y')),
      ).toBe(true)
      await wrapper.setProps({ axes: { y: yOptions } })
      expect(
        wrapper
          .findAll('.waveform-track__axis--y .tick text')
          .some((text) => Number(text.attributes('y')) < 0),
      ).toBe(true)
      await wrapper.setProps({ yDomain: [-10, 10] })
      expect(
        wrapper
          .findAll('.waveform-track__axis--y .tick text')
          .every((text) => !text.attributes('y')),
      ).toBe(true)
    } finally {
      wrapper.unmount()
    }
  })

  it('uses measured label heights and SVG screen scaling', async () => {
    const wrapper = await mountSizedChart(data, options)
    try {
      const tracks = wrapper.findAll('.waveform-track')
      const upper = tracks[0]!.get('[data-y-axis-side="left"] [data-minimum-tick] text').element
      const lower = tracks[1]!.get('[data-y-axis-side="left"] [data-maximum-tick] text').element
      for (const [element, height] of [
        [upper, 20],
        [lower, 28],
      ] as const) {
        Object.defineProperty(element, 'getScreenCTM', { value: () => ({ d: 2 }) })
        Object.defineProperty(element, 'getBoundingClientRect', {
          value: () => {
            const y = 100 + Number(element.getAttribute('y')) * 2
            return {
              left: -100,
              right: -50,
              top: y - height / 2,
              bottom: y + height / 2,
              width: 50,
              height,
            }
          },
        })
      }
      updateMaximumTickVisibility(wrapper.get('svg').element as SVGSVGElement)
      expect(Number(upper.getAttribute('y'))).toBe(-7)
      expect(Number(lower.getAttribute('y'))).toBe(7)
      expect(lower.getBoundingClientRect().top - upper.getBoundingClientRect().bottom).toBe(4)
    } finally {
      wrapper.unmount()
    }
  })
})
