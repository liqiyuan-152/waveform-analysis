import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { gridSeries, mountSizedChart } from '../../test/waveformChart'
import WaveformChartView from '../WaveformChartView.vue'

describe('WaveformChart viewport lifecycle', () => {
  it('cleans an active shared gesture when its track is removed', async () => {
    const wrapper = await mountSizedChart(gridSeries(2), {
      displayMode: 'separated',
      grid: { rowCount: 2, columnCount: 1 },
    })
    const overlay = wrapper.get('.waveform-chart__overlay--shared')
    const width = Number(overlay.attributes('width'))
    const height = Number(overlay.attributes('height'))
    const releasePointerCapture = vi.fn()
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height }),
    })
    Object.defineProperty(overlay.element, 'setPointerCapture', { value: vi.fn() })
    Object.defineProperty(overlay.element, 'releasePointerCapture', {
      value: releasePointerCapture,
    })

    const dispatchPointer = (type: string, pointerId: number, clientY: number) => {
      const event = new MouseEvent(type, {
        button: 0,
        clientX: width / 2,
        clientY,
        bubbles: true,
      })
      Object.defineProperty(event, 'pointerId', { value: pointerId })
      overlay.element.dispatchEvent(event)
    }

    dispatchPointer('pointerdown', 41, height * 0.75)
    await flushPromises()
    expect(wrapper.find('.waveform-chart__zoom-selection').exists()).toBe(true)

    await wrapper.setProps({ data: gridSeries(1) })
    await flushPromises()
    dispatchPointer('pointerup', 41, height * 0.75)
    await flushPromises()

    expect(releasePointerCapture).toHaveBeenCalledWith(41)
    expect(wrapper.find('.waveform-chart__zoom-selection').exists()).toBe(false)

    dispatchPointer('pointerdown', 42, height / 2)
    dispatchPointer('pointermove', 42, height / 2 + 20)
    await flushPromises()
    expect(wrapper.find('.waveform-chart__zoom-selection').exists()).toBe(true)
  })

  it('cleans an active gesture when its overlay leaves the DOM', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
      { displayMode: 'separated' },
    )
    const overlay = wrapper.get('.waveform-chart__overlay--shared')
    const width = Number(overlay.attributes('width'))
    const height = Number(overlay.attributes('height'))
    const releasePointerCapture = vi.fn(() => {
      throw new DOMException('Pointer capture is no longer available', 'NotFoundError')
    })
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height }),
    })
    Object.defineProperty(overlay.element, 'setPointerCapture', { value: vi.fn() })
    Object.defineProperty(overlay.element, 'releasePointerCapture', {
      value: releasePointerCapture,
    })

    const down = new MouseEvent('pointerdown', {
      button: 0,
      clientX: width / 2,
      clientY: height / 2,
      bubbles: true,
    })
    Object.defineProperty(down, 'pointerId', { value: 43 })
    overlay.element.dispatchEvent(down)
    await wrapper.setProps({ hiddenSeriesIds: ['series-0'] })
    await flushPromises()

    expect(wrapper.find('.waveform-chart__overlay--shared').exists()).toBe(false)
    const view = wrapper.findComponent(WaveformChartView)
    const finishViewportDrag = (
      view.vm as unknown as { finishViewportDrag: (event: PointerEvent) => void }
    ).finishViewportDrag
    const up = new MouseEvent('pointerup', {
      clientX: width / 2,
      clientY: height / 2,
      bubbles: true,
    })
    Object.defineProperty(up, 'pointerId', { value: 43 })
    finishViewportDrag(up as unknown as PointerEvent)
    await flushPromises()

    expect(releasePointerCapture).toHaveBeenCalledWith(43)
    expect(wrapper.find('.waveform-chart__zoom-selection').exists()).toBe(false)

    await wrapper.setProps({ hiddenSeriesIds: [] })
    await flushPromises()
    const nextOverlay = wrapper.get('.waveform-chart__overlay--shared')
    Object.defineProperty(nextOverlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height }),
    })
    const nextDown = new MouseEvent('pointerdown', {
      button: 0,
      clientX: width / 2,
      clientY: height / 2,
      bubbles: true,
    })
    Object.defineProperty(nextDown, 'pointerId', { value: 44 })
    nextOverlay.element.dispatchEvent(nextDown)
    const nextMove = new MouseEvent('pointermove', {
      clientX: width * 0.75,
      clientY: height / 2,
      bubbles: true,
    })
    Object.defineProperty(nextMove, 'pointerId', { value: 44 })
    nextOverlay.element.dispatchEvent(nextMove)
    await flushPromises()

    expect(wrapper.find('.waveform-chart__zoom-selection').exists()).toBe(true)
  })
})
