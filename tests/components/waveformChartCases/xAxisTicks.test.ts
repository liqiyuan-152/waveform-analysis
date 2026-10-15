import { resizeChart } from '@tests/support/setup'
import { flushVueChartUpdates as flushPromises } from '@tests/support/waveformChart'
import { describe, expect, it } from 'vitest'

import { mountSizedChart } from '@tests/support/waveformChart'
import type { WaveformAxesOptions } from '@/index'

describe('WaveformChart X-axis tick compatibility', () => {
  it.each(['independent', 'separated', 'compact'] as const)(
    'updates configured split counts without changing the viewport in %s mode',
    async (displayMode) => {
      const wrapper = await mountSizedChart(
        {
          kind: 'points',
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 1 },
          ],
        },
        {
          displayMode,
          initialXDomain: [0, 10],
          timeUnit: 's',
          grid: { rowCount: 1, columnCount: 1 },
        },
      )
      try {
        const ticks = () =>
          wrapper.findAll('.waveform-chart__axis--x .tick text').map((el) => el.text())
        const endpoints = () =>
          wrapper.findAll('.waveform-chart__axis-endpoint').map((el) => el.text())
        const defaults = ticks()
        const bounds = endpoints()
        expect(defaults).toEqual(['0', '2', '4', '6', '8', '10'])
        const axes: WaveformAxesOptions = { x: { splitNumber: 10 } }
        await wrapper.setProps({ axes })
        await flushPromises()
        expect(ticks()).toHaveLength(11)
        expect(endpoints()).toEqual(bounds)
        expect(wrapper.emitted('zoom-change')).toBeUndefined()
        await wrapper.setProps({ axes: { x: { splitNumber: 2.4 } } })
        await flushPromises()
        expect(ticks()).toEqual(['0', '5', '10'])
        for (const splitNumber of [NaN, Infinity, undefined]) {
          await wrapper.setProps({ axes: { x: { splitNumber } } })
          await flushPromises()
          expect(ticks()).toEqual(defaults)
        }
        await wrapper.setProps({ axes: { x: { splitNumber: 0 } } })
        await flushPromises()
        expect(ticks()).toEqual(['0', '10'])
      } finally {
        wrapper.unmount()
      }
    },
  )
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
        resizeChart(320, 240)
        await flushPromises()
        expect(endpoints()).toEqual(['130', '13870'])
        expect(labels().length).toBeLessThan(originalLabels.length)
        expect(wrapper.findAll('.waveform-chart__axis--x .tick')).toHaveLength(originalTickCount)
        resizeChart(800, 360)
        await flushPromises()
        expect(labels().length).toBe(originalLabels.length)
        expect(JSON.stringify(data)).toBe(snapshot)
      } finally {
        wrapper.unmount()
      }
    },
  )
})
