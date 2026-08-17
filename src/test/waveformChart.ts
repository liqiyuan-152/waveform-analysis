import { flushPromises, mount } from '@vue/test-utils'

import WaveformChart from '../components/WaveformChart.vue'
import type { WaveformData } from '../components/waveform'
import { resizeObservers } from './setup'

export async function mountSizedChart(data: WaveformData, extraProps = {}) {
  const wrapper = mount(WaveformChart, {
    props: { data, ...extraProps },
  })
  resizeObservers.at(-1)?.resize(800, 360)
  await flushPromises()
  return wrapper
}

export function gridSeries(count: number): WaveformData {
  return {
    kind: 'series',
    series: Array.from({ length: count }, (_, index) => ({
      id: `channel-${index}`,
      name: `通道 ${index + 1}`,
      data: {
        kind: 'points',
        points: [
          { x: 0, y: index },
          { x: 1, y: index + 1 },
        ],
      },
    })),
  }
}

export function visibilitySeries(): WaveformData {
  return {
    kind: 'series',
    series: [
      {
        id: 'low',
        trackId: 'shared-frame',
        name: '低量程',
        data: {
          kind: 'points',
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 10 },
          ],
        },
      },
      {
        id: 'high',
        trackId: 'shared-frame',
        name: '高量程',
        data: {
          kind: 'points',
          points: [
            { x: 10, y: 1000 },
            { x: 20, y: 2000 },
          ],
        },
      },
      {
        id: 'mid',
        trackId: 'shared-frame',
        name: '中量程',
        data: {
          kind: 'points',
          points: [
            { x: 0, y: 100 },
            { x: 1, y: 200 },
          ],
        },
      },
    ],
  }
}
