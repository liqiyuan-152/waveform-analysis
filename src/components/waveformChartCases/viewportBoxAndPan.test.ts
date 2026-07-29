import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { flushAnimationFrames } from '../../test/setup'
import { type WaveformData } from '../waveform'

import { gridSeries, mountSizedChart } from '../../test/waveformChart'

describe('WaveformChart', () => {
  it('keeps independent multi-column zoom inside the active track domain', async () => {
    const wrapper = await mountSizedChart(gridSeries(2), {
      displayMode: 'independent',
      grid: { rowCount: 1, columnCount: 2 },
    })
    const overlays = wrapper.findAll('.waveform-chart__overlay--independent')
    const endpoints = () =>
      wrapper.findAll('.waveform-chart__axis-endpoint--end').map((item) => item.text())
    const initialEndpoints = endpoints()
    const firstWidth = Number(overlays[0].attributes('width'))
    Object.defineProperty(overlays[0].element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: firstWidth, height: 260 }),
    })

    overlays[0].element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -4_000,
        clientX: firstWidth - 1,
        clientY: 130,
        bubbles: true,
        cancelable: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()

    const domain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
    expect(domain[0]).toBeGreaterThanOrEqual(0)
    expect(domain[1]).toBeLessThanOrEqual(1)
    expect(endpoints()[0]).not.toBe(initialEndpoints[0])
    expect(endpoints()[1]).toBe(initialEndpoints[1])
  })

  it('emits one zoom-end payload after a shared zoom gesture completes', async () => {
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

      overlay.element.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: -4000,
          clientX: overlayWidth / 2,
          clientY: 145,
          bubbles: true,
          cancelable: true,
        }),
      )
      expect(wrapper.emitted('zoom-end')).toBeUndefined()
      flushAnimationFrames()
      // The wheel debounce is 200ms: it must not end early, then ends at the boundary.
      await vi.advanceTimersByTimeAsync(199)
      await flushPromises()
      expect(wrapper.emitted('zoom-end')).toBeUndefined()

      await vi.advanceTimersByTimeAsync(1)
      await flushPromises()

      const endEvents = wrapper.emitted('zoom-end') ?? []
      expect(endEvents).toHaveLength(1)
      const payload = endEvents[0]?.[0] as { start: number; end: number }
      expect(payload.start).toBeGreaterThanOrEqual(0)
      expect(payload.end).toBeLessThanOrEqual(2)
      expect(payload.start).toBeLessThan(payload.end)
      expect(payload.end - payload.start).toBeCloseTo(2 / 40)
    } finally {
      vi.useRealTimers()
    }
  })

  it('zooms only the x axis and identifies the box gesture', async () => {
    const wrapper = await mountSizedChart({
      kind: 'points',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 10 },
        { x: 2, y: 20 },
      ],
    })
    const overlay = wrapper.get('.waveform-chart__overlay--independent')
    const width = Number(overlay.attributes('width'))
    const height = Number(overlay.attributes('height'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height }),
    })

    const dispatchPointer = (type: string, clientX: number, clientY: number) => {
      const event = new MouseEvent(type, { button: 0, clientX, clientY, bubbles: true })
      Object.defineProperty(event, 'pointerId', { value: 7 })
      overlay.element.dispatchEvent(event)
    }
    dispatchPointer('pointerdown', width * 0.25, height / 2)
    dispatchPointer('pointermove', width * 0.75, height / 2 + 2)
    await flushPromises()
    expect(wrapper.find('.waveform-chart__zoom-selection').exists()).toBe(true)
    dispatchPointer('pointerup', width * 0.75, height * 0.75)
    await flushPromises()

    const payload = wrapper.emitted('zoom-end')?.at(-1)?.[0] as
      | {
          start: number
          end: number
          yStart?: number
          yEnd?: number
          trackIndex: number
          seriesIds: string[]
          gesture: string
        }
      | undefined
    expect(payload).toMatchObject({ trackIndex: 0, seriesIds: ['series-0'], gesture: 'box' })
    expect(payload?.end).toBeGreaterThan(payload?.start ?? Number.POSITIVE_INFINITY)
    expect(payload?.yStart).toBeDefined()
    expect(payload?.yEnd).toBeDefined()
    expect(wrapper.find('.waveform-chart__zoom-selection').exists()).toBe(false)
  })

  it('enables space-drag panning only when pannable is true and the pointer is inside', async () => {
    const data: WaveformData = {
      kind: 'points',
      points: Array.from({ length: 5 }, (_, index) => ({ x: index, y: index })),
    }
    const disabled = await mountSizedChart(data)
    const disabledOverlay = disabled.get('.waveform-chart__overlay--independent')
    const disabledWidth = Number(disabledOverlay.attributes('width'))
    const disabledHeight = Number(disabledOverlay.attributes('height'))
    Object.defineProperty(disabledOverlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: disabledWidth, height: disabledHeight }),
    })
    await disabled.trigger('pointerenter')
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', cancelable: true }))
    const disabledDown = new MouseEvent('pointerdown', {
      button: 0,
      clientX: disabledWidth * 0.25,
      clientY: disabledHeight / 2,
      bubbles: true,
    })
    Object.defineProperty(disabledDown, 'pointerId', { value: 31 })
    disabledOverlay.element.dispatchEvent(disabledDown)
    const disabledMove = new MouseEvent('pointermove', {
      clientX: disabledWidth * 0.75,
      clientY: disabledHeight / 2,
      bubbles: true,
    })
    Object.defineProperty(disabledMove, 'pointerId', { value: 31 })
    disabledOverlay.element.dispatchEvent(disabledMove)
    await flushPromises()
    expect(disabled.find('.waveform-chart__zoom-selection').exists()).toBe(true)

    const enabled = await mountSizedChart(data, { pannable: true })
    const enabledOverlay = enabled.get('.waveform-chart__overlay--independent')
    const enabledWidth = Number(enabledOverlay.attributes('width'))
    const enabledHeight = Number(enabledOverlay.attributes('height'))
    Object.defineProperty(enabledOverlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: enabledWidth, height: enabledHeight }),
    })
    const boxDown = new MouseEvent('pointerdown', {
      button: 0,
      clientX: enabledWidth * 0.25,
      clientY: enabledHeight / 2,
      bubbles: true,
    })
    Object.defineProperty(boxDown, 'pointerId', { value: 30 })
    enabledOverlay.element.dispatchEvent(boxDown)
    const boxMove = new MouseEvent('pointermove', {
      clientX: enabledWidth * 0.75,
      clientY: enabledHeight / 2,
      bubbles: true,
    })
    Object.defineProperty(boxMove, 'pointerId', { value: 30 })
    enabledOverlay.element.dispatchEvent(boxMove)
    const boxUp = new MouseEvent('pointerup', {
      clientX: enabledWidth * 0.75,
      clientY: enabledHeight / 2,
      bubbles: true,
    })
    Object.defineProperty(boxUp, 'pointerId', { value: 30 })
    enabledOverlay.element.dispatchEvent(boxUp)
    await flushPromises()
    const startBeforePan = enabled.get('.waveform-chart__axis-endpoint--start').text()

    await enabled.trigger('pointerenter')
    const spaceDown = new KeyboardEvent('keydown', { code: 'Space', cancelable: true })
    window.dispatchEvent(spaceDown)
    const enabledDown = new MouseEvent('pointerdown', {
      button: 0,
      clientX: enabledWidth / 2,
      clientY: enabledHeight / 2,
      bubbles: true,
    })
    Object.defineProperty(enabledDown, 'pointerId', { value: 32 })
    enabledOverlay.element.dispatchEvent(enabledDown)
    const enabledMove = new MouseEvent('pointermove', {
      clientX: enabledWidth / 2 + 20,
      clientY: enabledHeight / 2,
      bubbles: true,
    })
    Object.defineProperty(enabledMove, 'pointerId', { value: 32 })
    enabledOverlay.element.dispatchEvent(enabledMove)
    await flushPromises()

    expect(spaceDown.defaultPrevented).toBe(true)
    expect(enabled.classes()).toContain('waveform-chart--panning')
    expect(enabled.find('.waveform-chart__zoom-selection').exists()).toBe(false)
    expect(enabled.get('.waveform-chart__axis-endpoint--start').text()).not.toBe(startBeforePan)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))
  })

  it('keeps a fixed Y domain through panning and viewport reset', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 100 },
        ],
      },
      { pannable: true, yDomain: [3, 97] },
    )
    const overlay = wrapper.get('.waveform-chart__overlay--independent')
    const width = Number(overlay.attributes('width'))
    const height = Number(overlay.attributes('height'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height }),
    })
    const yTickLabels = () =>
      wrapper
        .get('.waveform-chart__axis--y')
        .findAll('.tick text')
        .map((tick) => tick.text())
    const initialLabels = yTickLabels()

    await wrapper.trigger('pointerenter')
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', cancelable: true }))
    const down = new MouseEvent('pointerdown', {
      button: 0,
      clientX: width / 2,
      clientY: height / 2,
      bubbles: true,
    })
    Object.defineProperty(down, 'pointerId', { value: 34 })
    overlay.element.dispatchEvent(down)
    const move = new MouseEvent('pointermove', {
      clientX: width / 2 + 20,
      clientY: height / 2 + 40,
      bubbles: true,
    })
    Object.defineProperty(move, 'pointerId', { value: 34 })
    overlay.element.dispatchEvent(move)
    await flushPromises()

    expect(yTickLabels()).toEqual(initialLabels)
    ;(wrapper.vm as unknown as { resetViewport: () => void }).resetViewport()
    await flushPromises()
    expect(yTickLabels()).toEqual(initialLabels)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))
  })

  it('does not activate pannable on a chart that the pointer is outside', async () => {
    const data: WaveformData = {
      kind: 'points',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    }
    const active = await mountSizedChart(data, { pannable: true })
    const inactive = await mountSizedChart(data, { pannable: true })
    await active.trigger('pointerenter')

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', cancelable: true }))

    const inactiveOverlay = inactive.get('.waveform-chart__overlay--independent')
    const width = Number(inactiveOverlay.attributes('width'))
    const height = Number(inactiveOverlay.attributes('height'))
    Object.defineProperty(inactiveOverlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height }),
    })
    const down = new MouseEvent('pointerdown', {
      button: 0,
      clientX: width * 0.25,
      clientY: height / 2,
      bubbles: true,
    })
    Object.defineProperty(down, 'pointerId', { value: 33 })
    inactiveOverlay.element.dispatchEvent(down)
    const move = new MouseEvent('pointermove', {
      clientX: width * 0.75,
      clientY: height / 2,
      bubbles: true,
    })
    Object.defineProperty(move, 'pointerId', { value: 33 })
    inactiveOverlay.element.dispatchEvent(move)
    await flushPromises()

    expect(inactive.find('.waveform-chart__zoom-selection').exists()).toBe(true)
    expect(inactive.classes()).not.toContain('waveform-chart--panning')
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))
  })

  it('limits box zoom to the configured minimum x span', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 10 },
          { x: 2, y: 20 },
        ],
      },
      { minZoomSpan: 0.25 },
    )
    const overlay = wrapper.get('.waveform-chart__overlay--independent')
    const width = Number(overlay.attributes('width'))
    const height = Number(overlay.attributes('height'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height }),
    })
    const dispatchPointer = (type: string, clientX: number, clientY: number) => {
      const event = new MouseEvent(type, { button: 0, clientX, clientY, bubbles: true })
      Object.defineProperty(event, 'pointerId', { value: 8 })
      overlay.element.dispatchEvent(event)
    }
    dispatchPointer('pointerdown', width / 2, height / 2)
    dispatchPointer('pointermove', width / 2 + 8, height / 2 + 8)
    dispatchPointer('pointerup', width / 2 + 8, height / 2 + 8)
    await flushPromises()

    const payload = wrapper.emitted('zoom-end')?.at(-1)?.[0] as { start: number; end: number }
    expect(payload.end - payload.start).toBeGreaterThanOrEqual(0.25 - 1e-8)
  })
})
