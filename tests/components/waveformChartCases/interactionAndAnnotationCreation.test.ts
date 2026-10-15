import { DOMWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { flushAnimationFrames, pendingAnimationFrameCount } from '@tests/support/setup'

import { flushVueChartUpdates, mountSizedChart } from '@tests/support/waveformChart'

function getAnnotationEditor() {
  const editor = Array.from(document.body.querySelectorAll<HTMLElement>('[role="dialog"]'))
    .filter((element) => element.closest('.waveform-annotation-editor'))
    .at(-1)
  if (!editor) throw new Error('Expected annotation editor modal to be mounted')
  return new DOMWrapper(editor)
}

describe('WaveformChart', () => {
  it.each(['independent', 'separated'] as const)(
    'only creates annotations with the left button in annotation mode (%s)',
    async (displayMode) => {
      const wrapper = await mountSizedChart(
        { kind: 'samples', values: [0, 5], sampleRate: 1 },
        { displayMode, toolbar: true },
      )
      const overlay = wrapper.get('.waveform-chart__overlay')
      Object.defineProperty(overlay.element, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: 712, height: 290 }),
      })
      const editorExists = () =>
        Array.from(document.body.querySelectorAll('[role="dialog"]')).some((element) =>
          element.closest('.waveform-annotation-editor'),
        )

      for (const mode of ['zoom', 'pan', 'none', 'annotation'] as const) {
        await wrapper.setProps({ interactionMode: mode })
        await flushVueChartUpdates()
        await overlay.trigger('contextmenu', { button: 2, clientX: 356, clientY: 145 })
        expect(editorExists()).toBe(false)
        await overlay.trigger('click', { button: 2, clientX: 356, clientY: 145 })
        expect(editorExists()).toBe(false)
        await overlay.trigger('click', { button: 1, clientX: 356, clientY: 145 })
        expect(editorExists()).toBe(false)
        if (mode !== 'annotation') {
          await overlay.trigger('click', { button: 0, clientX: 356, clientY: 145 })
          expect(editorExists()).toBe(false)
        }
      }
      await wrapper.setProps({ annotationsVisible: false })
      await flushVueChartUpdates()
      await overlay.trigger('click', { button: 0, clientX: 356, clientY: 145 })
      expect(editorExists()).toBe(false)
      await wrapper.setProps({ annotationsVisible: true })
      await flushVueChartUpdates()
      await overlay.trigger('click', { button: 0, clientX: 356, clientY: 145 })
      await flushVueChartUpdates()
      expect(editorExists()).toBe(true)
      expect(wrapper.emitted('annotation-create')).toBeUndefined()
      await getAnnotationEditor().get('.waveform-modal__close').trigger('click')
      await flushVueChartUpdates()
      wrapper.unmount()
    },
  )

  it('zooms only the active independent track and resets when the mode changes', async () => {
    const wrapper = await mountSizedChart({
      kind: 'series',
      series: [
        {
          name: 'A',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 0 },
              { x: 2, y: 1 },
            ],
          },
        },
        {
          name: 'B',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 2 },
              { x: 2, y: 3 },
            ],
          },
        },
      ],
    })
    const endpoints = () =>
      wrapper.findAll('.waveform-chart__axis-endpoint--end').map((item) => item.text())
    const initialEndpoints = endpoints()
    const firstOverlay = wrapper.findAll('.waveform-chart__overlay--independent')[0]
    Object.defineProperty(firstOverlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 712, height: 130 }),
    })

    firstOverlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -4000,
        clientX: 356,
        clientY: 65,
        bubbles: true,
        cancelable: true,
      }),
    )
    flushAnimationFrames()
    await flushVueChartUpdates()

    expect(endpoints()[0]).not.toBe(initialEndpoints[0])
    expect(endpoints()[1]).toBe(initialEndpoints[1])

    await wrapper.setProps({ displayMode: 'separated' })
    await flushVueChartUpdates()

    expect(
      wrapper.findAll('.waveform-chart__axis--x').filter((axis) => axis.isVisible()),
    ).toHaveLength(1)
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('2000')
  })

  it('updates rendering props and disables zoom interaction', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 1 },
          { x: 1, y: 2 },
        ],
      },
      { zoomable: true, lineColor: '#ff0000' },
    )

    expect(wrapper.get('.waveform-chart__line').attributes('stroke')).toBe('#ff0000')
    expect(wrapper.get('.waveform-chart__overlay').classes()).toContain('is-zoomable')

    await wrapper.setProps({ zoomable: false, lineColor: '#00aa00' })
    await flushVueChartUpdates()

    expect(wrapper.get('.waveform-chart__line').attributes('stroke')).toBe('#00aa00')
    expect(wrapper.get('.waveform-chart__overlay').classes()).not.toContain('is-zoomable')
  })

  it('binds zoom only while zooming is enabled', async () => {
    const wrapper = await mountSizedChart({
      kind: 'points',
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 1 },
      ],
    })
    const overlay = wrapper.get('.waveform-chart__overlay')
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 712, height: 290 }),
    })
    const initialZoomEventCount = wrapper.emitted('zoom-change')?.length ?? 0
    overlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -4000,
        clientX: 356,
        clientY: 145,
        bubbles: true,
        cancelable: true,
      }),
    )
    overlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -200,
        clientX: 356,
        clientY: 145,
        bubbles: true,
        cancelable: true,
      }),
    )
    expect(pendingAnimationFrameCount()).toBe(1)
    expect(wrapper.emitted('zoom-change')?.length ?? 0).toBe(initialZoomEventCount)
    flushAnimationFrames()
    await flushVueChartUpdates()

    expect(wrapper.emitted('zoom-change')?.length ?? 0).toBe(initialZoomEventCount + 1)

    await wrapper.setProps({ zoomable: false })
    await flushVueChartUpdates()
    const zoomEventCount = wrapper.emitted('zoom-change')?.length ?? 0
    overlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -4000,
        clientX: 356,
        clientY: 145,
        bubbles: true,
        cancelable: true,
      }),
    )
    flushAnimationFrames()
    await flushVueChartUpdates()

    expect(wrapper.emitted('zoom-change')?.length ?? 0).toBe(zoomEventCount)
    expect(overlay.classes()).not.toContain('is-zoomable')
  })

  it('creates a controlled annotation from externally selected annotation mode', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { interactionMode: 'annotation' },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    const overlayWidth = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: 290 }),
    })
    const path = wrapper.get('.waveform-chart__line').attributes('d') ?? ''
    const endpoint = path.match(/L([\d.-]+),([\d.-]+)$/)
    expect(endpoint).not.toBeNull()

    expect(wrapper.get('.waveform-chart').attributes('data-interaction-mode')).toBe('annotation')
    overlay.element.dispatchEvent(
      new MouseEvent('click', {
        clientX: Number(endpoint?.[1]),
        clientY: Number(endpoint?.[2]),
        bubbles: true,
        cancelable: true,
      }),
    )
    await flushVueChartUpdates()

    const editor = getAnnotationEditor()
    await editor.get('textarea[aria-label="标注文本"]').setValue('峰值点')
    await editor.get('.waveform-modal__button--primary').trigger('click')
    await flushVueChartUpdates()

    const annotations = wrapper.emitted('update:annotations')?.at(-1)?.[0] as
      Array<{ seriesId: string; x: number; y: number; text: string }> | undefined
    expect(annotations).toHaveLength(1)
    expect(annotations?.[0]).toMatchObject({ seriesId: 'series-0', x: 1, y: 5, text: '峰值点' })
    expect(wrapper.emitted('annotation-create')).toHaveLength(1)
    expect(wrapper.get('.waveform-chart').attributes('data-interaction-mode')).toBe('annotation')
  })

  it('creates annotations anywhere in the plot after selecting the toolbar annotation mode', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { grid: { rowCount: 1, columnCount: 1 }, toolbar: true },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    const overlayWidth = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: 290 }),
    })

    await wrapper.get('[data-command="annotate"]').trigger('click')
    expect(wrapper.get('.waveform-chart').attributes('data-interaction-mode')).toBe('annotation')
    overlay.element.dispatchEvent(
      new MouseEvent('click', {
        clientX: overlayWidth / 2,
        clientY: 145,
        bubbles: true,
      }),
    )
    await flushVueChartUpdates()
    const editor = getAnnotationEditor()
    expect(editor.attributes('role')).toBe('dialog')
    expect(editor.find('.waveform-annotation-editor__content').exists()).toBe(true)
    const textarea = editor.get('textarea[aria-label="标注文本"]')
    const textareaContextMenu = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
    })
    expect(textarea.element.dispatchEvent(textareaContextMenu)).toBe(true)
    expect(textareaContextMenu.defaultPrevented).toBe(false)
    await textarea.setValue('左键标注')
    await editor.get('.waveform-modal__button--primary').trigger('click')
    await flushVueChartUpdates()

    // Annotation snaps to nearest sample point (x=1, y=5)
    expect(wrapper.emitted('update:annotations')?.at(-1)?.[0]).toMatchObject([
      { seriesId: 'series-0', x: 1, y: 5 },
    ])
    await wrapper.setProps({
      annotations: [{ id: 'left-click', seriesId: 'series-0', x: 1, y: 5, text: '左键标注' }],
    })
    await flushVueChartUpdates()
    expect(wrapper.find('.waveform-annotation__vertical-line').exists()).toBe(false)
    expect(wrapper.find('.waveform-annotation__anchor').exists()).toBe(false)
    expect(wrapper.get('.waveform-annotation__arrow').attributes('x2')).not.toBe(
      String(overlayWidth / 2),
    )
  })

  it('limits modal channel options to the graph frame under the pointer', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'channel-a',
            name: '通道 A',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
            },
          },
          {
            id: 'channel-b',
            name: '通道 B',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 10 },
                { x: 1, y: 11 },
              ],
            },
          },
        ],
      },
      { displayMode: 'separated', interactionMode: 'annotation' },
    )
    const overlays = wrapper.findAll('.waveform-chart__overlay--shared')
    expect(overlays.length).toBeGreaterThan(0)
    Object.defineProperty(overlays[0].element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 712, height: 290 }),
    })

    overlays[0].element.dispatchEvent(
      new MouseEvent('click', { clientX: 356, clientY: 30, bubbles: true }),
    )
    await flushVueChartUpdates()
    expect(
      getAnnotationEditor()
        .get('select[aria-label="选择标注波形"]')
        .findAll('option')
        .map((item) => item.text()),
    ).toEqual(['通道 A'])

    await getAnnotationEditor().get('.waveform-modal__close').trigger('click')
    overlays[0].element.dispatchEvent(
      new MouseEvent('click', { clientX: 356, clientY: 230, bubbles: true }),
    )
    await flushVueChartUpdates()
    expect(
      getAnnotationEditor()
        .get('select[aria-label="选择标注波形"]')
        .findAll('option')
        .map((item) => item.text()),
    ).toEqual(['通道 B'])
  })

  it('intelligently chooses placement to avoid clipping at boundaries', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { annotations: [{ id: 'top-edge', seriesId: 'series-0', x: 0.5, y: 5, text: '顶部标注' }] },
    )

    // Smart placement chooses 'bottom' when annotation is near top boundary
    expect(wrapper.get('.waveform-annotation').attributes('data-placement')).toBe('bottom')
    expect(wrapper.get('.waveform-annotation__arrow').attributes('x1')).toBe(
      wrapper.get('.waveform-annotation__arrow').attributes('x2'),
    )
  })
})
