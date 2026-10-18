import { mockControlGeometry } from '../support/controlGeometry'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InputNumber } from '@/input-number'
import { Select } from '@/select'
import { ColorPicker } from '@/color-picker'
import { Pagination } from '@/pagination'
import { Modal } from '@/modal'
import { Popup } from '@/popup'

beforeEach(mockControlGeometry)

const owned: { dispose(): void }[] = []
function own<T extends { dispose(): void }>(value: T): T {
  owned.push(value)
  return value
}
afterEach(() => {
  owned
    .splice(0)
    .reverse()
    .forEach((value) => value.dispose())
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

function modal(options = {}) {
  const value = own(new Modal(document, options))
  value.root.showModal = () => value.root.setAttribute('open', '')
  value.root.close = () => value.root.removeAttribute('open')
  return value
}

describe('public controls', () => {
  it('keeps independent input and select themes and values while changing theme', () => {
    const number = own(new InputNumber(document, 'Number', vi.fn(), vi.fn(), { theme: 'dark' }))
    const select = own(new Select(document, 'Select', vi.fn(), 'default', { theme: 'light' }))
    document.body.append(number.root, select.root)
    number.update('12.', false)
    select.update([{ value: 'a', label: 'A' }], 'a')
    select.trigger.click()
    number.setTheme('auto')
    select.setTheme('dark')
    expect(number.input.value).toBe('12.')
    expect(number.root.dataset.controlTheme).toBe('auto')
    expect(select.trigger.value).toBe('a')
    expect(document.querySelector<HTMLElement>('[role="listbox"]')?.dataset.controlTheme).toBe(
      'dark',
    )
    expect(number.root.querySelector('button')?.getAttribute('aria-label')).toBe('增加数值')
  })

  it('propagates color theme to nested controls and popups without changing the color', () => {
    const color = own(new ColorPicker(document, 'Color', '#12345678', vi.fn(), { theme: 'dark' }))
    document.body.append(color.root)
    color.swatch.click()
    const format = document.querySelector<HTMLButtonElement>('[role="combobox"]')!
    format.click()
    color.setTheme('light')
    expect(color.value).toBe('#12345678')
    for (const node of document.querySelectorAll<HTMLElement>('[data-control-theme]'))
      expect(node.dataset.controlTheme).toBe('light')
    expect(document.querySelector('[role="listbox"]')).not.toBeNull()
  })

  it('clamps pagination state without emitting and emits only enabled navigation requests', () => {
    const changed = vi.fn()
    const page = own(new Pagination(document.body, changed, { theme: 'dark' }))
    page.update({ page: 8, pageCount: 3 })
    expect(changed).not.toHaveBeenCalled()
    expect(page.root.querySelector('[aria-current]')?.textContent).toBe('3')
    page.root.querySelector<HTMLButtonElement>('[aria-label="下一页"]')!.click()
    expect(changed).not.toHaveBeenCalled()
    page.root.querySelector<HTMLButtonElement>('[aria-label="上一页"]')!.click()
    expect(changed).toHaveBeenLastCalledWith(2)
    page.update({ page: 1, pageCount: 20, disabled: true })
    expect([...page.root.querySelectorAll('button')].every((button) => button.disabled)).toBe(true)
    page.update({ page: 1, pageCount: 20 })
    page.root.querySelector<HTMLButtonElement>('[aria-label="向后 5 页"]')!.click()
    expect(changed).toHaveBeenLastCalledWith(6)
    page.update({ page: NaN, pageCount: 0, visible: false })
    expect(page.root.hidden).toBe(true)
    page.update({ page: 1, pageCount: 1 })
    expect(page.root.querySelector('[aria-current]')?.textContent).toBe('1')
    page.dispose()
    page.update({ page: 2, pageCount: 3 })
    expect(page.root.isConnected).toBe(false)
  })

  it('reopens modals, restores focus, and cleans scroll locks on disposal', () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const dialog = modal({ title: 'Test', theme: 'dark' as const })
    dialog.open()
    expect(dialog.root.open).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
    dialog.setTitle('Updated')
    dialog.setTheme('light')
    expect(dialog.root.textContent).toContain('Updated')
    dialog.close()
    expect(dialog.isOpen).toBe(false)
    expect(document.activeElement).toBe(trigger)
    dialog.open()
    dialog.dispose()
    expect(document.body.style.overflow).toBe('')
    expect(dialog.root.isConnected).toBe(false)
    dialog.open()
    expect(dialog.isOpen).toBe(false)
  })

  it('allows consumer cancellation to be rejected more than once', () => {
    const cancel = vi.fn()
    const dialog = modal({ cancel })
    dialog.open()
    dialog.root.querySelector<HTMLButtonElement>('.waveform-modal__close')!.click()
    dialog.root.dispatchEvent(new Event('cancel', { cancelable: true }))
    expect(cancel).toHaveBeenCalledTimes(2)
    expect(dialog.root.open).toBe(true)
  })

  it('dismisses nested popup before the modal and closes standalone popup from its trigger', () => {
    const dialog = modal()
    const trigger = document.createElement('button')
    vi.spyOn(trigger, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
    dialog.body.append(trigger)
    const popup = own(new Popup(trigger, '', 200, 240, { theme: 'dark' }))
    dialog.open()
    popup.open()
    expect(popup.panel.closest('dialog')).toBe(dialog.root)
    trigger.focus()
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(popup.isOpen).toBe(false)
    expect(dialog.isOpen).toBe(true)
    popup.open()
    dialog.dispose()
    expect(popup.isOpen).toBe(false)
    document.body.append(trigger)
    popup.setTheme('light')
    popup.open()
    expect(popup.panel.dataset.controlTheme).toBe('light')
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(popup.isOpen).toBe(false)
  })
})
