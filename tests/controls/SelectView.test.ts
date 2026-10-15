import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SelectView } from '@/controls/SelectView'
import { PopupController } from '@/controls/PopupController'
import { mockControlGeometry } from '../support/controlGeometry'

const cleanups: Array<() => void> = []
beforeEach(mockControlGeometry)
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup())
  vi.restoreAllMocks()
})
function setup() {
  const changed = vi.fn()
  const view = new SelectView(document, '选择波形', changed)
  document.body.append(view.root)
  cleanups.push(() => view.dispose())
  view.update(
    [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta', disabled: true },
      { value: 'c', label: 'Charlie' },
    ],
    'a',
  )
  return { view, changed }
}
function key(view: SelectView, key: string) {
  view.trigger.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

describe('native select', () => {
  it('flips a tall color popup when the lower space exceeds 300px but cannot fit it', () => {
    const { view } = setup()
    const top = window.innerHeight - 350
    vi.spyOn(view.trigger, 'getBoundingClientRect').mockReturnValue({
      x: 40,
      y: top,
      left: 40,
      top,
      right: 160,
      bottom: top + 32,
      width: 120,
      height: 32,
    } as DOMRect)
    const popup = new PopupController(view.trigger, 'waveform-color-popup', 258)
    cleanups.push(() => popup.dispose())
    Object.defineProperty(popup.panel, 'scrollHeight', { value: 371 })
    vi.spyOn(popup.panel, 'getBoundingClientRect').mockReturnValue({ height: 371 } as DOMRect)
    popup.open()
    expect(popup.panel.style.top).toBe(`${top - 371 - 12}px`)
    expect(popup.panel.style.maxHeight).toBe(`${top - 12}px`)
  })

  it('navigates enabled options and confirms once without propagating chart shortcuts', () => {
    const { view, changed } = setup()
    view.trigger.focus()
    const bubbled = vi.fn()
    view.root.addEventListener('keydown', bubbled)
    key(view, 'ArrowDown')
    key(view, 'ArrowDown')
    expect(view.trigger.getAttribute('aria-expanded')).toBe('true')
    key(view, 'Enter')
    expect(changed).toHaveBeenCalledExactlyOnceWith('c')
    expect(bubbled).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(view.trigger)
    expect(view.trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('supports endpoints, typing, Tab, disabled choices and placeholders', () => {
    const { view, changed } = setup()
    view.trigger.click()
    document.querySelectorAll<HTMLElement>('[role="option"]')[1].click()
    expect(changed).not.toHaveBeenCalled()
    key(view, 'End')
    key(view, 'Home')
    key(view, 'c')
    key(view, 'Enter')
    expect(changed).toHaveBeenLastCalledWith('c')
    key(view, ' ')
    key(view, 'Tab')
    expect(document.querySelector('[role="listbox"]')).toBeNull()
    view.update([], 'missing', true, '暂无波形')
    expect(view.trigger.textContent).toContain('暂无波形')
    expect(view.trigger.disabled).toBe(true)
  })

  it('opens at the current value, wraps enabled items, and confirms Tab without losing focus', () => {
    const { view, changed } = setup()
    view.trigger.focus()
    key(view, 'ArrowUp')
    expect(document.querySelector('[role="option"].is-active')?.textContent).toBe('Alpha')
    key(view, 'ArrowUp')
    expect(document.querySelector('[role="option"].is-active')?.textContent).toBe('Charlie')
    key(view, 'ArrowDown')
    key(view, 'ArrowDown')
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    view.trigger.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(true)
    expect(changed).toHaveBeenCalledExactlyOnceWith('c')
    expect(document.activeElement).toBe(view.trigger)
    const next = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    view.trigger.dispatchEvent(next)
    expect(next.defaultPrevented).toBe(false)
  })

  it('handles empty/disabled options, composition and compact menus without stale choices', () => {
    const { view, changed } = setup()
    view.trigger.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', isComposing: true }),
    )
    expect(view.trigger.getAttribute('aria-expanded')).toBe('false')
    view.update([], '')
    key(view, 'ArrowDown')
    expect(document.querySelector('[role="listbox"]')).toBeNull()
    view.update([{ value: 'x', label: 'Unavailable', disabled: true }], 'x')
    view.trigger.click()
    key(view, 'ArrowDown')
    key(view, 'Enter')
    expect(document.querySelector('[role="listbox"]')).toBeNull()
    key(view, 'Tab')
    expect(changed).not.toHaveBeenCalled()
    const compact = new SelectView(document, '格式', vi.fn(), 'compact')
    cleanups.push(() => compact.dispose())
    document.body.append(compact.root)
    compact.update([{ value: 'hex', label: 'HEX' }], 'hex')
    compact.trigger.click()
    expect(document.querySelector('.waveform-select__popup--compact')).not.toBeNull()
    expect(compact.root.classList.contains('waveform-select--compact')).toBe(true)
  })

  it('retains trigger identity, updates option labels and closes on outside or Escape', () => {
    const { view } = setup()
    const trigger = view.trigger
    trigger.click()
    view.update([{ value: 'c', label: 'Charlie renamed' }], 'c')
    expect(view.trigger).toBe(trigger)
    expect(trigger.title).toBe('Charlie renamed')
    expect(document.querySelector('[role="option"]')!.textContent).toBe('Charlie renamed')
    key(view, 'Escape')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    trigger.click()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(document.querySelector('[role="listbox"]')).toBeNull()
    trigger.click()
    view.dispose()
    view.dispose()
    trigger.click()
    key(view, 'Enter')
    expect(document.querySelector('.waveform-popup')).toBeNull()
  })

  it('clamps to the viewport and closes when its trigger is hidden', async () => {
    const { view } = setup()
    vi.spyOn(view.trigger, 'getBoundingClientRect').mockReturnValue({
      left: 1000,
      right: 1100,
      top: 740,
      bottom: 772,
      width: 100,
      height: 32,
    } as DOMRect)
    view.trigger.click()
    const panel = document.querySelector<HTMLElement>('.waveform-popup')!
    expect(
      Number.parseFloat(panel.style.left) + Number.parseFloat(panel.style.width),
    ).toBeLessThanOrEqual(window.innerWidth - 8)
    expect(Number.parseFloat(panel.style.top)).toBeLessThan(740)
    view.root.hidden = true
    await Promise.resolve()
    expect(document.querySelector('.waveform-popup')).toBeNull()
  })

  it('dismisses nested popups first and closes siblings without affecting another document', () => {
    const { view } = setup()
    const trigger = document.createElement('button')
    view.root.append(trigger)
    Object.defineProperty(trigger, 'getClientRects', { value: () => [{}] })
    const popup = new PopupController(trigger, 'test')
    cleanups.push(() => popup.dispose())
    popup.open()
    const inner = new SelectView(document, '格式', vi.fn())
    cleanups.push(() => inner.dispose())
    popup.panel.append(inner.root)
    inner.update([{ value: 'hex', label: 'HEX' }], 'hex')
    inner.trigger.click()
    expect(document.querySelectorAll('.waveform-popup')).toHaveLength(2)
    expect(PopupController.dismissWithin(view.root)).toBe(true)
    expect(popup.isOpen).toBe(true)
    expect(PopupController.dismissWithin(view.root)).toBe(true)
    expect(popup.isOpen).toBe(false)
    expect(PopupController.dismissWithin(view.root)).toBe(false)
  })
})
