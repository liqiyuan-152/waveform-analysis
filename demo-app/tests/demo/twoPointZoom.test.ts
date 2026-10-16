import { chartHandle } from '../support/chartHandle'
import { resizeChart } from '@tests/support/setup'
import { mount } from '@vue/test-utils'
import { flushVueChartUpdates as flushPromises } from '@tests/support/waveformChart'
import { describe, expect, it } from 'vitest'

import App from '@demo/App.vue'
import { WaveformChart } from 'waveform-analysis/vue'
import { remoteWindowLoaderKey } from '@demo/demo/remoteWaveformLoader'
import { flushAnimationFrames } from '@tests/support/setup'

const points = [-0.1, 0, 0.1].map((x) => ({ x, y: x }))
const cases = (['independent', 'separated', 'compact'] as const).flatMap((displayMode) =>
  [320, 800].map((containerWidth) => ({ displayMode, containerWidth })),
)

describe('demo two-point zoom limit', () => {
  it.each(cases)(
    'stops at two real samples and allows zoom out ($displayMode/$containerWidth)',
    async ({ displayMode, containerWidth }) => {
      const wrapper = mount(App, {
        attachTo: document.body,
        global: {
          provide: {
            [remoteWindowLoaderKey as symbol]: async () => ({ kind: 'points', points }),
          },
        },
      })
      try {
        await flushPromises()
        if (displayMode !== 'independent') {
          await wrapper.get(`input[value="${displayMode}"]`).setValue(true)
          await flushPromises()
        }
        resizeChart(containerWidth, 800)
        await flushPromises()
        const chart = wrapper.getComponent(WaveformChart)
        chartHandle(chart).setViewportDomain([-0.1, 0.1])
        await flushPromises()
        const overlay = chart.get('.waveform-chart__overlay')
        const width = Number(overlay.attributes('width'))
        const height = Number(overlay.attributes('height'))
        Object.defineProperty(overlay.element, 'getBoundingClientRect', {
          value: () => ({ left: 0, top: 0, width, height }),
        })
        const wheel = async (deltaY: number) => {
          overlay.element.dispatchEvent(
            new WheelEvent('wheel', {
              deltaY,
              clientX: width / 2,
              clientY: height / 2,
              bubbles: true,
              cancelable: true,
            }),
          )
          flushAnimationFrames()
          await flushPromises()
        }
        const domain = () => chartHandle(chart).getControlState().targets[0].viewport.xDomain
        await wheel(-1000)
        for (let step = 0; step < 40; step += 1) await wheel(-1000)
        const limited = domain()
        expect(points.filter((p) => p.x >= limited[0] && p.x <= limited[1])).toHaveLength(2)
        const eventCount = chart.emitted('zoom-change')?.length
        await wheel(-1000)
        expect(chart.emitted('zoom-change')?.length).toBe(eventCount)
        expect(domain()).toEqual(limited)
        await wheel(1000)
        expect(domain()[1] - domain()[0]).toBeGreaterThan(limited[1] - limited[0])
        chartHandle(chart).resetViewport()
        await flushPromises()
        expect(domain()).toEqual([-5, 6])
      } finally {
        wrapper.unmount()
      }
    },
  )
})
