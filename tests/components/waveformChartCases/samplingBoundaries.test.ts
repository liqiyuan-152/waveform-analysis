import { describe, expect, it } from 'vitest'
import { mountSizedChart } from '@tests/support/waveformChart'

describe('sampled line viewport boundaries', () => {
  it.each(['linear', 'step-start', 'step-middle', 'step-end', 'step-after'] as const)(
    'keeps a %s crossing visible when no samples are inside',
    async (lineType) => {
      const wrapper = await mountSizedChart(
        {
          kind: 'series',
          series: [
            {
              id: 's',
              name: 'Signal',
              lineType,
              data: {
                kind: 'points',
                points: [
                  { x: 0, y: 0 },
                  { x: 10, y: 10 },
                ],
              },
            },
          ],
        },
        { initialXDomain: [2, 8], rendering: { sampling: { mode: 'raw' } } },
      )
      expect(wrapper.get('.waveform-chart__line').attributes('d')).toContain('L')
      wrapper.unmount()
    },
  )
})
