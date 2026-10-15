import { afterEach, describe, expect, it, vi } from 'vitest'
import { ModalController } from '@/controls/ModalController'

const cleanup: (() => void)[] = []
afterEach(() => {
  cleanup
    .splice(0)
    .reverse()
    .forEach((dispose) => dispose())
  document.body.replaceChildren()
  document.body.style.cssText = ''
  vi.restoreAllMocks()
})

function open(
  document = window.document,
  options: { initialFocus?: HTMLElement; dismissPopup?: () => boolean } = {},
) {
  const dialog = document.createElement('dialog')
  if (!dialog.showModal) {
    dialog.showModal = () => dialog.setAttribute('open', '')
    dialog.close = () => dialog.removeAttribute('open')
  }
  dialog.tabIndex = -1
  const first = document.createElement('input'),
    second = document.createElement('input')
  dialog.append(first, second)
  document.body.append(dialog)
  const cancel = vi.fn(() => modal.dispose())
  const modal = new ModalController(dialog, {
    initialFocus: () => options.initialFocus ?? first,
    cancel,
    dismissPopup: options.dismissPopup,
  })
  cleanup.push(() => {
    modal.dispose()
    dialog.remove()
  })
  modal.open()
  return { modal, dialog, first, second, cancel }
}

describe('document-owned modal controller', () => {
  it('returns focus to the editor when popup dismissal removes its focused field', () => {
    const popup = document.createElement('input')
    const modal = open(document, {
      dismissPopup: () => {
        popup.remove()
        return true
      },
    })
    modal.dialog.append(popup)
    popup.focus()
    popup.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(modal.first)
    expect(modal.dialog.open).toBe(true)
    expect(modal.cancel).not.toHaveBeenCalled()
  })

  it('restores the exact lower-modal field after closing the top', () => {
    const first = open()
    first.second.focus()
    const second = open()
    second.modal.dispose()
    expect(document.activeElement).toBe(first.second)
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('preserves overflow longhands, priorities and unrelated host changes through out-of-order removal', () => {
    document.body.style.cssText =
      'overflow-x: hidden !important; overflow-y: scroll !important; padding-right: 7px !important; color: red'
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const first = open(),
      second = open()
    first.modal.dispose()
    first.dialog.remove()
    document.body.style.color = 'blue'
    expect(document.body.style.overflow).toBe('hidden')
    second.modal.dispose()
    expect(document.activeElement).toBe(trigger)
    expect(document.body.style.overflowX).toBe('hidden')
    expect(document.body.style.overflowY).toBe('scroll')
    expect(document.body.style.getPropertyPriority('overflow-x')).toBe('important')
    expect(document.body.style.getPropertyPriority('overflow-y')).toBe('important')
    expect(document.body.style.paddingRight).toBe('7px')
    expect(document.body.style.getPropertyPriority('padding-right')).toBe('important')
    expect(document.body.style.color).toBe('blue')
  })

  it('compensates scrollbar width once and restores the original padding priority', () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(window.innerWidth - 20)
    document.body.style.setProperty('padding-right', '7px', 'important')
    const first = open()
    expect(document.body.style.paddingRight).toBe('27px')
    const second = open()
    expect(document.body.style.paddingRight).toBe('27px')
    second.modal.dispose()
    first.modal.dispose()
    expect(document.body.style.paddingRight).toBe('7px')
    expect(document.body.style.getPropertyPriority('padding-right')).toBe('important')
  })

  it('dismisses one popup on each Escape/native cancel before closing only the top modal', () => {
    const first = open(),
      popup = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValue(false)
    const second = open(document, { dismissPopup: popup })
    second.first.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    expect(second.cancel).not.toHaveBeenCalled()
    const native = new Event('cancel', { cancelable: true })
    second.dialog.dispatchEvent(native)
    expect(native.defaultPrevented).toBe(true)
    expect(second.cancel).not.toHaveBeenCalled()
    second.first.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    expect(second.cancel).toHaveBeenCalledOnce()
    expect(first.cancel).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(first.first)
    second.dialog.dispatchEvent(new Event('cancel', { cancelable: true }))
    expect(popup).toHaveBeenCalledTimes(3)
  })

  it('uses the dialog as focus fallback when initial focus is outside or disabled', () => {
    const outside = document.createElement('input')
    document.body.append(outside)
    const focus = vi.spyOn(outside, 'focus').mockImplementation(() => {})
    const first = open(document, { initialFocus: outside })
    expect(focus).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(first.dialog)
    first.modal.dispose()
    outside.disabled = true
    const second = open(document, { initialFocus: outside })
    expect(document.activeElement).toBe(second.dialog)
  })

  it('falls back to the surviving modal if the previously focused field was removed', () => {
    const first = open()
    first.second.focus()
    const second = open()
    first.second.remove()
    second.modal.dispose()
    expect(document.activeElement).toBe(first.first)
  })

  it('redirects programmatic outside focus and removes precisely its document listeners', () => {
    const add = vi.spyOn(document, 'addEventListener'),
      remove = vi.spyOn(document, 'removeEventListener')
    const modal = open()
    const outside = document.createElement('button')
    document.body.append(outside)
    outside.focus()
    expect(document.activeElement).toBe(modal.first)
    modal.modal.dispose()
    for (const [name, callback, capture] of add.mock.calls.filter(([name]) =>
      ['keydown', 'focusin'].includes(name),
    ))
      expect(remove).toHaveBeenCalledWith(name, callback, capture)
    outside.focus()
    expect(document.activeElement).toBe(outside)
  })

  it('does not restore a disconnected trigger or disturb a different document lock', () => {
    const iframe = document.createElement('iframe')
    document.body.append(iframe)
    cleanup.push(() => iframe.remove())
    const owner = iframe.contentDocument!
    const trigger = owner.createElement('button')
    owner.body.append(trigger)
    trigger.focus()
    const outer = open(),
      inner = open(owner)
    trigger.remove()
    inner.modal.dispose()
    expect(document.body.style.overflow).toBe('hidden')
    expect(owner.body.style.overflow).toBe('')
    expect(outer.dialog.open).toBe(true)
  })
})
