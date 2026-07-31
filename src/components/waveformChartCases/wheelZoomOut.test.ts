import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { flushAnimationFrames } from '../../test/setup'
import { mountSizedChart } from '../../test/waveformChart'

describe('WaveformChart wheel zoom out', () => {
  it('restores an independent initial domain after replacing data with a narrow window', async () => {
    const createData = (start: number, end: number) => ({
      kind: 'series' as const,
      series: [
        {
          id: 'channel-a',
          name: '通道 A',
          data: {
            kind: 'points' as const,
            points: [
              { x: start, y: 0 },
              { x: end, y: 1 },
            ],
          },
        },
      ],
    })
    const wrapper = await mountSizedChart(createData(-5, 5), {
      displayMode: 'independent',
      initialXDomain: [-5, 5],
    })
    const overlay = wrapper.get('.waveform-chart__overlay--independent')
    const overlayWidth = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: 290 }),
    })
    const dispatchWheel = async (deltaY: number) => {
      overlay.element.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY,
          clientX: overlayWidth / 2,
          clientY: 145,
          bubbles: true,
          cancelable: true,
        }),
      )
      flushAnimationFrames()
      await flushPromises()
    }
    const endpoints = () => ({
      start: wrapper.get('.waveform-chart__axis-endpoint--start').text(),
      end: wrapper.get('.waveform-chart__axis-endpoint--end').text(),
    })

    expect(endpoints()).toEqual({ start: '-5.00', end: '5.00' })
    await dispatchWheel(-4000)
    expect(endpoints()).not.toEqual({ start: '-5.00', end: '5.00' })

    await wrapper.setProps({ data: createData(-0.125, 0.125) })
    await flushPromises()
    await dispatchWheel(4000)

    expect(endpoints()).toEqual({ start: '-5.00', end: '5.00' })
  })

  it('emits one zoom-end payload after zooming a shared viewport out', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = await mountSizedChart({
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 2, y: 1 },
        ],
      })
      const overlay = wrapper.get('.waveform-chart__overlay')
      const overlayWidth = Number(overlay.attributes('width'))
      Object.defineProperty(overlay.element, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: overlayWidth, height: 290 }),
      })
      const dispatchWheel = (deltaY: number) =>
        overlay.element.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY,
            clientX: overlayWidth / 2,
            clientY: 145,
            bubbles: true,
            cancelable: true,
          }),
        )

      dispatchWheel(-4000)
      flushAnimationFrames()
      await vi.advanceTimersByTimeAsync(200)
      await flushPromises()
      const zoomedDomain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
      const zoomedSpan = zoomedDomain[1] - zoomedDomain[0]

      dispatchWheel(1000)
      flushAnimationFrames()
      expect(wrapper.emitted('zoom-end')).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(200)
      await flushPromises()

      const zoomedOutPayload = wrapper.emitted('zoom-end')?.at(-1)?.[0] as {
        start: number
        end: number
        gesture: string
      }
      expect(wrapper.emitted('zoom-end')).toHaveLength(2)
      expect(zoomedOutPayload.end - zoomedOutPayload.start).toBeGreaterThan(zoomedSpan)
      expect(zoomedOutPayload.gesture).toBe('wheel')
    } finally {
      vi.useRealTimers()
    }
  })
})
