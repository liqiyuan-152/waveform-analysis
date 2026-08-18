import { flushPromises, mount } from '@vue/test-utils'
import { InputNumber } from 'ant-design-vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ColorPicker } from 'vue3-colorpicker'
import { defineComponent, h } from 'vue'

import WaveformAnnotationContextMenu from './WaveformAnnotationContextMenu.vue'
import WaveformAnnotationEditor from './WaveformAnnotationEditor.vue'
import WaveformAnnotationLayer from './WaveformAnnotationLayer.vue'

const modalStub = defineComponent({
  props: [
    'visible',
    'width',
    'maskClosable',
    'keyboard',
    'wrapClassName',
    'cancelText',
    'okText',
    'okButtonProps',
    'rootClassName',
  ],
  emits: ['cancel', 'ok'],
  setup(props, { emit, slots }) {
    return () => {
      const title = slots.title?.() ?? []
      const titleId = (title[0]?.props as { id?: string } | undefined)?.id
      return h('div', { class: ['ant-modal-root', props.rootClassName] }, [
        h(
          'div',
          {
            class: ['ant-modal-wrap', props.wrapClassName],
            role: 'dialog',
            'aria-modal': 'true',
            'aria-labelledby': titleId,
            onClick: (event: MouseEvent) => {
              if (event.target === event.currentTarget && props.maskClosable) emit('cancel')
            },
          },
          [
            h('div', { class: 'ant-modal' }, [
              h('div', { class: 'ant-modal-header' }, [
                h('div', { class: 'ant-modal-title' }, title),
              ]),
              h('button', { class: 'ant-modal-close', onClick: () => emit('cancel') }, '×'),
              slots.default?.(),
              h('div', { class: 'ant-modal-footer' }, [
                h('button', { class: 'ant-btn', onClick: () => emit('cancel') }, props.cancelText),
                h(
                  'button',
                  {
                    class: 'ant-btn ant-btn-primary',
                    disabled: props.okButtonProps?.disabled,
                    onClick: () => emit('ok'),
                  },
                  props.okText,
                ),
              ]),
            ]),
          ],
        ),
      ])
    }
  },
})
const mountEditor = (options: { props: Record<string, unknown> }) =>
  mount(WaveformAnnotationEditor, {
    props: options.props as never,
    global: { stubs: { Modal: modalStub, AModal: modalStub } },
  })

describe('waveform annotation controls', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })
  it('keeps dialog title ids unique across editor instances', () => {
    const first = mountEditor({
      props: {
        annotation: { id: 'first', seriesId: 'a', x: 1, y: 2, text: '说明' },
        mode: 'edit',
      },
    })
    const second = mountEditor({
      props: {
        annotation: { id: 'second', seriesId: 'a', x: 1, y: 2, text: '说明' },
        mode: 'edit',
      },
    })

    const firstTitleId = first.get('.ant-modal-title [id]').attributes('id')
    const secondTitleId = second.get('.ant-modal-title [id]').attributes('id')

    expect(firstTitleId).toBeTruthy()
    expect(secondTitleId).toBeTruthy()
    expect(firstTitleId).not.toBe(secondTitleId)
    expect(first.get('[role="dialog"]').attributes('aria-labelledby')).toBe(firstTitleId)
    expect(second.get('[role="dialog"]').attributes('aria-labelledby')).toBe(secondTitleId)
  })

  it('uses a dedicated root class to isolate teleported modal styles', () => {
    const wrapper = mountEditor({
      props: {
        annotation: { id: 'isolated', seriesId: 'a', x: 1, y: 2, text: '说明' },
        mode: 'add',
      },
    })

    expect(wrapper.get('.ant-modal-root').classes()).toContain('waveform-annotation-editor-root')
    expect(wrapper.get('.ant-modal-wrap').classes()).toContain('waveform-annotation-editor')
  })

  it.each(['add', 'edit'] as const)('shows the X-axis snapping hint in %s mode', (mode) => {
    const wrapper = mountEditor({
      props: {
        annotation: { id: `hint-${mode}`, seriesId: 'a', x: 1, y: 2, text: '说明' },
        mode,
      },
    })

    expect(wrapper.get('[role="note"]').text()).toBe('修改 X 轴后失焦时会自动吸附最近的采样点')
  })

  it('allows changing the annotation series inside the editor', async () => {
    const wrapper = mountEditor({
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

  it('validates text and emits an immutable edited annotation with style defaults', async () => {
    const annotation = { id: 'note', seriesId: 'a', x: 1, y: 2, text: '' }
    const wrapper = mountEditor({
      props: { annotation, mode: 'add' },
    })
    await flushPromises()

    expect(wrapper.get('textarea').attributes('maxlength')).toBe('40')
    expect(wrapper.get('.waveform-annotation-editor__coordinates').text()).toContain('X1000.000')
    expect(wrapper.get('.waveform-annotation-editor__coordinates').text()).toContain('Y2')
    expect(wrapper.get('button.ant-btn-primary').attributes('disabled')).toBeDefined()
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
    await wrapper.get('button.ant-btn-primary').trigger('click')

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
    const wrapper = mountEditor({
      props: {
        annotation: { id: 'note', seriesId: 'series', x: 1, y: 0.0000001, text: '说明' },
        mode: 'edit',
        timeUnit: 's',
      },
    })

    const coordinates = wrapper.get('.waveform-annotation-editor__coordinates').text()
    expect(coordinates).toContain('X1.000')
    expect(coordinates).toContain('Y0.0000001')
    expect(coordinates).not.toContain('e-')
  })

  it('emits valid manual time input and disables save for invalid input', async () => {
    const wrapper = mountEditor({
      props: {
        annotation: { id: 'note', seriesId: 'series', x: 1, y: 2, text: '说明' },
        mode: 'edit',
        timeUnit: 'ms',
      },
    })
    const input = wrapper.getComponent(InputNumber)
    expect(input.props('controls')).toBe(true)
    await input.vm.$emit('update:value', 1500)
    expect(wrapper.emitted('time-change')).toBeUndefined()
    await input.vm.$emit('blur')
    expect(wrapper.emitted('time-change')).toEqual([['1500']])
    await input.vm.$emit('update:value', null)
    await input.vm.$emit('blur')
    expect(wrapper.get('[role="alert"]').text()).toBe('请输入有效的时间')
    expect(wrapper.get('button.ant-btn-primary').attributes('disabled')).toBeDefined()
  })

  it('shows time validation errors and blocks confirmation', async () => {
    const wrapper = mountEditor({
      props: {
        annotation: { id: 'note', seriesId: 'series', x: 1, y: 2, text: '说明' },
        mode: 'edit',
        timeError: '时间超出当前波形范围',
      },
    })

    const input = wrapper.getComponent(InputNumber)
    await input.vm.$emit('blur')
    expect(
      wrapper.get('.waveform-annotation-editor__coordinate-input').attributes('aria-invalid'),
    ).toBe('true')
    expect(wrapper.get('[role="alert"]').text()).toBe('时间超出当前波形范围')
    expect(wrapper.get('button.ant-btn-primary').attributes('disabled')).toBeDefined()
    await wrapper.setProps({ timeError: '' })
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('hydrates hexadecimal and rgba annotation colors', async () => {
    const wrapper = mountEditor({
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
    const editor = mountEditor({
      props: {
        annotation: { id: 'note', seriesId: 'a', x: 1, y: 2, text: '原文字' },
        mode: 'edit',
      },
    })

    expect(editor.get('[role="dialog"]').attributes('aria-modal')).toBe('true')
    expect(editor.get('.ant-modal-title').text()).toBe('编辑标注')
    await editor.get('textarea').setValue('三字说明')
    expect(editor.get('.waveform-annotation-editor__label-row').text()).toContain('4/40')

    await editor.get('textarea').trigger('keydown', { key: 'Escape' })
    await editor.get('.ant-modal-wrap').trigger('click')
    expect(editor.emitted('cancel')).toHaveLength(2)
  })

  it('supports cancellation and context menu actions', async () => {
    const editor = mountEditor({
      props: {
        annotation: { id: 'note', seriesId: 'a', x: 1, y: 2, text: '原文字' },
        mode: 'edit',
      },
    })
    await editor.get('.ant-modal-close').trigger('click')
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
