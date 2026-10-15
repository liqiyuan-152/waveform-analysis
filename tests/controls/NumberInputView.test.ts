import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NumberInputView } from '@/controls/NumberInputView'

let view: NumberInputView
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  view?.dispose()
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.replaceChildren()
})
function setup(documentOwner = document) {
  const changed = vi.fn((value: string) => view.update(value, false))
  const commit = vi.fn()
  view = new NumberInputView(documentOwner, '时间', changed, commit)
  documentOwner.body.append(view.root)
  view.update('1', false)
  const up = view.root.querySelector<HTMLButtonElement>('button')!
  return { changed, commit, up }
}
function key(key: string, init: KeyboardEventInit = {}) {
  view.input.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  )
}
function press(button: HTMLButtonElement, init: PointerEventInit = {}) {
  button.dispatchEvent(
    new PointerEvent('pointerdown', {
      pointerId: 2,
      button: 0,
      bubbles: true,
      cancelable: true,
      ...init,
    }),
  )
}

describe('native InputNumber', () => {
  it('preserves drafts, supports keyboard/Shift, Enter and composition without chart gestures', () => {
    const { changed, commit } = setup()
    const gesture = vi.fn()
    document.body.addEventListener('keydown', gesture, { once: true })
    view.input.value = '1e-'
    view.input.dispatchEvent(new Event('input'))
    expect(view.input.value).toBe('1e-')
    expect(view.input.hasAttribute('aria-valuenow')).toBe(false)
    key('ArrowUp')
    key('ArrowUp', { shiftKey: true })
    key('ArrowDown')
    expect(view.input.value).toBe('0.01')
    view.input.dispatchEvent(new CompositionEvent('compositionstart'))
    key('ArrowUp')
    key('Enter')
    expect(view.input.value).toBe('0.01')
    expect(commit).not.toHaveBeenCalled()
    view.input.dispatchEvent(new CompositionEvent('compositionend'))
    key('Enter', { isComposing: true })
    key('Enter', { ctrlKey: true })
    expect(commit).not.toHaveBeenCalled()
    key('Enter')
    expect(commit).toHaveBeenCalledTimes(1)
    expect(gesture).not.toHaveBeenCalled()
    document.body.removeEventListener('keydown', gesture)
    expect(changed).toHaveBeenCalledTimes(4)
  })

  it('steps immediately, repeats at 600/200ms, and never duplicates the release click', () => {
    const { changed, up } = setup()
    press(up, { shiftKey: true })
    expect(view.input.value).toBe('1.01')
    vi.advanceTimersByTime(599)
    expect(changed).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    vi.advanceTimersByTime(400)
    expect(view.input.value).toBe('1.04')
    document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 99 }))
    vi.advanceTimersByTime(200)
    expect(view.input.value).toBe('1.05')
    document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2 }))
    up.dispatchEvent(new MouseEvent('click', { detail: 1 }))
    vi.advanceTimersByTime(2000)
    expect(changed).toHaveBeenCalledTimes(5)
    expect(document.activeElement).toBe(view.input)
    up.click()
    expect(view.input.value).toBe('1.051')
  })

  it('ignores the zero-detail click synthesized after a touch release', () => {
    const { changed, up } = setup()
    press(up, { pointerType: 'touch' })
    vi.advanceTimersByTime(600)
    document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2, pointerType: 'touch' }))
    up.dispatchEvent(new PointerEvent('click', { pointerType: 'touch', detail: 0 }))
    expect(view.input.value).toBe('1.002')
    expect(changed).toHaveBeenCalledTimes(2)
    up.click()
    expect(view.input.value).toBe('1.003')
  })

  it('cleans the repeat timer immediately when its native dialog closes', async () => {
    const { changed, up } = setup()
    const dialog = document.createElement('dialog')
    dialog.setAttribute('open', '')
    document.body.append(dialog)
    dialog.append(view.root)
    press(up)
    dialog.removeAttribute('open')
    await Promise.resolve()
    // jsdom queues the dialog's own toggle event independently of the repeat timer.
    vi.advanceTimersByTime(0)
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(1000)
    expect(changed).toHaveBeenCalledTimes(1)
  })

  it.each(['leave', 'cancel', 'blur', 'window', 'visibility', 'disabled', 'readonly', 'dispose'])(
    'stops repeating on %s',
    (reason) => {
      const { changed, up } = setup()
      press(up)
      if (reason === 'leave') up.dispatchEvent(new PointerEvent('pointerleave'))
      if (reason === 'cancel')
        document.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 2 }))
      if (reason === 'blur') view.input.blur()
      if (reason === 'window') window.dispatchEvent(new Event('blur'))
      if (reason === 'visibility') document.dispatchEvent(new Event('visibilitychange'))
      if (reason === 'disabled') view.update(view.input.value, false, undefined, { disabled: true })
      if (reason === 'readonly') view.update(view.input.value, false, undefined, { readOnly: true })
      if (reason === 'dispose') view.dispose()
      vi.advanceTimersByTime(2000)
      expect(changed).toHaveBeenCalledTimes(1)
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it.each(['hidden', 'style', 'removed'])('stops when the owner becomes %s', async (reason) => {
    const { changed, up } = setup()
    press(up)
    if (reason === 'hidden') view.root.hidden = true
    if (reason === 'style') document.body.style.display = 'none'
    if (reason === 'removed') view.root.remove()
    await Promise.resolve()
    vi.advanceTimersByTime(2000)
    expect(changed).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    document.body.style.display = ''
  })

  it('keeps disabled/read-only fields inert and cleans callbacks after repeated disposal', () => {
    const { changed, commit, up } = setup()
    for (const state of [{ disabled: true }, { readOnly: true }]) {
      view.update('1', true, 'problem', state)
      expect(up.disabled).toBe(true)
      press(up)
      up.click()
      key('ArrowUp')
      view.input.dispatchEvent(new Event('input'))
      view.input.dispatchEvent(new FocusEvent('blur'))
    }
    expect(changed).not.toHaveBeenCalled()
    expect(commit).not.toHaveBeenCalled()
    expect(view.input.getAttribute('aria-describedby')).toBe('problem')
    view.dispose()
    view.dispose()
    view.update('2', false)
    expect(view.input.value).toBe('1')
    key('ArrowUp')
    up.click()
    expect(changed).not.toHaveBeenCalled()
  })

  it('uses its owner document for focus and pointer cancellation', () => {
    const frame = document.createElement('iframe')
    document.body.append(frame)
    const owner = frame.contentDocument!
    const { changed, up } = setup(owner)
    press(up)
    expect(owner.activeElement).toBe(view.input)
    owner.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 2 }))
    vi.advanceTimersByTime(2000)
    expect(changed).toHaveBeenCalledTimes(1)
    view.dispose()
    frame.remove()
  })
})
