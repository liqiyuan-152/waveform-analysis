import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { flushAnimationFrames } from '../../test/setup'
import { mountSizedChart } from '../../test/waveformChart'
import type { WaveformData, WaveformDisplayMode } from '../data/types'

function annotationEditorExists() {
  return Boolean(
    Array.from(document.body.querySelectorAll<HTMLElement>('[role="dialog"]'))
      .filter((element) => element.closest('.waveform-annotation-editor'))
      .at(-1),
  )
}

const presentationData: WaveformData = {
  kind: 'series',
  series: [
    {
      id: 'low',
      trackId: 'shared',
      name: '低量程',
      data: {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 10 },
          { x: 2, y: 5 },
        ],
      },
    },
    {
      id: 'high',
      trackId: 'shared',
      name: '高量程',
      data: {
        kind: 'points',
        points: [
          { x: 0, y: 100 },
          { x: 1, y: 200 },
          { x: 2, y: 150 },
        ],
      },
    },
    {
      id: 'mid',
      trackId: 'shared',
      name: '中量程',
      data: {
        kind: 'points',
        points: [
          { x: 0, y: 50 },
          { x: 1, y: 100 },
          { x: 2, y: 75 },
        ],
      },
    },
    {
      id: 'other',
      name: '其他通道',
      data: {
        kind: 'points',
        points: [
          { x: 0, y: -1 },
          { x: 1, y: 1 },
          { x: 2, y: 0 },
        ],
      },
    },
  ],
}

function setOverlayBounds(overlay: ReturnType<Awaited<ReturnType<typeof mountSizedChart>>['get']>) {
  const width = Number(overlay.attributes('width'))
  const height = Number(overlay.attributes('height'))
  Object.defineProperty(overlay.element, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width, height }),
  })
  return { width, height }
}

function dispatchPointer(
  element: Element,
  type: string,
  options: MouseEventInit & { pointerId: number },
) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...options })
  Object.defineProperty(event, 'pointerId', { value: options.pointerId })
  element.dispatchEvent(event)
}

describe('WaveformChart presentation mode', () => {
  it('keeps existing plot interaction enabled by default', async () => {
    const wrapper = await mountSizedChart(presentationData, {
      grid: { rowCount: 1, columnCount: 1 },
    })
    const overlay = wrapper.get('.waveform-chart__overlay--independent')
    const { width, height } = setOverlayBounds(overlay)

    expect(wrapper.attributes('data-presentation-mode')).toBe('false')
    expect(overlay.classes()).toContain('is-zoomable')

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', {
        clientX: width / 2,
        clientY: height / 2,
        bubbles: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()

    expect(wrapper.find('.waveform-chart__tooltip').exists()).toBe(true)
    expect(wrapper.emitted('point-hover')?.length).toBeGreaterThan(0)
  })

  it.each<WaveformDisplayMode>(['independent', 'separated'])(
    'blocks plot mouse events in %s layout',
    async (displayMode) => {
      const wrapper = await mountSizedChart(presentationData, {
        annotations: [{ id: 'note', seriesId: 'low', x: 1, y: 10, text: '只读标注' }],
        displayMode,
        grid: { rowCount: 1, columnCount: 1 },
        interactionMode: 'annotation',
        presentationMode: true,
      })
      const overlay = wrapper.get('.waveform-chart__overlay')
      const { width, height } = setOverlayBounds(overlay)

      expect(wrapper.attributes('data-presentation-mode')).toBe('true')
      expect(overlay.classes()).not.toContain('is-zoomable')
      expect(overlay.classes()).not.toContain('is-annotating')

      overlay.element.dispatchEvent(
        new MouseEvent('pointermove', {
          clientX: width / 2,
          clientY: height / 2,
          bubbles: true,
        }),
      )
      overlay.element.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: -4000,
          clientX: width / 2,
          clientY: height / 2,
          bubbles: true,
          cancelable: true,
        }),
      )
      overlay.element.dispatchEvent(
        new MouseEvent('click', {
          clientX: width / 2,
          clientY: height / 2,
          bubbles: true,
          cancelable: true,
        }),
      )
      overlay.element.dispatchEvent(
        new MouseEvent('contextmenu', {
          clientX: width / 2,
          clientY: height / 2,
          bubbles: true,
          cancelable: true,
        }),
      )
      wrapper
        .get('.waveform-chart__svg')
        .element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))
      await wrapper.get('[data-annotation-id="note"]').trigger('contextmenu', {
        clientX: width / 2,
        clientY: height / 2,
      })
      const annotation = wrapper.get('[data-annotation-id="note"]').element
      dispatchPointer(annotation, 'pointerdown', {
        button: 0,
        clientX: width / 2,
        clientY: height / 2,
        pointerId: 42,
      })
      dispatchPointer(annotation, 'pointermove', {
        clientX: width / 2 + 30,
        clientY: height / 2 + 20,
        pointerId: 42,
      })
      dispatchPointer(annotation, 'pointerup', {
        clientX: width / 2 + 30,
        clientY: height / 2 + 20,
        pointerId: 42,
      })
      flushAnimationFrames()
      await flushPromises()

      expect(wrapper.find('.waveform-chart__tooltip').exists()).toBe(false)
      expect(wrapper.find('.waveform-annotation-editor').exists()).toBe(false)
      expect(wrapper.find('.waveform-annotation-context-menu').exists()).toBe(false)
      expect(wrapper.emitted('point-hover')).toBeUndefined()
      expect(wrapper.emitted('zoom-change')).toBeUndefined()
      expect(wrapper.emitted('zoom-end')).toBeUndefined()
      expect(wrapper.emitted('zoom-reset')).toBeUndefined()
      expect(wrapper.emitted('update:annotations')).toBeUndefined()
    },
  )

  it('keeps the legend and pagination interactive', async () => {
    const wrapper = await mountSizedChart(presentationData, {
      grid: { rowCount: 1, columnCount: 1, showPagination: true },
      legend: { interactive: true },
      presentationMode: true,
    })

    await wrapper.findAll('.waveform-chart__legend-item')[1]!.trigger('click')
    await flushPromises()
    expect(wrapper.emitted('update:hidden-series-ids')?.at(-1)).toEqual([['high']])

    await wrapper.get('.ant-pagination-next button').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('page-change')?.at(-1)).toEqual([2, 2])
  })

  it('cleans active UI state and restores interaction without resetting the viewport', async () => {
    const wrapper = await mountSizedChart(presentationData, {
      grid: { rowCount: 1, columnCount: 1 },
    })
    const overlay = wrapper.get('.waveform-chart__overlay--independent')
    const { width, height } = setOverlayBounds(overlay)

    overlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -4000,
        clientX: width / 2,
        clientY: height / 2,
        bubbles: true,
        cancelable: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()
    const zoomedEndpoint = wrapper.get('.waveform-chart__axis-endpoint--end').text()

    dispatchPointer(overlay.element, 'pointerdown', {
      button: 0,
      clientX: width * 0.25,
      clientY: height / 2,
      pointerId: 41,
    })
    dispatchPointer(overlay.element, 'pointermove', {
      clientX: width * 0.75,
      clientY: height / 2,
      pointerId: 41,
    })
    await flushPromises()
    expect(wrapper.find('.waveform-chart__zoom-selection').exists()).toBe(true)

    await wrapper.setProps({ presentationMode: true })
    await flushPromises()

    expect(wrapper.find('.waveform-chart__zoom-selection').exists()).toBe(false)
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe(zoomedEndpoint)

    const zoomEventCount = wrapper.emitted('zoom-change')?.length ?? 0
    await wrapper.setProps({ presentationMode: false })
    await flushPromises()
    overlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: 200,
        clientX: width / 2,
        clientY: height / 2,
        bubbles: true,
        cancelable: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()

    expect(wrapper.emitted('zoom-change')?.length).toBeGreaterThan(zoomEventCount)
  })

  it('closes hover and annotation UI when enabled at runtime', async () => {
    const wrapper = await mountSizedChart(presentationData, {
      grid: { rowCount: 1, columnCount: 1 },
      interactionMode: 'annotation',
    })
    const overlay = wrapper.get('.waveform-chart__overlay--independent')
    const { width, height } = setOverlayBounds(overlay)

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', {
        clientX: width / 2,
        clientY: height / 2,
        bubbles: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.find('.waveform-chart__tooltip').exists()).toBe(true)

    overlay.element.dispatchEvent(
      new MouseEvent('contextmenu', {
        clientX: width / 2,
        clientY: height / 2,
        bubbles: true,
        cancelable: true,
      }),
    )
    await flushPromises()
    expect(annotationEditorExists()).toBe(true)

    await wrapper.setProps({ presentationMode: true })
    await flushPromises()

    expect(wrapper.find('.waveform-chart__tooltip').exists()).toBe(false)
    expect(annotationEditorExists()).toBe(false)
    expect(wrapper.emitted('point-hover')?.at(-1)).toEqual([null])

    await wrapper.setProps({ presentationMode: false })
    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', {
        clientX: width / 2,
        clientY: height / 2,
        bubbles: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.find('.waveform-chart__tooltip').exists()).toBe(true)
  })
})
