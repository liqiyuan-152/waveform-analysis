import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ColorInputView } from '@/controls/ColorInputView'
import { fromHsv, toHsv } from '@/controls/colorValue'
import { mockControlGeometry } from '../support/controlGeometry'

let view: ColorInputView
beforeEach(mockControlGeometry)
afterEach(() => {
  view?.dispose()
  vi.restoreAllMocks()
})
function setup(color = 'rgba(18.25, 52.5, 86.75, 0.123456)') {
  const changed = vi.fn()
  view = new ColorInputView(document, '颜色', color, changed)
  document.body.append(view.root)
  view.swatch.click()
  return changed
}
function input(node: HTMLInputElement, value: string) {
  node.value = value
  node.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('native color panel', () => {
  it('steps compact channel and opacity inputs within their current format bounds', () => {
    setup('#ffffff')
    const format = document.querySelector<HTMLButtonElement>('[aria-label="颜色颜色格式"]')!
    const choose = (mode: string) => {
      format.click()
      Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'))
        .find((option) => option.textContent === mode)!
        .click()
    }
    const step = (input: HTMLInputElement, key: string) =>
      input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    choose('RGB')
    const red = document.querySelector<HTMLInputElement>('[aria-label="R通道"]')!
    expect(red.getAttribute('role')).toBe('spinbutton')
    step(red, 'ArrowUp')
    expect(red.value).toBe('255')
    step(red, 'ArrowDown')
    expect(red.value).toBe('254')
    input(red, 'Infinity')
    expect(view.valid).toBe(false)
    input(red, '0')
    step(red, 'ArrowDown')
    expect(red.value).toBe('0')
    choose('HSB')
    const saturation = document.querySelector<HTMLInputElement>('[aria-label="S通道"]')!
    input(saturation, '100')
    step(saturation, 'ArrowUp')
    expect(saturation.value).toBe('100')
    step(view.alpha, 'ArrowDown')
    expect(view.alpha.value).toBe('99')
    expect(view.value).toContain('0.99')
    input(view.alpha, '0')
    step(view.alpha, 'ArrowDown')
    expect(view.alpha.value).toBe('0')
  })

  it('retains input focus while holding a step button inside the color popup', () => {
    vi.useFakeTimers()
    try {
      setup('#123456')
      const down = view.alpha.parentElement!.querySelectorAll('button')[1]
      down.dispatchEvent(
        new PointerEvent('pointerdown', {
          button: 0,
          pointerId: 1,
          bubbles: true,
          cancelable: true,
        }),
      )
      expect(document.activeElement).toBe(view.alpha)
      expect(view.alpha.value).toBe('99')
      vi.advanceTimersByTime(600)
      expect(view.alpha.value).toBe('98')
      view.dispose()
      vi.advanceTimersByTime(1000)
      expect(view.alpha.value).toBe('98')
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps exact source when opening, formatting and closing without editing', () => {
    const changed = setup()
    const format = document.querySelector<HTMLButtonElement>('[aria-label="颜色颜色格式"]')!
    format.click()
    const options = document.querySelectorAll<HTMLElement>('[role="option"]')
    options[2].click()
    expect(document.querySelector('.waveform-color-popup')).not.toBeNull()
    expect(view.value).toBe('rgba(18.25, 52.5, 86.75, 0.123456)')
    expect(changed).not.toHaveBeenCalled()
    expect(document.querySelector<HTMLInputElement>('[aria-label="R通道"]')!.value).toBe('18.25')
  })

  it('keeps a nested format popup open when a pointer moves focus away from alpha', () => {
    setup()
    view.alpha.focus()
    const format = document.querySelector<HTMLButtonElement>('[aria-label="颜色颜色格式"]')!
    format.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, bubbles: true, cancelable: true }),
    )
    format.click()
    expect(document.activeElement).toBe(format)
    expect(document.querySelectorAll('.waveform-popup')).toHaveLength(2)
  })

  it('edits hue, saturation and alpha with keyboard semantics, preserving alpha precision', () => {
    const changed = setup('#12345600')
    input(view.alpha, '12.3456')
    expect(view.value).toBe('rgba(18, 52, 86, 0.123456)')
    const hue = document.querySelector<HTMLInputElement>('[aria-label="颜色色相"]')!
    input(hue, '120')
    expect(view.value).toContain('0.123456')
    const area = document.querySelector<HTMLElement>('[aria-label="颜色饱和度和明度"]')!
    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(area.getAttribute('aria-valuenow')).toBe('100')
    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    expect(area.getAttribute('aria-valuenow')).toBe('0')
    input(view.alphaSlider, '0.5')
    expect(view.value).toContain('0.5')
    expect(changed).toHaveBeenCalledTimes(5)
  })

  it('keeps invalid partial format text and recovers through valid text without stale callbacks', () => {
    const changed = setup()
    const formatted = document.querySelector<HTMLInputElement>('[aria-label="颜色精确值"]')!
    input(formatted, '#')
    expect(formatted.value).toBe('#')
    expect(formatted.getAttribute('aria-invalid')).toBe('true')
    expect(view.valid).toBe(false)
    expect(view.value).toBe('rgba(18.25, 52.5, 86.75, 0.123456)')
    input(formatted, '#1677ff')
    expect(view.value).toBe('#1677ff')
    expect(view.valid).toBe(true)
    view.dispose()
    input(formatted, '#fff')
    expect(changed).toHaveBeenCalledTimes(2)
  })

  it('edits separate RGB and HSB channels and rejects out-of-range values', () => {
    setup('#1677ff')
    const choose = (mode: string) => {
      document.querySelector<HTMLButtonElement>('[aria-label="颜色颜色格式"]')!.click()
      Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'))
        .find((option) => option.textContent?.startsWith(mode))!
        .click()
    }
    choose('RGB')
    const red = document.querySelector<HTMLInputElement>('[aria-label="R通道"]')!
    input(red, '18.25')
    expect(view.value).toBe('rgba(18.25, 119, 255, 1)')
    input(red, '256')
    expect(view.valid).toBe(false)
    expect(view.value).toBe('rgba(18.25, 119, 255, 1)')
    input(red, '255')
    expect(view.valid).toBe(true)
    choose('HSB')
    input(document.querySelector<HTMLInputElement>('[aria-label="H通道"]')!, '120')
    input(document.querySelector<HTMLInputElement>('[aria-label="S通道"]')!, '100')
    input(document.querySelector<HTMLInputElement>('[aria-label="B通道"]')!, '100')
    expect(view.value).toBe('rgb(0, 255, 0)')
  })

  it('does not expand a valid three-digit HEX draft while the user is still typing', () => {
    setup()
    input(view.text, '123')
    expect(view.text.value).toBe('123')
    input(view.text, '123456')
    expect(view.value).toBe('#123456')
    view.text.dispatchEvent(new FocusEvent('blur'))
    expect(view.text.value).toBe('123456')
  })

  it('retains all source alpha digits when changing the palette', () => {
    setup('rgba(18.25, 52.5, 86.75, 0.12345678901234567)')
    input(document.querySelector<HTMLInputElement>('[aria-label="颜色色相"]')!, '120')
    expect(view.value).toContain('0.12345678901234566')
  })

  it('ends the panel at the channel inputs without a color swatch section', () => {
    setup()
    const panel = document.querySelector('.waveform-color-panel')!
    expect(panel.lastElementChild?.className).toBe('waveform-color-panel__format')
    expect(panel.querySelector('.waveform-color-panel__preset-group')).toBeNull()
  })

  it.each([
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [128, 128, 128],
    [18, 52, 86],
    [0, 0, 0],
    [255, 0, 255],
  ])('round trips RGB %j through HSV', (...channels) => {
    expect(fromHsv(...toHsv(channels))).toEqual(channels)
  })
})
