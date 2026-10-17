import { mount } from '@vue/test-utils'
import { afterEach, expect, it } from 'vitest'
import WaveformChart from '@/adapters/vue/WaveformChart.vue'
import { flushVueChartUpdates } from '../../support/waveformChart'

let wrapper: ReturnType<typeof mount> | undefined
afterEach(() => wrapper?.unmount())

it('updates point-size through the public Vue prop and restores its default', async () => {
  wrapper = mount(WaveformChart, {
    props: {
      width: 800,
      height: 400,
      animationEnabled: false,
      data: {
        kind: 'series',
        series: [
          {
            id: 'a',
            name: 'A',
            pointType: 'circle',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
            },
          },
        ],
      },
    },
  })
  await flushVueChartUpdates()
  const path = () => wrapper!.get('.waveform-chart__point').attributes('d')
  expect(path()).toContain('A1,1')
  await wrapper.setProps({ pointSize: 4.5 })
  await flushVueChartUpdates()
  expect(path()).toContain('A2.25,2.25')
  await wrapper.setProps({ pointSize: undefined })
  await flushVueChartUpdates()
  expect(path()).toContain('A1,1')
})
