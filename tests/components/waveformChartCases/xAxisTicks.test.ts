import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { resizeObservers } from '@tests/support/setup'
import { mountSizedChart } from '@tests/support/waveformChart'

describe('WaveformChart X-axis tick compatibility', () => {
  it.each(['independent', 'separated', 'compact'] as const)(
    'preserves explicit endpoints across unit changes and resizing in %s mode',
    async (displayMode) => {
      const data = {
        kind: 'points' as const,
        points: [
          { x: 0, y: 0 },
          { x: 14, y: 1 },
        ],
      }
      const snapshot = JSON.stringify(data)
      const wrapper = await mountSizedChart(data, {
        displayMode,
        grid: { rowCount: 1, columnCount: 1 },
        initialXDomain: [0.13, 13.87],
        timeUnit: 's',
        xDomainStrategy: { type: 'data' },
      })
      try {
        const endpoints = () =>
          wrapper.findAll('.waveform-chart__axis-endpoint').map((el) => el.text())
        const labels = () =>
          wrapper
            .findAll('.waveform-chart__axis--x .tick text')
            .filter((el) => el.attributes('display') !== 'none')
            .map((el) => el.text())
        const originalLabels = labels()
        const originalTickCount = wrapper.findAll('.waveform-chart__axis--x .tick').length
        expect(endpoints()).toEqual(['0.13', '13.87'])
        await wrapper.setProps({ timeUnit: 'ms' })
        await flushPromises()
        expect(endpoints()).toEqual(['130', '13870'])
        expect(labels().map(Number)).toEqual(originalLabels.map((value) => Number(value) * 1000))
        resizeObservers.at(-1)?.resize(320, 240)
        await flushPromises()
        expect(endpoints()).toEqual(['130', '13870'])
        expect(labels().length).toBeLessThan(originalLabels.length)
        expect(wrapper.findAll('.waveform-chart__axis--x .tick')).toHaveLength(originalTickCount)
        resizeObservers.at(-1)?.resize(800, 360)
        await flushPromises()
        expect(labels().length).toBe(originalLabels.length)
        expect(JSON.stringify(data)).toBe(snapshot)
      } finally {
        wrapper.unmount()
      }
    },
  )
})
