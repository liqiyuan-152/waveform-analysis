import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import WaveformChart from '../WaveformChart.vue'
import type { WaveformData } from '../waveform'
import { resizeObservers } from '../../test/setup'
import { gridSeries, mountSizedChart } from '../../test/waveformChart'

function seriesWindow(ids: string[]) {
  return {
    kind: 'series' as const,
    series: ids.map((id, index) => ({
      id,
      name: id,
      data: {
        kind: 'points' as const,
        points: [
          { x: 40, y: index },
          { x: 50, y: index + 1 },
          { x: 60, y: index + 2 },
        ],
      },
    })),
  }
}

function fullSeries(ids: string[]): WaveformData {
  return {
    kind: 'series',
    series: ids.map((id, index) => ({
      id,
      name: id,
      data: {
        kind: 'points',
        points: [
          { x: 0, y: index },
          { x: 50, y: index + 1 },
          { x: 100, y: index + 2 },
        ],
      },
    })),
  }
}

function configureOverlay(overlay: ReturnType<typeof mount>['element']) {
  const width = Number(overlay.getAttribute('width'))
  const height = Number(overlay.getAttribute('height'))
  Object.defineProperty(overlay, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width, height }),
  })
  return { width, height }
}

function dispatchWheel(overlay: Element, deltaY: number, width: number, height: number) {
  overlay.dispatchEvent(
    new WheelEvent('wheel', {
      deltaY,
      clientX: width / 2,
      clientY: height / 2,
      bubbles: true,
      cancelable: true,
    }),
  )
}

describe('WaveformChart zoom intent and data rebind', () => {
  it('keeps one shared wheel end after an immediate intent-driven data replacement', async () => {
    vi.useFakeTimers()
    try {
      const data = ref<WaveformData>(fullSeries(['shared']))
      const host = mount(
        defineComponent({
          setup() {
            return () =>
              h(WaveformChart, {
                data: data.value,
                displayMode: 'separated',
                initialXDomain: [0, 100],
                onZoomIntent: () => {
                  data.value = seriesWindow(['shared'])
                },
              })
          },
        }),
      )
      resizeObservers.at(-1)?.resize(800, 360)
      await flushPromises()

      const chart = host.findComponent(WaveformChart)
      const overlay = chart.get('.waveform-chart__overlay')
      const { width, height } = configureOverlay(overlay.element)
      dispatchWheel(overlay.element, -4_000, width, height)

      const firstIntent = chart.emitted('zoom-intent')?.[0]?.[0] as {
        start: number
        end: number
      }
      expect(firstIntent.end - firstIntent.start).toBeCloseTo(2.5)
      expect(chart.emitted('zoom-change')).toBeUndefined()

      await flushPromises()
      dispatchWheel(overlay.element, 1_000, width, height)
      await flushPromises()
      await vi.advanceTimersByTimeAsync(199)
      expect(chart.emitted('zoom-end')).toBeUndefined()

      await vi.advanceTimersByTimeAsync(1)
      await flushPromises()
      const zoomEnd = chart.emitted('zoom-end')?.[0]?.[0] as { start: number; end: number }
      expect(chart.emitted('zoom-intent')).toHaveLength(2)
      expect(chart.emitted('zoom-end')).toHaveLength(1)
      expect(zoomEnd.end - zoomEnd.start).toBeGreaterThan(firstIntent.end - firstIntent.start)
    } finally {
      vi.useRealTimers()
    }
  })

  it('retains a pending independent wheel gesture by stable series identity', async () => {
    vi.useFakeTimers()
    try {
      const data = ref<WaveformData>(fullSeries(['channel-a', 'channel-b']))
      const host = mount(
        defineComponent({
          setup() {
            return () =>
              h(WaveformChart, {
                data: data.value,
                displayMode: 'independent',
                grid: { rowCount: 1, columnCount: 2 },
                initialXDomain: [0, 100],
                onZoomIntent: () => {
                  data.value = seriesWindow(['channel-b', 'channel-a'])
                },
              })
          },
        }),
      )
      resizeObservers.at(-1)?.resize(800, 360)
      await flushPromises()

      const chart = host.findComponent(WaveformChart)
      const overlay = chart.findAll('.waveform-chart__overlay--independent')[0]!
      const { width, height } = configureOverlay(overlay.element)
      dispatchWheel(overlay.element, -4_000, width, height)
      await flushPromises()
      await vi.advanceTimersByTimeAsync(200)
      await flushPromises()

      const zoomEnd = chart.emitted('zoom-end')?.[0]?.[0] as {
        trackIndex: number
        seriesIds: string[]
      }
      expect(chart.emitted('zoom-intent')?.[0]?.[0]).toMatchObject({
        trackIndex: 0,
        seriesIds: ['channel-a'],
        gesture: 'wheel',
      })
      expect(zoomEnd).toMatchObject({ trackIndex: 1, seriesIds: ['channel-a'], gesture: 'wheel' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('emits box intent with the selected independent series', async () => {
    const wrapper = await mountSizedChart(fullSeries(['series-a']), { initialXDomain: [0, 100] })
    const overlay = wrapper.get('.waveform-chart__overlay--independent')
    const { width, height } = configureOverlay(overlay.element)
    const dispatchPointer = (type: string, clientX: number, clientY: number) => {
      const event = new MouseEvent(type, { button: 0, clientX, clientY, bubbles: true })
      Object.defineProperty(event, 'pointerId', { value: 11 })
      overlay.element.dispatchEvent(event)
    }

    dispatchPointer('pointerdown', width * 0.25, height / 2)
    dispatchPointer('pointermove', width * 0.75, height / 2)
    dispatchPointer('pointerup', width * 0.75, height / 2)
    await flushPromises()

    expect(wrapper.emitted('zoom-intent')?.[0]?.[0]).toMatchObject({
      trackIndex: 0,
      seriesIds: ['series-a'],
      gesture: 'box',
    })
  })

  it('cancels pending wheel ends when reset or pagination changes the viewport', async () => {
    vi.useFakeTimers()
    try {
      const reset = await mountSizedChart(fullSeries(['reset']), { initialXDomain: [0, 100] })
      const resetOverlay = reset.get('.waveform-chart__overlay--independent')
      const resetBounds = configureOverlay(resetOverlay.element)
      dispatchWheel(resetOverlay.element, -4_000, resetBounds.width, resetBounds.height)
      ;(reset.vm as unknown as { resetViewport: () => void }).resetViewport()
      await vi.advanceTimersByTimeAsync(200)
      expect(reset.emitted('zoom-end')).toBeUndefined()

      const paged = await mountSizedChart(gridSeries(2), {
        displayMode: 'independent',
        grid: { rowCount: 1, columnCount: 1 },
      })
      const pageOverlay = paged.get('.waveform-chart__overlay--independent')
      const pageBounds = configureOverlay(pageOverlay.element)
      dispatchWheel(pageOverlay.element, -4_000, pageBounds.width, pageBounds.height)
      await paged.get('.ant-pagination-next button').trigger('click')
      await flushPromises()
      await vi.advanceTimersByTimeAsync(200)
      expect(paged.emitted('zoom-end')).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })
})
