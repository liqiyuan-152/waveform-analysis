import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { flushAnimationFrames } from '../../test/setup'

import { gridSeries, mountSizedChart } from '../../test/waveformChart'

describe('WaveformChart', () => {
  it('does not zoom a track when its visible sample count is below the configured minimum', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 10 },
          { x: 2, y: 20 },
        ],
      },
      { minVisiblePoints: 10 },
    )
    const overlay = wrapper.get('.waveform-chart__overlay--independent')
    const width = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height: 290 }),
    })
    overlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -1000,
        clientX: width / 2,
        clientY: 145,
        bubbles: true,
        cancelable: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()

    expect(wrapper.emitted('zoom-change')).toBeUndefined()
    expect(wrapper.emitted('zoom-end')).toBeUndefined()
  })

  it('ignores shared viewport dragging', async () => {
    const wrapper = await mountSizedChart({
      kind: 'points',
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 1 },
      ],
    })
    const overlay = wrapper.get('.waveform-chart__overlay')
    const width = Number(overlay.attributes('width'))
    const createDragEvent = (type: string, init: MouseEventInit) => {
      const event = new MouseEvent(type, init)
      Object.defineProperty(event, 'view', { value: window })
      return event
    }
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height: 290 }),
    })
    overlay.element.dispatchEvent(
      createDragEvent('mousedown', {
        button: 0,
        clientX: width / 2,
        clientY: 145,
        bubbles: true,
        cancelable: true,
      }),
    )
    window.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: width / 2 + 80,
        clientY: 145,
        bubbles: true,
      }),
    )
    window.dispatchEvent(createDragEvent('mouseup', { bubbles: true }))
    flushAnimationFrames()
    await flushPromises()

    expect(wrapper.emitted('zoom-change')).toBeUndefined()
    expect(wrapper.emitted('zoom-end')).toBeUndefined()
    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).toBe('0.00')
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('2.00')
  })

  it('ignores independent viewport dragging', async () => {
    const wrapper = await mountSizedChart(gridSeries(2), {
      displayMode: 'independent',
      grid: { rowCount: 1, columnCount: 2 },
    })
    const overlay = wrapper.findAll('.waveform-chart__overlay--independent')[0]
    const width = Number(overlay.attributes('width'))
    const createDragEvent = (type: string, init: MouseEventInit) => {
      const event = new MouseEvent(type, init)
      Object.defineProperty(event, 'view', { value: window })
      return event
    }
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height: 260 }),
    })

    overlay.element.dispatchEvent(
      createDragEvent('mousedown', {
        button: 0,
        clientX: width / 2,
        clientY: 130,
        bubbles: true,
        cancelable: true,
      }),
    )
    window.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: width / 2 + 60,
        clientY: 130,
        bubbles: true,
      }),
    )
    window.dispatchEvent(createDragEvent('mouseup', { bubbles: true }))
    flushAnimationFrames()
    await flushPromises()

    expect(wrapper.emitted('zoom-change')).toBeUndefined()
    expect(wrapper.emitted('zoom-end')).toBeUndefined()
  })

  it('includes track and series IDs in independent zoom-end payloads', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = await mountSizedChart(gridSeries(2), {
        displayMode: 'independent',
        grid: { rowCount: 1, columnCount: 2 },
      })
      const overlay = wrapper.findAll('.waveform-chart__overlay--independent')[0]
      const overlayWidth = Number(overlay.attributes('width'))
      Object.defineProperty(overlay.element, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: overlayWidth, height: 260 }),
      })

      overlay.element.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: -4000,
          clientX: overlayWidth / 2,
          clientY: 130,
          bubbles: true,
          cancelable: true,
        }),
      )
      flushAnimationFrames()
      await vi.advanceTimersByTimeAsync(200)
      await flushPromises()

      const payload = wrapper.emitted('zoom-end')?.at(-1)?.[0] as
        { trackIndex: number; seriesIds: string[] } | undefined
      expect(payload).toMatchObject({ trackIndex: 0, seriesIds: ['channel-0'] })
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the global minimum zoom span after replacing the data window', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 1 },
        ],
      },
      { minZoomSpan: 10 },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    const width = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height: 290 }),
    })
    const zoomAtCenter = async () => {
      overlay.element.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: -4000,
          clientX: width / 2,
          clientY: 145,
          bubbles: true,
          cancelable: true,
        }),
      )
      flushAnimationFrames()
      await flushPromises()
    }

    await zoomAtCenter()
    const firstDomain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
    expect(firstDomain[1] - firstDomain[0]).toBeCloseTo(10)

    await wrapper.setProps({
      data: {
        kind: 'points',
        points: [
          { x: firstDomain[0], y: 0 },
          { x: firstDomain[1], y: 1 },
        ],
      },
    })
    await flushPromises()
    await zoomAtCenter()

    const secondDomain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
    expect(secondDomain[1] - secondDomain[0]).toBeCloseTo(10)
  })

  it('zooms a shared viewport back out after loading a narrower data window', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 1 },
        ],
      },
      { displayMode: 'separated', initialXDomain: [0, 100] },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    const width = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height: 290 }),
    })
    const dispatchWheel = async (deltaY: number) => {
      overlay.element.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY,
          clientX: width / 2,
          clientY: 145,
          bubbles: true,
          cancelable: true,
        }),
      )
      flushAnimationFrames()
      await flushPromises()
    }

    await dispatchWheel(-4000)
    const zoomedDomain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
    expect(zoomedDomain[1] - zoomedDomain[0]).toBeCloseTo(2.5)

    await wrapper.setProps({
      data: {
        kind: 'points',
        points: [
          { x: 48, y: 0 },
          { x: 52, y: 1 },
        ],
      },
    })
    await flushPromises()
    const preservedDomain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
    expect(preservedDomain[1] - preservedDomain[0]).toBeCloseTo(2.5)

    const eventCount = wrapper.emitted('zoom-change')?.length ?? 0
    await dispatchWheel(4000)
    const zoomedOutDomain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
    expect(wrapper.emitted('zoom-change')?.length ?? 0).toBe(eventCount + 1)
    expect(zoomedOutDomain[1] - zoomedOutDomain[0]).toBeCloseTo(100)

    const fullDomainEventCount = wrapper.emitted('zoom-change')?.length ?? 0
    await dispatchWheel(4000)
    expect(wrapper.emitted('zoom-change')?.length ?? 0).toBe(fullDomainEventCount)
  })

  it('allows zooming out when the minimum visible point count blocks zooming in', async () => {
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
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height: 290 }),
    })
    const dispatchWheel = async (deltaY: number) => {
      overlay.element.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY,
          clientX: width / 2,
          clientY: 145,
          bubbles: true,
          cancelable: true,
        }),
      )
      flushAnimationFrames()
      await flushPromises()
    }

    await dispatchWheel(-4000)
    const zoomedDomain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
    expect(zoomedDomain[1] - zoomedDomain[0]).toBeCloseTo(0.05)

    await wrapper.setProps({ minVisiblePoints: 10 })
    await flushPromises()
    const eventCount = wrapper.emitted('zoom-change')?.length ?? 0
    await dispatchWheel(-1000)
    expect(wrapper.emitted('zoom-change')?.length ?? 0).toBe(eventCount)

    await dispatchWheel(4000)
    const zoomedOutDomain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
    expect(wrapper.emitted('zoom-change')?.length ?? 0).toBe(eventCount + 1)
    expect(zoomedOutDomain).toEqual([0, 2])
  })

  it('resets a shared viewport on double-click and emits zoom-reset', async () => {
    const wrapper = await mountSizedChart({
      kind: 'points',
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 1 },
      ],
    })
    const overlay = wrapper.get('.waveform-chart__overlay')
    const width = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height: 290 }),
    })
    overlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -4000,
        clientX: width / 2,
        clientY: 145,
        bubbles: true,
        cancelable: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).not.toBe('0.00')

    overlay.element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))
    await flushPromises()

    expect(wrapper.emitted('zoom-reset')).toHaveLength(1)
    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).toBe('0.00')
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('2.00')
  })

  it('exposes resetViewport for independent tracks', async () => {
    const wrapper = await mountSizedChart(gridSeries(2), {
      displayMode: 'independent',
      grid: { rowCount: 1, columnCount: 2 },
    })
    const overlay = wrapper.findAll('.waveform-chart__overlay--independent')[0]
    const width = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height: 260 }),
    })
    overlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -4000,
        clientX: width / 2,
        clientY: 130,
        bubbles: true,
        cancelable: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.findAll('.waveform-chart__axis-endpoint--start')[0].text()).not.toBe('0.00')

    const chart = wrapper.vm as unknown as { resetViewport: () => void }
    chart.resetViewport()
    await flushPromises()

    expect(wrapper.findAll('.waveform-chart__axis-endpoint--start')[0].text()).toBe('0.00')
    expect(wrapper.findAll('.waveform-chart__axis-endpoint--end')[0].text()).toBe('1.00')
  })
})
