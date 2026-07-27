import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { flushAnimationFrames } from '../../test/setup'

import { mountSizedChart } from '../../test/waveformChart'

describe('WaveformChart', () => {
  it('edits and immediately deletes existing annotations without mutating props', async () => {
    const sourceAnnotation = {
      id: 'note',
      seriesId: 'series-0',
      x: 1,
      y: 5,
      text: '原文字',
    }
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { annotations: [sourceAnnotation] },
    )

    await wrapper.get('[data-annotation-id="note"]').trigger('contextmenu', {
      clientX: 200,
      clientY: 100,
    })
    await wrapper.get('.waveform-annotation-context-menu button').trigger('click')
    await flushPromises()
    await wrapper.get('textarea[aria-label="标注文本"]').setValue('新文字')
    await wrapper.get('.waveform-annotation-editor button.is-primary').trigger('click')

    const updated = wrapper.emitted('update:annotations')?.at(-1)?.[0] as
      Array<{ text: string }> | undefined
    expect(updated?.[0].text).toBe('新文字')
    expect(sourceAnnotation.text).toBe('原文字')
    expect(wrapper.emitted('annotation-update')).toHaveLength(1)

    await wrapper.get('[data-annotation-id="note"]').trigger('contextmenu', {
      clientX: 200,
      clientY: 100,
    })
    await wrapper.findAll('.waveform-annotation-context-menu button')[1].trigger('click')
    expect(wrapper.emitted('update:annotations')?.at(-1)?.[0]).toEqual([])
    expect(wrapper.emitted('annotation-delete')).toHaveLength(1)
  })

  it('commits a dragged label offset once without changing its data anchor', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { annotations: [{ id: 'dragged', seriesId: 'series-0', x: 1, y: 5, text: '拖动' }] },
    )
    const annotation = wrapper.get('[data-annotation-id="dragged"]')
    const element = annotation.element as SVGElement & {
      setPointerCapture: (pointerId: number) => void
      releasePointerCapture: (pointerId: number) => void
      hasPointerCapture: (pointerId: number) => boolean
    }
    element.setPointerCapture = () => undefined
    element.releasePointerCapture = () => undefined
    element.hasPointerCapture = () => false

    const dispatchPointer = (type: string, values: Record<string, number>) => {
      const event = new Event(type, { bubbles: true })
      Object.defineProperties(event, {
        button: { value: values.button ?? 0 },
        clientX: { value: values.clientX ?? 0 },
        clientY: { value: values.clientY ?? 0 },
        pointerId: { value: values.pointerId ?? 1 },
      })
      element.dispatchEvent(event)
    }

    dispatchPointer('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
    expect(wrapper.emitted('update:annotations')).toBeUndefined()
    dispatchPointer('pointermove', { clientX: 130, clientY: 120, pointerId: 1 })
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.emitted('update:annotations')).toBeUndefined()
    dispatchPointer('pointermove', { clientX: 140, clientY: 130, pointerId: 1 })
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.emitted('update:annotations')).toBeUndefined()
    const boxBeforeUp = {
      x: wrapper.get('.waveform-annotation__box').attributes('x'),
      y: wrapper.get('.waveform-annotation__box').attributes('y'),
    }
    dispatchPointer('pointerup', { clientX: 140, clientY: 130, pointerId: 1 })
    await flushPromises()
    expect(wrapper.get('.waveform-annotation__box').attributes('x')).toBe(boxBeforeUp.x)
    expect(wrapper.get('.waveform-annotation__box').attributes('y')).toBe(boxBeforeUp.y)

    const updated = wrapper.emitted('update:annotations')?.at(-1)?.[0] as
      Array<{ x: number; y: number; labelOffsetX?: number; labelOffsetY?: number }> | undefined
    expect(updated).toMatchObject([{ x: 1, y: 5, labelOffsetX: 40, labelOffsetY: 30 }])
    expect(wrapper.emitted('update:annotations')).toHaveLength(1)
  })

  it('hides the tooltip through a label drag until the next real hover move', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { annotations: [{ id: 'dragged', seriesId: 'series-0', x: 1, y: 5, text: '拖动' }] },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    const overlayWidth = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: 290 }),
    })
    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: overlayWidth, clientY: 120, bubbles: true }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.find('.waveform-chart__tooltip').exists()).toBe(true)

    const annotation = wrapper.get('[data-annotation-id="dragged"]')
    const element = annotation.element as SVGElement & {
      setPointerCapture: (pointerId: number) => void
      releasePointerCapture: (pointerId: number) => void
      hasPointerCapture: (pointerId: number) => boolean
    }
    element.setPointerCapture = () => undefined
    element.releasePointerCapture = () => undefined
    element.hasPointerCapture = () => false
    const dispatchPointer = (type: string, values: Record<string, number>) => {
      const event = new Event(type, { bubbles: true })
      Object.defineProperties(event, {
        button: { value: values.button ?? 0 },
        clientX: { value: values.clientX ?? 0 },
        clientY: { value: values.clientY ?? 0 },
        pointerId: { value: values.pointerId ?? 1 },
      })
      element.dispatchEvent(event)
    }

    dispatchPointer('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
    await flushPromises()
    expect(wrapper.find('.waveform-chart__tooltip').exists()).toBe(false)
    dispatchPointer('pointermove', { clientX: 130, clientY: 120, pointerId: 1 })
    dispatchPointer('pointerup', { clientX: 130, clientY: 120, pointerId: 1 })
    await flushPromises()
    expect(wrapper.find('.waveform-chart__tooltip').exists()).toBe(false)

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: overlayWidth / 2, clientY: 120, bubbles: true }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.find('.waveform-chart__tooltip').exists()).toBe(false)

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: overlayWidth, clientY: 120, bubbles: true }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.find('.waveform-chart__tooltip').exists()).toBe(true)
  })

  it('controls visibility and interaction mode while filtering unknown series', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      {
        interactionMode: 'annotation',
        annotations: [
          { id: 'valid', seriesId: 'series-0', x: 1, y: 5, text: '显示' },
          { id: 'unknown', seriesId: 'missing', x: 1, y: 5, text: '不显示' },
        ],
      },
    )

    expect(wrapper.attributes('data-interaction-mode')).toBe('annotation')
    expect(wrapper.findAll('.waveform-annotation')).toHaveLength(1)
    expect(wrapper.find('.waveform-annotation-toolbar').exists()).toBe(false)
    expect(wrapper.get('.waveform-chart__overlay').classes()).toContain('is-annotating')
    await wrapper.setProps({ annotationsVisible: false })
    expect(wrapper.find('.waveform-annotation').exists()).toBe(false)
  })

  it('reprojects annotations after zoom and keeps them in every display mode', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'a',
            name: 'A',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
                { x: 2, y: 0 },
              ],
            },
          },
        ],
      },
      { annotations: [{ id: 'note', seriesId: 'a', x: 1, y: 1, text: '峰值' }] },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 712, height: 290 }),
    })
    const initialX = wrapper.get('.waveform-annotation__arrow').attributes('x2')

    overlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -200,
        clientX: 600,
        clientY: 145,
        bubbles: true,
        cancelable: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.get('.waveform-annotation__arrow').attributes('x2')).not.toBe(initialX)

    for (const displayMode of ['separated', 'compact'] as const) {
      await wrapper.setProps({ displayMode })
      await flushPromises()
      expect(wrapper.find('[data-annotation-id="note"]').exists()).toBe(true)
    }
  })
})
