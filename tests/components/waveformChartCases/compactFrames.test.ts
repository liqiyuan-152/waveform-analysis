import { describe, expect, it } from 'vitest'
import { gridSeries, mountSizedChart } from '@tests/support/waveformChart'
import { compactFramePath } from '@/components/rendering/compactFrame'

describe('compact shared frame boundaries', () => {
  it('draws a shared horizontal border only once and preserves configured styling', async () => {
    const wrapper = await mountSizedChart(gridSeries(2), {
      displayMode: 'compact',
      grid: { rowCount: 2, columnCount: 1 },
      frameStyle: { borderWidth: 2, borderStyle: 'dashed', backgroundColor: 'white' },
    })
    const frames = wrapper.findAll('.waveform-chart__plot-frame')
    const track = wrapper.get('.waveform-chart__track')
    const width = track.attributes('data-track-width')
    const height = track.attributes('data-track-height')
    expect(frames[0].element.tagName.toLowerCase()).toBe('path')
    expect(frames[0].attributes('d')).toBe(`M0,${height}V0H${width}V${height}`)
    expect(frames[1].attributes('d')).toBe(`M0,0H${width}V${height}H0Z`)
    for (const frame of frames) {
      expect(frame.attributes('stroke-width')).toBe('2')
      expect(frame.attributes('stroke-dasharray')).toBe('6 4')
    }
    await wrapper.setProps({ displayMode: 'separated' })
    for (const frame of wrapper.findAll('.waveform-chart__plot-frame')) {
      const track = frame.element.closest('.waveform-chart__track')!
      expect(frame.attributes('d')).toBe(
        `M0,0H${track.getAttribute('data-track-width')}V${track.getAttribute('data-track-height')}H0Z`,
      )
    }
    wrapper.unmount()
  })

  it('preserves exposed borders beside empty slots and partially filled rows', () => {
    const upper = { left: 0, top: 0, width: 100, height: 50.5, isEmpty: false }
    const lower = { left: 25, top: 50.5, width: 50, height: 50.5, isEmpty: false }
    expect(compactFramePath(upper, [upper, lower])).toBe('M0,50.5V0H100V50.5M0,50.5H25M75,50.5H100')
    expect(compactFramePath(upper, [upper, { ...lower, isEmpty: true }])).toBe(
      'M0,50.5V0H100V50.5M0,50.5H25M75,50.5H100',
    )
    expect(compactFramePath(upper, [upper, { ...lower, top: 60 }])).toBeUndefined()
    expect(compactFramePath(lower, [upper, lower])).toBeUndefined()
  })
})
