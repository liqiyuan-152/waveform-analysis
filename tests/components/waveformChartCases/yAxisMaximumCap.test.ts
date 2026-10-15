import { flushVueChartUpdates as flushPromises } from '@tests/support/waveformChart'
import { describe, expect, it } from 'vitest'
import { mountSizedChart } from '@tests/support/waveformChart'

describe('maximum tick caps axis marks only', () => {
  it.each([true, false])(
    'preserves padded domains and grid geometry with nice=%s',
    async (nice) => {
      const y = { nice, upperPaddingRatio: 1, splitNumber: 5 }
      const chart = await mountSizedChart(
        { kind: 'samples', values: [20, 80], sampleRate: 1 },
        { axes: { y }, grid: { rowCount: 1 }, animationEnabled: false },
      )
      try {
        const axis = () => chart.get('.waveform-track__axis--y')
        const values = () =>
          axis()
            .findAll('.tick')
            .map((t) => Number(t.attributes('data-tick-value')))
        const domain = () => ['min', 'max'].map((s) => axis().attributes(`data-label-domain-${s}`))
        const grid = () =>
          chart.findAll('[data-grid-direction="horizontal"]').map((l) => l.attributes('y1'))
        const originalDomain = domain()
        const originalGrid = grid()
        expect(values().at(-1)).toBe(80)
        const maximumY = Number(chart.get('[data-maximum-tick]').attributes('data-tick-y'))
        expect(maximumY).toBeGreaterThan(0)
        expect(
          chart
            .findAll('[data-grid-direction="horizontal"]')
            .some(
              (l) =>
                Number(l.attributes('y1')) < maximumY - 2 && l.attributes('display') !== 'none',
            ),
        ).toBe(true)
        for (const maximumTickVisible of [false, true]) {
          await chart.setProps({ axes: { y: { ...y, maximumTickVisible } } })
          await flushPromises()
          expect(values().some((value) => value > 80)).toBe(!maximumTickVisible)
          expect(domain()).toEqual(originalDomain)
          expect(grid()).toEqual(originalGrid)
        }
        chart.vm.setViewportDomain([0.2, 0.8])
        await flushPromises()
        expect(values().at(-1)).toBe(80)
        expect(domain()).toEqual(originalDomain)
        for (const yDomain of [
          [200, 300],
          [0, 10],
        ] as [number, number][]) {
          await chart.setProps({ yDomain })
          await flushPromises()
          const enabled = values()
          expect(chart.find('[data-maximum-tick]').exists()).toBe(false)
          await chart.setProps({ axes: { y: { ...y, maximumTickVisible: false } } })
          await flushPromises()
          expect(values()).toEqual(enabled)
          await chart.setProps({ axes: { y } })
          await flushPromises()
        }
      } finally {
        chart.unmount()
      }
    },
  )
})
