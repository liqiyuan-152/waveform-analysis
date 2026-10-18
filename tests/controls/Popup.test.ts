import { afterEach, describe, expect, it, vi } from 'vitest'
import { Popup } from '@/popup'
import { placePopup } from '@/controls/popupPlacement'

const owned: Popup[] = []
function create(options: ConstructorParameters<typeof Popup>[4] = {}) {
  const button = document.createElement('button')
  document.body.append(button)
  vi.spyOn(button, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
  vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(new DOMRect(200, 200, 80, 32))
  const popup = new Popup(button, options)
  owned.push(popup)
  return { button, popup }
}
afterEach(() => {
  owned.splice(0).forEach((popup) => popup.dispose())
  document.body.replaceChildren()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Popover interactions', () => {
  it('keeps hover content open while crossing from trigger to card, and cancels pending work on dispose', () => {
    vi.useFakeTimers()
    const { button, popup } = create({ title: 'Title', content: 'Content' })
    button.dispatchEvent(new MouseEvent('mouseenter'))
    vi.advanceTimersByTime(99)
    expect(popup.isOpen).toBe(false)
    vi.advanceTimersByTime(1)
    expect(popup.isOpen).toBe(true)
    expect(popup.panel.parentElement).toBe(document.body)
    button.dispatchEvent(new MouseEvent('mouseleave'))
    popup.panel.dispatchEvent(new MouseEvent('mouseenter'))
    vi.advanceTimersByTime(100)
    expect(popup.isOpen).toBe(true)
    popup.panel.dispatchEvent(new MouseEvent('mouseleave'))
    vi.advanceTimersByTime(100)
    expect(popup.isOpen).toBe(false)
    button.dispatchEvent(new MouseEvent('mouseenter'))
    popup.dispose()
    vi.runAllTimers()
    expect(popup.isOpen).toBe(false)
  })

  it('reports actual changes, dismisses with Escape/outside and preserves content and theme', () => {
    const changed = vi.fn()
    const { button, popup } = create({
      trigger: 'click',
      title: 'Title',
      content: 'Content',
      theme: 'dark',
      onOpenChange: changed,
    })
    button.click()
    popup.open()
    expect(changed.mock.calls).toEqual([[true]])
    expect(popup.panel.dataset.controlTheme).toBe('dark')
    expect(popup.panel.getAttribute('aria-labelledby')).toBe(popup.title.id)
    popup.setTitle('Updated')
    expect(popup.title.textContent).toBe('Updated')
    popup.panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(changed.mock.calls).toEqual([[true], [false]])
    button.click()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(popup.isOpen).toBe(false)
    expect(popup.content.textContent).toBe('Content')
  })

  it('opens on keyboard focus and closes when focus leaves', () => {
    const { button, popup } = create({ trigger: 'focus' })
    button.focus()
    expect(popup.isOpen).toBe(true)
    const other = document.createElement('button')
    document.body.append(other)
    other.focus()
    expect(popup.isOpen).toBe(false)
  })
})

describe('popover placement', () => {
  const viewport = { left: 0, top: 0, width: 360, height: 600 }
  const size = { width: 200, height: 100 }
  it('flips when there is no room above, and shifts centered cards inside the viewport', () => {
    const result = placePopup(new DOMRect(0, 10, 80, 32), size, viewport, 'top', 12, true)
    expect(result.side).toBe('bottom')
    expect(result.x).toBe(8)
    expect(result.y).toBe(54)
    expect(result.arrowX).toBe(32)
  })
  it('preserves edge alignment on flip and honors disabled adjustment', () => {
    const rect = new DOMRect(260, 200, 80, 32)
    expect(placePopup(rect, size, viewport, 'rightTop', 12, true)).toMatchObject({
      placement: 'leftTop',
      x: 48,
      y: 200,
    })
    expect(placePopup(rect, size, viewport, 'rightTop', 12, false)).toMatchObject({
      placement: 'rightTop',
      x: 352,
      y: 200,
    })
  })
})
