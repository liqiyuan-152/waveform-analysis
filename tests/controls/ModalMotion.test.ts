import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ModalMotion } from '@/controls/ModalMotion'

let root: HTMLDialogElement
let panel: HTMLElement
let motion: ModalMotion
let animations: Array<{ onfinish: (() => void) | null; cancel: ReturnType<typeof vi.fn> }>
beforeEach(() => {
  vi.useFakeTimers()
  root = document.createElement('dialog')
  panel = document.createElement('div')
  panel.className = 'waveform-modal__panel'
  root.append(panel)
  document.body.append(root)
  animations = []
  panel.animate = vi.fn(() => {
    const animation = { onfinish: null, cancel: vi.fn() }
    animations.push(animation)
    return animation as unknown as Animation
  })
  motion = new ModalMotion(root)
})
afterEach(() => {
  motion.dispose()
  root.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('native modal motion lifecycle', () => {
  it('settles the entrance before click or keyboard handlers position fixed popups', () => {
    for (const event of ['click', 'keydown']) {
      motion.enter()
      expect(root.dataset.motion).toBe('enter')
      panel.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      expect(animations.at(-1)!.cancel).not.toHaveBeenCalled()
      panel.dispatchEvent(new Event(event, { bubbles: true }))
      expect(animations.at(-1)!.cancel).toHaveBeenCalledOnce()
      expect(root.dataset.motion).toBeUndefined()
    }
  })

  it('removes entrance state when the browser finishes animating', () => {
    motion.enter()
    animations[0].onfinish!()
    expect(root.dataset.motion).toBeUndefined()
  })

  it('blocks duplicate closing, makes fields inert, and calls back only once', () => {
    const action = vi.fn()
    motion.enter()
    motion.close(action)
    motion.close(action)
    expect(motion.busy).toBe(true)
    expect(panel.inert).toBe(true)
    expect(root.getAttribute('aria-busy')).toBe('true')
    panel.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(root.dataset.motion).toBe('leave')
    const finish = animations.at(-1)!.onfinish!
    finish()
    finish()
    vi.advanceTimersByTime(1000)
    expect(action).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    expect(panel.inert).toBe(false)
    expect(motion.busy).toBe(false)
    expect(root.hasAttribute('aria-busy')).toBe(false)
  })

  it('uses a bounded fallback if the browser never delivers animationfinish', () => {
    const action = vi.fn()
    motion.close(action)
    vi.advanceTimersByTime(349)
    expect(action).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(action).toHaveBeenCalledOnce()
  })

  it('cancels animation, fallback and deferred callbacks when disposed twice', () => {
    const action = vi.fn()
    motion.close(action)
    const finish = animations[0].onfinish!
    motion.dispose()
    motion.dispose()
    finish()
    vi.advanceTimersByTime(1000)
    motion.enter()
    motion.close(action)
    expect(action).not.toHaveBeenCalled()
    expect(animations).toHaveLength(1)
    expect(animations[0].cancel).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('honors reduced motion and works without the animation API', () => {
    const action = vi.fn()
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
    motion.enter()
    motion.close(action)
    expect(action).toHaveBeenCalledOnce()
    expect(animations).toHaveLength(0)
    vi.restoreAllMocks()
    Object.defineProperty(panel, 'animate', { value: undefined })
    motion.enter()
    motion.close(action)
    expect(action).toHaveBeenCalledTimes(2)
  })
})
