import {
  InputNumber,
  type ControlTheme,
  type NumberInputOptions,
} from 'waveform-analysis/input-number'
import { Select, type SelectOption } from 'waveform-analysis/select'
import { ColorPicker } from 'waveform-analysis/color-picker'
import { Pagination, type PaginationState } from 'waveform-analysis/pagination'
import { Modal, type ModalOptions } from 'waveform-analysis/modal'
import { Popup } from 'waveform-analysis/popup'

export function mountControls(document: Document, parent: HTMLElement) {
  const theme: ControlTheme = 'auto'
  const numberOptions: NumberInputOptions = { theme, step: 1, min: 0, max: 100 }
  const number = new InputNumber(
    document,
    '数值',
    (value) => number.update(value, false),
    () => {},
    numberOptions,
  )
  number.update('1', false, undefined, { disabled: false, readOnly: false })
  const options: SelectOption[] = [{ value: 'a', label: 'A' }]
  const select = new Select(document, '选项', (value) => select.update(options, value), 'default', {
    theme,
  })
  select.update(options, 'a', false, '请选择')
  const color = new ColorPicker(
    document,
    '颜色',
    '#1677ff',
    () => {
      if (color.valid) void color.value
    },
    { theme },
  )
  const state: PaginationState = { page: 1, pageCount: 20, visible: true, disabled: false }
  const pagination = new Pagination(parent, (page) => pagination.update({ ...state, page }), {
    theme,
  })
  const modalOptions: ModalOptions = { theme, title: '设置', initialFocus: () => number.input }
  const modal = new Modal(document, modalOptions)
  modal.body.append(number.root, select.root, color.root)
  modal.setTitle('Updated')
  modal.open()
  modal.close()
  const button = document.createElement('button')
  parent.append(button)
  const popup = new Popup(button, '', 240, 264, { theme })
  popup.panel.textContent = '内容'
  popup.open()
  popup.close(true)
  return () => {
    for (const control of [number, select, color, pagination, popup, modal]) {
      control.setTheme('dark')
      control.dispose()
    }
  }
}
