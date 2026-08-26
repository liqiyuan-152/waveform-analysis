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
    expect(tooltip.attributes('style')).toContain('max-width: 184px')
    expect(tooltip.attributes('style')).not.toContain('right:')
  })

  it('keeps short content content-sized while exposing the available width cap', () => {
    const tooltip = mountTooltip(100).get('.waveform-tooltip')

    expect(tooltip.attributes('style')).toContain('left: 112px')
    expect(tooltip.attributes('style')).toContain('max-width: 280px')
  })

  it('keeps long series content in a wrapping content container', () => {
    const longName = 'ENG8KJXAc-very-long-series-name-10001'
    const pointWithErrors = { x: 1, y: 12, error: 1, upperError: 2 }
    const wrapper = mount(WaveformTooltip, {
      props: {
        visible: true,
        position: { x: 100, y: 100 },
        timeUnit: 'ms',
        hoveredPoint: pointWithErrors,
        seriesPoints: [
          {
            trackIndex: 0,
            name: longName,
            color: '#f00',
            unit: 'very-long-unit',
            point: pointWithErrors,
          },
        ],
        containerWidth: 400,
        containerHeight: 300,
      },
    })

    const tooltip = wrapper.get('.waveform-tooltip')
    expect(tooltip.get('.waveform-tooltip__series-content').text()).toContain(longName)
    expect(tooltip.get('.waveform-tooltip__series-content').classes()).toContain(
      'waveform-tooltip__series-content',
    )
    expect(tooltip.attributes('style')).toContain('max-width: 280px')
  })

  it('omits units and errors from the strict x/y value format', () => {
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

    expect(wrapper.get('.waveform-tooltip__value').text()).toBe('(x:1 y:12)')
    expect(wrapper.get('.waveform-tooltip__value').text()).not.toContain('C')
    expect(wrapper.get('.waveform-tooltip__value').text()).not.toContain('+2')
  })

  it('renders the configured shot number, channel, and formatted coordinates', () => {
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
            shotNo: '炮 7',
            color: '#ffb43b',
            unit: 'A',
            point: hoveredPoint,
          },
        ],
        containerWidth: 400,
        containerHeight: 300,
      },
    })

    expect(wrapper.get('.waveform-tooltip__series-label').text()).toBe('炮 7： ENG8KJXAc(10001)(A)')
    expect(wrapper.get('.waveform-tooltip__value').text()).toBe('(x:1,000 y:-1,405.4932)')
  })

  it('renders each series row with the formatted x coordinate and series label', () => {
    const wrapper = mount(WaveformTooltip, {
      props: {
        visible: true,
        position: { x: 10, y: 10 },
        timeUnit: 's',
        hoveredPoint: { x: 1.234567, y: 12 },
        seriesPoints: [
          { trackIndex: 0, name: '温度', color: '#f00', point: { x: 1.234567, y: 12 } },
        ],
        containerWidth: 400,
        containerHeight: 300,
      },
    })

    expect(wrapper.find('.waveform-tooltip__time').exists()).toBe(false)
    expect(wrapper.get('.waveform-tooltip__series-label').text()).toBe('未配置炮号： 温度')
    expect(wrapper.get('.waveform-tooltip__value').text()).toBe('(x:1.2346 y:12)')
  })

  it('uses the fallback shot number when shotNo is blank', () => {
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

    expect(wrapper.get('.waveform-tooltip__series-label').text()).toBe('未配置炮号： 温度')
  })

  it('uses each series sample time and marks unavailable series without synthesizing values', () => {
    const wrapper = mount(WaveformTooltip, {
      props: {
        visible: true,
        position: { x: 10, y: 10 },
        timeUnit: 's',
        hoveredPoint: { x: 1, y: 12 },
        seriesPoints: [
          { trackIndex: 0, name: '完整数据', color: '#f00', point: { x: 1, y: 12 } },
          { trackIndex: 1, name: '异步采样', color: '#0a0', point: { x: 1.25, y: 8 } },
          { trackIndex: 2, name: '缺失数据', color: '#00f', point: null },
        ],
        containerWidth: 400,
        containerHeight: 300,
      },
    })

    const values = wrapper
      .findAll('.waveform-tooltip__value')
      .map((value) => value.text())
    expect(values).toEqual(['(x:1 y:12)', '(x:1.25 y:8)', '无数据'])
  })
})
