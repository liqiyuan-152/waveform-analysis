import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { paginationItems } from '@/components/controls/pagination'
import { stepNumberInput } from '@/components/controls/numberInput'
import { mountModal } from '@/components/controls/modalLifecycle'
import WaveformPagination from '@/components/controls/WaveformPagination.vue'
import WaveformNumberInput from '@/components/controls/WaveformNumberInput.vue'

describe('native waveform pagination', () => {
  it.each([
    [1, 0, []],
    [1, 3, [1, 2, 3]],
    [1, 12, [1, 2, 3, 4, 5, 'jump-next', 12]],
    [4, 12, [1, 2, 3, 4, 5, 6, 'jump-next', 12]],
    [6, 12, [1, 'jump-prev', 4, 5, 6, 7, 8, 'jump-next', 12]],
    [9, 12, [1, 'jump-prev', 7, 8, 9, 10, 11, 12]],
    [12, 12, [1, 'jump-prev', 8, 9, 10, 11, 12]],
  ] as const)('keeps the existing page window at %s/%s', (current, total, expected) => {
    expect(
      paginationItems(current, total).map((item) => (item.kind === 'page' ? item.page : item.kind)),
    ).toEqual(expected)
  })
  it('emits bounded navigation and five-page jumps without changing controlled state', async () => {
    const wrapper = mount(WaveformPagination, { props: { current: 1, total: 24, pageSize: 2 } })
    expect(wrapper.get('[aria-label="上一页"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[aria-current="page"]').trigger('click')
    expect(wrapper.emitted('change')).toBeUndefined()
    await wrapper.get('[aria-label="向后 5 页"]').trigger('click')
    expect(wrapper.emitted('change')).toEqual([[6]])
    expect(wrapper.get('[aria-current="page"]').text()).toBe('1')
    await wrapper.setProps({ current: 12 })
    expect(wrapper.get('[aria-label="下一页"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[aria-label="向前 5 页"]').trigger('click')
    expect(wrapper.emitted('change')?.at(-1)).toEqual([7])
    wrapper.unmount()
  })
})

describe('native waveform time input', () => {
  it.each([
    ['0.1', 1, '0.101'],
    ['0.1', -1, '0.099'],
    ['', 1, '0.001'],
    ['invalid', -1, '-0.001'],
    ['-0.001', 1, '0'],
    ['1e309', 1, '0.001'],
  ] as const)('steps %s without decimal artifacts', (value, direction, expected) => {
    expect(stepNumberInput(value, direction)).toBe(expected)
  })
  it('preserves editing strings and handles arrows, buttons and blur', async () => {
    const wrapper = mount(WaveformNumberInput, {
      props: { value: '1000' },
      attrs: { 'aria-label': '时间' },
    })
    const input = wrapper.get('input')
    await input.setValue('1e-')
    expect(wrapper.emitted('update:value')?.at(-1)).toEqual(['1e-'])
    await input.trigger('keydown', { key: 'ArrowUp' })
    expect(wrapper.emitted('update:value')?.at(-1)).toEqual(['1000.001'])
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.emitted('update:value')?.at(-1)).toEqual(['999.999'])
    await wrapper.get('[aria-label="增加时间"]').trigger('click')
    await wrapper.get('[aria-label="减少时间"]').trigger('click')
    await input.trigger('blur')
    expect(wrapper.emitted('blur')).toHaveLength(1)
    await wrapper.setProps({ value: '', invalid: true })
    expect(input.attributes('aria-valuenow')).toBeUndefined()
    expect(wrapper.classes()).toContain('is-invalid')
    wrapper.unmount()
  })
})

describe('modal DOM lifecycle', () => {
  const cleanup: (() => void)[] = []
  afterEach(() => {
    cleanup
      .splice(0)
      .reverse()
      .forEach((dispose) => dispose())
    document.body.innerHTML = ''
    document.body.style.cssText = ''
  })
  function open(options: { dismissPopup?: () => boolean } = {}) {
    const dialog = document.createElement('dialog')
    const input = document.createElement('input')
    dialog.append(input)
    document.body.append(dialog)
    const cancel = vi.fn()
    const dispose = mountModal(dialog, { initialFocus: () => input, cancel, ...options })
    cleanup.push(dispose)
    return { dialog, input, cancel, dispose }
  }
  it('restores focus and exact body styles after nested dialogs, including out-of-order removal', () => {
    document.body.style.overflow = 'scroll'
    document.body.style.paddingRight = '7px'
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const first = open()
    expect(document.activeElement).toBe(first.input)
    const second = open()
    first.dispose()
    first.dialog.remove()
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.activeElement).toBe(second.input)
    second.dispose()
    expect(document.body.style.overflow).toBe('scroll')
    expect(document.body.style.paddingRight).toBe('7px')
    expect(document.activeElement).toBe(trigger)
    second.dispose()
  })
  it('returns to the remaining modal when the top modal closes', () => {
    const first = open()
    const second = open()
    second.dispose()
    expect(document.activeElement).toBe(first.input)
    expect(document.body.style.overflow).toBe('hidden')
  })
  it('dismisses popups before cancelling and cleans event listeners', () => {
    const dismissPopup = vi.fn().mockReturnValueOnce(true).mockReturnValue(false)
    const modal = open({ dismissPopup })
    const escape = () =>
      modal.input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      )
    escape()
    expect(modal.cancel).not.toHaveBeenCalled()
    escape()
    escape()
    expect(modal.cancel).toHaveBeenCalledTimes(1)
    modal.dispose()
    escape()
    expect(modal.cancel).toHaveBeenCalledTimes(1)
  })
  it('ignores lower modal escapes and backdrop drags, and handles native cancel', () => {
    const first = open()
    const second = open()
    first.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(first.cancel).not.toHaveBeenCalled()
    second.input.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    second.dialog.click()
    expect(second.cancel).not.toHaveBeenCalled()
    const event = new Event('cancel', { cancelable: true })
    second.dialog.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(second.cancel).toHaveBeenCalledTimes(1)
  })
  it('cancels a genuine backdrop click', () => {
    const modal = open()
    modal.dialog.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    modal.dialog.click()
    expect(modal.cancel).toHaveBeenCalledTimes(1)
  })
  it('cycles Tab boundaries while excluding disabled and hidden controls', () => {
    const modal = open()
    const last = document.createElement('button')
    const disabled = document.createElement('button')
    disabled.disabled = true
    modal.dialog.append(last, disabled)
    for (const element of [modal.input, last, disabled]) {
      Object.defineProperty(element, 'getClientRects', { value: () => [{}], configurable: true })
    }
    last.focus()
    last.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(modal.input)
    modal.input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(last)
    Object.defineProperty(modal.input, 'getClientRects', { value: () => [], configurable: true })
    last.remove()
    modal.input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(modal.input)
  })
})
