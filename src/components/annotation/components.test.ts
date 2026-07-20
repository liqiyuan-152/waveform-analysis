import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ColorPicker } from 'vue3-colorpicker'

import WaveformAnnotationContextMenu from './WaveformAnnotationContextMenu.vue'
import WaveformAnnotationEditor from './WaveformAnnotationEditor.vue'
import WaveformAnnotationLayer from './WaveformAnnotationLayer.vue'
import WaveformAnnotationToolbar from './WaveformAnnotationToolbar.vue'

describe('waveform annotation controls', () => {
  it('allows changing the annotation series inside the editor', async () => {
    const wrapper = mount(WaveformAnnotationEditor, {
      props: {
        annotation: { id: 'note', seriesId: 'a', x: 1, y: 2, text: '说明' },
        mode: 'edit',
        series: { id: 'a', name: '通道 A', color: '#f00', unit: 'V' },
        seriesOptions: [
          {
            trackIndex: 0,
            seriesId: 'a',
            name: '通道 A',
            color: '#f00',
            unit: 'V',
            point: { x: 1, y: 2 },
            screenX: 100,
            screenY: 50,
            distance: 0,
            xValue: 1,
          },
          {
            trackIndex: 1,
            seriesId: 'b',
            name: '通道 B',
            color: '#00f',
            unit: 'A',
            point: { x: 1, y: 3 },
            screenX: 100,
            screenY: 60,
            distance: 10,
            xValue: 1,
          },
        ],
      },
    })
    await flushPromises()

    expect(
      (wrapper.get('select[aria-label="选择标注波形"]').element as HTMLSelectElement).value,
    ).toBe('a')
    await wrapper.get('select[aria-label="选择标注波形"]').setValue('b')
    expect(wrapper.emitted('series-change')).toEqual([['b']])
    expect(wrapper.get('.waveform-annotation-editor__series').text()).toContain('通道 A')
  })

  it('emits controlled toolbar changes', async () => {
    const wrapper = mount(WaveformAnnotationToolbar, {
      props: { interactionMode: 'zoom', annotationsVisible: true },
    })

    await wrapper.get('button[aria-label="添加标注"]').trigger('click')
    await wrapper.get('button[aria-label="隐藏标注"]').trigger('click')

    expect(wrapper.emitted('update:interaction-mode')).toEqual([['annotation']])
    expect(wrapper.emitted('update:annotations-visible')).toEqual([[false]])
  })

  it('validates text and emits an immutable edited annotation with style defaults', async () => {
    const annotation = { id: 'note', seriesId: 'a', x: 1, y: 2, text: '' }
    const wrapper = mount(WaveformAnnotationEditor, {
      props: { annotation, mode: 'add' },
    })
    await flushPromises()

    expect(wrapper.get('textarea').attributes('maxlength')).toBe('40')
    expect(wrapper.get('.waveform-annotation-editor__coordinates').text()).toContain(
      'X (ms)1000.000',
    )
    expect(wrapper.get('.waveform-annotation-editor__coordinates').text()).toContain('Y2')
    expect(wrapper.get('button.is-primary').attributes('disabled')).toBeDefined()
    await vi.waitFor(() => expect(wrapper.findAllComponents(ColorPicker)).toHaveLength(3), {
      timeout: 5000,
    })
    const colorPickers = wrapper.findAllComponents(ColorPicker)
    expect(wrapper.findAll('.waveform-annotation-editor__color-field')).toHaveLength(3)
    expect(colorPickers.map((picker) => picker.props('pureColor'))).toEqual([
      '#1677ff',
      '#333333',
      'rgba(255, 255, 255, 0.92)',
    ])
    colorPickers.forEach((picker) => {
      expect(picker.props()).toMatchObject({
        useType: 'pure',
        pickerType: 'chrome',
        format: 'rgb',
        disableAlpha: false,
        blurClose: true,
      })
    })

    await wrapper.get('textarea').setValue('新标注')
    colorPickers[0].vm.$emit('update:pureColor', 'rgba(22, 119, 255, 0.7)')
    colorPickers[1].vm.$emit('update:pureColor', 'rgba(51, 51, 51, 0.8)')
    colorPickers[2].vm.$emit('update:pureColor', 'rgba(255, 255, 255, 0.5)')
    await wrapper.vm.$nextTick()
    await wrapper.get('button.is-primary').trigger('click')

    const emitted = wrapper.emitted('confirm')?.[0]?.[0] as
      | {
          text: string
          style?: { borderColor?: string; textColor?: string; backgroundColor?: string }
        }
      | undefined
    expect(emitted).toMatchObject({
      text: '新标注',
      style: {
        borderColor: 'rgba(22, 119, 255, 0.7)',
        textColor: 'rgba(51, 51, 51, 0.8)',
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
      },
    })
    expect(annotation.text).toBe('')
  })

  it('formats annotation coordinates using the selected display context', () => {
    const wrapper = mount(WaveformAnnotationEditor, {
      props: {
        annotation: { id: 'note', seriesId: 'series', x: 1, y: 0.0000001, text: '说明' },
        mode: 'edit',
        timeUnit: 's',
      },
    })

    const coordinates = wrapper.get('.waveform-annotation-editor__coordinates').text()
    expect(coordinates).toContain('X (s)1.000')
    expect(coordinates).toContain('Y0.0000001')
    expect(coordinates).not.toContain('e-')
  })

  it('hydrates hexadecimal and rgba annotation colors', async () => {
    const wrapper = mount(WaveformAnnotationEditor, {
      props: {
        annotation: {
          id: 'colored-note',
          seriesId: 'a',
          x: 1,
          y: 2,
          text: '已有标注',
          style: {
            borderColor: '#ff0000',
            textColor: 'rgba(0, 0, 0, 0.75)',
            backgroundColor: 'rgba(255, 255, 255, 0.4)',
          },
        },
        mode: 'edit',
      },
    })
    await flushPromises()
    await vi.waitFor(() => expect(wrapper.findAllComponents(ColorPicker)).toHaveLength(3), {
      timeout: 5000,
    })

    expect(
      wrapper.findAllComponents(ColorPicker).map((picker) => picker.props('pureColor')),
    ).toEqual(['#ff0000', 'rgba(0, 0, 0, 0.75)', 'rgba(255, 255, 255, 0.4)'])
  })

  it('supports modal dismissal and live character counting', async () => {
    const editor = mount(WaveformAnnotationEditor, {
      props: {
        annotation: { id: 'note', seriesId: 'a', x: 1, y: 2, text: '原文字' },
        mode: 'edit',
      },
    })

    expect(editor.get('[role="dialog"]').attributes('aria-modal')).toBe('true')
    expect(editor.get('h2').text()).toBe('编辑标注')
    await editor.get('textarea').setValue('三字说明')
    expect(editor.get('.waveform-annotation-editor__label-row').text()).toContain('4/40')

    await editor.get('textarea').trigger('keydown', { key: 'Escape' })
    await editor.get('.waveform-annotation-editor').trigger('click')
    expect(editor.emitted('cancel')).toHaveLength(2)
  })

  it('supports cancellation and context menu actions', async () => {
    const editor = mount(WaveformAnnotationEditor, {
      props: {
        annotation: { id: 'note', seriesId: 'a', x: 1, y: 2, text: '原文字' },
        mode: 'edit',
      },
    })
    await editor.findAll('button')[0].trigger('click')
    expect(editor.emitted('cancel')).toHaveLength(1)

    const menu = mount(WaveformAnnotationContextMenu, {
      props: { visible: true, x: 10, y: 20, canEdit: true },
    })
    await menu.findAll('button')[0].trigger('click')
    await menu.findAll('button')[1].trigger('click')
    expect(menu.emitted('edit')).toHaveLength(1)
    expect(menu.emitted('delete')).toHaveLength(1)
  })

  it('centers single-line and multiline annotation text inside its box', () => {
    const wrapper = mount(WaveformAnnotationLayer, {
      props: {
        visible: true,
        annotations: [
          {
            annotation: { id: 'centered', seriesId: 'a', x: 1, y: 2, text: '第一行\n第二行' },
            trackIndex: 0,
            anchorX: 80,
            anchorY: 80,
            placement: 'top',
            lines: ['第一行', '第二行'],
            box: { x: 20, y: 20, width: 80, height: 42, lineEndX: 60, lineEndY: 62 },
            style: {
              borderColor: '#1677ff',
              textColor: '#333333',
              backgroundColor: '#ffffff',
            },
          },
        ],
      },
    })

    const text = wrapper.get('.waveform-annotation__text')
    expect(text.attributes('text-anchor')).toBe('middle')
    expect(text.attributes('dominant-baseline')).toBe('central')
    expect(text.attributes('x')).toBe('60')
    expect(text.attributes('y')).toBe('33')
    expect(wrapper.findAll('tspan').map((line) => line.attributes('x'))).toEqual(['60', '60'])
  })
})
