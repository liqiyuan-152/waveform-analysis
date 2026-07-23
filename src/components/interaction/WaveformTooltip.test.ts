import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import WaveformTooltip from './WaveformTooltip.vue'

describe('WaveformTooltip', () => {
  const point = { x: 1, y: 12 }

  function mountTooltip(positionX: number, containerWidth = 400) {
    return mount(WaveformTooltip, {
      props: {
        visible: true,
        position: { x: positionX, y: 100 },
        timeUnit: 's',
        hoveredPoint: point,
        seriesPoints: [{ trackIndex: 0, name: 'Temperature', color: '#f00', point }],
        containerWidth,
        containerHeight: 300,
      },
    })
  }

  it('positions the tooltip to the right when enough space remains', () => {
    const tooltip = mountTooltip(100).get('.waveform-tooltip')

    expect(tooltip.attributes('style')).toContain('left: 112px')
    expect(tooltip.attributes('style')).not.toContain('right:')
  })

  it('flips the tooltip to the left near the right boundary', () => {
    const tooltip = mountTooltip(370).get('.waveform-tooltip')

    expect(tooltip.attributes('style')).toContain('right: 42px')
    expect(tooltip.attributes('style')).not.toContain('left:')
  })

  it('keeps the tooltip inside the left boundary when neither side has enough space', () => {
    const tooltip = mountTooltip(100, 200).get('.waveform-tooltip')

    expect(tooltip.attributes('style')).toContain('left: 8px')
    expect(tooltip.attributes('style')).not.toContain('right:')
  })

  it('shows resolved asymmetric errors beside the hovered value', () => {
    const pointWithErrors = { x: 1, y: 12, error: 1, upperError: 2 }
    const wrapper = mount(WaveformTooltip, {
      props: {
        visible: true,
        position: { x: 10, y: 10 },
        timeUnit: 's',
        hoveredPoint: pointWithErrors,
        seriesPoints: [
          {
            trackIndex: 0,
            name: '温度',
            color: '#f00',
            unit: 'C',
            point: pointWithErrors,
          },
        ],
        containerWidth: 400,
        containerHeight: 300,
      },
    })

    expect(wrapper.get('.waveform-tooltip__series small').text()).toBe('(+2 / -1)')
  })

  it('keeps a formatted value and its unit in one value container', () => {
    const hoveredPoint = { x: 1, y: -1405.4932 }
    const wrapper = mount(WaveformTooltip, {
      props: {
        visible: true,
        position: { x: 10, y: 10 },
        timeUnit: 'ms',
        hoveredPoint,
        seriesPoints: [
          {
            trackIndex: 0,
            name: 'ENG8KJXAc(10001)',
            color: '#ffb43b',
            unit: 'A',
            point: hoveredPoint,
          },
        ],
        containerWidth: 400,
        containerHeight: 300,
      },
    })

    expect(wrapper.get('.waveform-tooltip__value').text()).toBe('-1,405.4932 A')
  })

  it('omits the error label when both resolved errors are zero', () => {
    const point = { x: 1, y: 12 }
    const wrapper = mount(WaveformTooltip, {
      props: {
        visible: true,
        position: { x: 10, y: 10 },
        timeUnit: 's',
        hoveredPoint: point,
        seriesPoints: [{ trackIndex: 0, name: '温度', color: '#f00', point }],
        containerWidth: 400,
        containerHeight: 300,
      },
    })

    expect(wrapper.find('.waveform-tooltip__series small').exists()).toBe(false)
  })
})
