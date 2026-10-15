import { describe, expect, it } from 'vitest'

import type { WaveformAxesOptions, WaveformData, WaveformYAxisLabelTextStyle } from '@/index'
import { mountSizedChart } from '@tests/support/waveformChart'

const data: WaveformData = {
  kind: 'series',
  series: [
    {
      id: 'sine',
      name: '正弦基波',
      color: '#1677ff',
      data: { kind: 'samples', values: [0, 1, 0, -1], sampleRate: 1 },
    },
  ],
}

describe('Y-axis name text style', () => {
  it.each(['default', 'edge-compact'] as const)(
    'updates styling and reserves space for larger names in %s layout',
    async (layoutPreset) => {
      const wrapper = await mountSizedChart(data, { layoutPreset })
      const name = () => wrapper.get('.waveform-chart__y-axis-label')
      const margin = () => Number(wrapper.attributes('data-chart-left-margin'))
      const initialMargin = margin()
      const initialX = name().attributes('transform')
      const ticks = wrapper
        .findAll('.waveform-chart__axis--y .tick text')
        .map((tick) => tick.text())
      expect(name().attributes('style')).toContain('font-size: 12px')
      expect(name().attributes('style')).toContain('font-weight: 600')
      expect(name().attributes('fill')).toBe('#1677ff')

      const labelTextStyle: WaveformYAxisLabelTextStyle = {
        fontSize: 24,
        fontWeight: 'normal',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'italic',
        color: '#333333',
      }
      const axes: WaveformAxesOptions = { y: { labelTextStyle } }
      await wrapper.setProps({ axes })
      expect(name().attributes('style')).toContain('font-size: 24px')
      expect(name().attributes('style')).toContain('font-weight: normal')
      expect(name().attributes('style')).toContain('font-family: Arial, sans-serif')
      expect(name().attributes('style')).toContain('font-style: italic')
      expect(name().attributes('fill')).toBe('#333333')
      // A 24px name fits inside the complete exponent's existing outer budget.
      expect(margin()).toBe(initialMargin)
      expect(name().attributes('transform')).not.toBe(initialX)
      expect(
        wrapper.findAll('.waveform-chart__axis--y .tick text').map((tick) => tick.text()),
      ).toEqual(ticks)

      await wrapper.setProps({ axes: { y: { labelTextStyle: { fontSize: 48 } } } })
      expect(margin()).toBeGreaterThan(initialMargin)
      expect(wrapper.get('.waveform-chart__y-axis-label-bg').attributes('width')).toBe('56')

      await wrapper.setProps({ axes: { y: { labelTextStyle: { fontWeight: 700 } } } })
      expect(name().attributes('style')).toContain('font-weight: 700')
      expect(name().attributes('style')).toContain('font-size: 12px')
      expect(name().attributes('fill')).toBe('#1677ff')
      expect(margin()).toBe(initialMargin)
      wrapper.unmount()
    },
  )

  it('styles names on both sides in multi-axis mode', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: Array.from({ length: 4 }, (_, index) => ({
          ...data.series[0]!,
          id: `axis-${index}`,
          trackId: 'shared',
        })),
      },
      {
        overlayMode: 'multi-axis',
        axes: { y: { labelTextStyle: { fontSize: 18, fontWeight: 400 } } },
      },
    )
    const names = wrapper.findAll('.waveform-chart__y-axis-label')
    expect(names).toHaveLength(4)
    for (const name of names) {
      expect(name.attributes('style')).toContain('font-size: 18px')
      expect(name.attributes('style')).toContain('font-weight: 400')
    }
    wrapper.unmount()
  })

  it.each([0, -1, NaN, Infinity])('falls back to the default size for %s', async (fontSize) => {
    const wrapper = await mountSizedChart(data, { axes: { y: { labelTextStyle: { fontSize } } } })
    expect(wrapper.get('.waveform-chart__y-axis-label').attributes('style')).toContain(
      'font-size: 12px',
    )
    expect(wrapper.get('.waveform-chart__y-axis-label-bg').attributes('width')).toBe('20')
    wrapper.unmount()
  })
})
