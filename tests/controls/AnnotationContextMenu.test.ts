import { afterEach, describe, expect, it, vi } from 'vitest'
import { AnnotationContextMenu } from '@/annotation/AnnotationContextMenu'

const cleanup: Array<() => void> = []
afterEach(() => {
  cleanup.splice(0).forEach((dispose) => dispose())
  document.body.replaceChildren()
  vi.restoreAllMocks()
})
function setup() {
  const host = document.createElement('div'),
    trigger = document.createElement('button')
  document.body.append(trigger, host)
  trigger.focus()
  const menu = new AnnotationContextMenu(host)
  cleanup.push(() => menu.close())
  const edit = vi.fn(),
    remove = vi.fn()
  menu.open(10, 20, edit, remove)
  const buttons = [...host.querySelectorAll<HTMLButtonElement>('button')]
  return { menu, host, trigger, buttons, edit, remove }
}
function key(node: HTMLElement, key: string) {
  node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

describe('instance-owned annotation menu', () => {
  it('never reopens after disposal and clears a detached action button', () => {
    const { menu, buttons, host, edit, remove } = setup()
    menu.dispose()
    menu.dispose()
    buttons[0].click()
    menu.open(0, 0, edit, remove)
    expect(host.childElementCount).toBe(0)
    expect(edit).not.toHaveBeenCalled()
  })

  it('uses roving focus for arrows/Home/End and restores the trigger on Escape', () => {
    const { buttons, trigger, host } = setup()
    expect(document.activeElement).toBe(buttons[0])
    key(buttons[0], 'ArrowDown')
    expect(document.activeElement).toBe(buttons[1])
    key(buttons[1], 'End')
    expect(document.activeElement).toBe(buttons[2])
    key(buttons[2], 'ArrowDown')
    expect(document.activeElement).toBe(buttons[0])
    key(buttons[0], 'ArrowUp')
    expect(document.activeElement).toBe(buttons[2])
    key(buttons[2], 'Home')
    expect(document.activeElement).toBe(buttons[0])
    key(buttons[0], 'Escape')
    expect(host.querySelector('[role="menu"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('clears handlers on close so detached buttons cannot invoke old actions', () => {
    const { menu, buttons, edit, remove } = setup()
    menu.close()
    buttons[0].click()
    buttons[1].click()
    expect(edit).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
  })

  it('closes before an action so a dialog captures the surviving trigger and reentrant menus survive', () => {
    const { menu, host, trigger, buttons } = setup()
    const edit = vi.fn(() => {
      expect(document.activeElement).toBe(trigger)
      menu.open(
        30,
        40,
        () => {},
        () => {},
      )
    })
    menu.open(10, 20, edit, () => {})
    const action = host.querySelector<HTMLButtonElement>('button')!
    action.click()
    expect(edit).toHaveBeenCalledOnce()
    expect(host.querySelector<HTMLElement>('[role="menu"]')!.style.left).toBe('30px')
    action.click()
    buttons[0].click()
    expect(edit).toHaveBeenCalledOnce()
  })

  it('dismisses on outside pointer input and restores focus only when owned', () => {
    const { menu, host, trigger, buttons } = setup()
    const outside = document.createElement('button')
    document.body.append(outside)
    outside.focus()
    menu.close()
    expect(document.activeElement).toBe(outside)
    trigger.focus()
    menu.open(
      0,
      0,
      () => {},
      () => {},
    )
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(host.querySelector('[role="menu"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    key(buttons[0], 'Escape')
    expect(document.activeElement).toBe(trigger)
  })

  it('releases owner-document listeners after Tab dismissal', () => {
    const add = vi.spyOn(document, 'addEventListener'),
      remove = vi.spyOn(document, 'removeEventListener')
    const { buttons, host } = setup()
    key(buttons[0], 'Tab')
    expect(host.childElementCount).toBe(0)
    for (const [name, callback, capture] of add.mock.calls.filter(([name]) =>
      ['pointerdown', 'click'].includes(name),
    ))
      expect(remove).toHaveBeenCalledWith(name, callback, capture)
  })
})
