import { resizeChart } from '@tests/support/setup'
import { flushPromises, mount, type DOMWrapper } from '@vue/test-utils'
import { vi } from 'vitest'

import WaveformChart from '@/components/WaveformChart.vue'
import type { WaveformData } from '@/components/waveform'
import { flushAnimationFrames, resizeObservers } from '@tests/support/setup'

/** Drain queued chart frames; tests with explicit animation clocks may still have active frames. */
export async function flushVueChartUpdates() {
  await flushPromises()
  for (let turn = 0; turn < 4; turn++) {
    if (!globalThis.requestAnimationFrame && vi.isFakeTimers())
      await vi.advanceTimersByTimeAsync(16)
    flushAnimationFrames(performance.now())
    await Promise.resolve()
  }
}

const decoratedElements = new WeakSet<object>()
function withChartTrigger<T extends DOMWrapper<Node>>(element: T): T {
  if (!element.exists()) return element
  if (decoratedElements.has(element)) return element
  decoratedElements.add(element)
  const trigger = element.trigger.bind(element)
  element.trigger = async (...args: Parameters<typeof trigger>) => {
    await trigger(...args)
    await flushVueChartUpdates()
  }
  const find = element.find.bind(element)
  element.find = ((...args: Parameters<typeof find>) =>
    withChartTrigger(find(...args))) as typeof element.find
  const findAll = element.findAll.bind(element)
  element.findAll = ((...args: Parameters<typeof findAll>) =>
    findAll(...args).map(withChartTrigger)) as typeof element.findAll
  return element
}

export async function mountSizedChart(data: WaveformData, extraProps = {}) {
  const wrapper = mount(WaveformChart, {
    props: { data, animationEnabled: false, ...extraProps },
    attachTo: document.body,
  })
  resizeChart(800, 360)
  await flushPromises()
  await flushVueChartUpdates()
  const setProps = wrapper.setProps.bind(wrapper)
  wrapper.setProps = async (props) => {
    await setProps(props)
    await flushVueChartUpdates()
  }
  const find = wrapper.find.bind(wrapper)
  wrapper.find = ((...args: Parameters<typeof find>) =>
    withChartTrigger(find(...args))) as typeof wrapper.find
  const findAll = wrapper.findAll.bind(wrapper)
  wrapper.findAll = ((...args: Parameters<typeof findAll>) =>
    findAll(...args).map(withChartTrigger)) as typeof wrapper.findAll
  return wrapper
}

/** Independent pre-adapter oracle; never compare the native engine to its own Vue wrapper. */
export async function mountLegacySizedChart(data: WaveformData, extraProps = {}) {
  const { default: LegacyWaveformChart } = await import('./LegacyWaveformChart.vue')
  const wrapper = mount(LegacyWaveformChart, { props: { data, ...extraProps } })
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
