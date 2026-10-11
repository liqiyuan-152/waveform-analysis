import { describe, expect, it } from 'vitest'
import { mountSizedChart } from '@tests/support/waveformChart'

const data = {
  kind: 'points' as const,
  points: [
    { x: 0, y: -1 },
    { x: 1, y: 1 },
  ],
}

describe('zero-line rules shared with the display component', () => {
  it.each([
    [0, 10],
    [-10, 0],
    [2, 10],
    [-10, -2],
    [-1.378, 0.0009],
    [-0.0009, 1.378],
  ])('hides zero on or near either boundary of [%s, %s]', async (minimum, maximum) => {
    const wrapper = await mountSizedChart(data, {
      yDomain: [minimum, maximum],
      axes: { y: { nice: false } },
    })
    try {
      expect(wrapper.find('.waveform-chart__zero-line').exists()).toBe(false)
      const labels = wrapper.findAll('.waveform-chart__axis--y .tick text')
      expect(labels).toHaveLength(5)
    } finally {
      wrapper.unmount()
    }
  })

  it('uses the current tick interval and updates the threshold without changing the domain', async () => {
    const wrapper = await mountSizedChart(data, {
      yDomain: [-8, 0.05],
      axes: { y: { nice: false } },
    })
    try {
      const visible = () => wrapper.find('.waveform-chart__zero-line').exists()
      const labels = () =>
        wrapper.findAll('.waveform-chart__axis--y .tick text').map((t) => t.text())
      const before = labels()
      expect(visible()).toBe(true)
      await wrapper.setProps({ zeroLine: { boundaryThreshold: 0.03 } })
      expect(visible()).toBe(false)
      expect(labels()).toEqual(before)
      await wrapper.setProps({ axes: { y: { nice: false, splitNumber: 8 } } })
      expect(visible()).toBe(true)
      await wrapper.setProps({ zeroLine: { boundaryThreshold: 0 }, yDomain: [-8, 0.0001] })
      expect(visible()).toBe(true)
      await wrapper.setProps({ yDomain: [-8, 0] })
      expect(visible()).toBe(false)
      await wrapper.setProps({
        yDomain: [-0.03125, 6.21875],
        zeroLine: { boundaryThreshold: 0.02 },
        axes: { y: { nice: false } },
      })
      expect(visible()).toBe(true) // Exactly 2% of the 1.5625 tick interval is allowed.
      for (const boundaryThreshold of [-1, NaN, Infinity]) {
        await wrapper.setProps({ yDomain: [-8, 0.0001], zeroLine: { boundaryThreshold } })
        expect(visible()).toBe(false)
      }
    } finally {
      wrapper.unmount()
    }
  })

  it('evaluates each visible axis independently and hides in clean view', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: ['crossing', 'near-edge'].map((id) => ({
          id,
          trackId: 'shared',
          name: id,
          data,
        })),
      },
      {
        overlayMode: 'multi-axis',
        axes: { y: { nice: false } },
        yDomains: { crossing: [-1, 1], 'near-edge': [-8, 0.001] },
      },
    )
    try {
      expect(
        wrapper
          .findAll('.waveform-chart__zero-line')
          .map((line) => line.attributes('data-y-axis-index')),
      ).toEqual(['0'])
      await wrapper.setProps({ zeroLine: { boundaryThreshold: 0 } })
      expect(wrapper.findAll('.waveform-chart__zero-line')).toHaveLength(2)
      await wrapper.setProps({ cleanView: true })
      expect(wrapper.find('.waveform-chart__zero-line').exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it('paints above curves and markers, with configurable opacity and CSS alpha', async () => {
    const wrapper = await mountSizedChart({
      kind: 'series',
      series: [
        {
          id: 'channel',
          name: 'channel',
          pointType: 'circle',
          data,
        },
      ],
    })
    try {
      const line = () => wrapper.get('.waveform-chart__zero-line')
      expect(line().attributes('stroke-opacity')).toBe('0.5')
      const series = wrapper.get('.waveform-track__series').element
      expect(
        series.compareDocumentPosition(line().element) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      for (const color of ['rgba(255, 0, 0, 0.5)', '#ff000080']) {
        await wrapper.setProps({ zeroLine: { color, opacity: 1 } })
        expect(line().attributes('stroke')).toBe(color)
        expect(line().attributes('stroke-opacity')).toBe('1')
      }
      await wrapper.setProps({ zeroLine: { opacity: 0 } })
      expect(line().attributes('stroke-opacity')).toBe('0')
      for (const opacity of [-1, 2, NaN, Infinity]) {
        await wrapper.setProps({ zeroLine: { opacity } })
        expect(line().attributes('stroke-opacity')).toBe('0.5')
      }
      await wrapper.setProps({ zeroLine: { visible: false } })
      expect(wrapper.find('.waveform-chart__zero-line').exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })
})
