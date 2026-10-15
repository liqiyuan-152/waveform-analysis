import { describe, expect, it, vi } from 'vitest'
import { ColorInputView } from '@/controls/ColorInputView'

function input(node: HTMLInputElement, value: string) {
  node.value = value
  node.dispatchEvent(new Event('input'))
}

describe('native exact color control', () => {
  it.each(['#12345600', 'rgba(18, 52, 86, 0)'])(
    'retains the stated hue when increasing zero alpha in %s',
    (value) => {
      const view = new ColorInputView(document, '颜色', value, () => {})
      expect(view.swatch.value).toBe('#123456')
      input(view.alpha, '0.5')
      expect(view.value).toBe('rgba(18, 52, 86, 0.5)')
      view.dispose()
    },
  )

  it('changes alpha without quantizing fractional RGB channels through the native swatch', () => {
    const view = new ColorInputView(document, '颜色', 'rgba(18.25, 52.5, 86.75, 0.2)', () => {})
    input(view.alpha, '0.123456')
    expect(view.value).toBe('rgba(18.25, 52.5, 86.75, 0.123456)')
    view.dispose()
  })

  it.each(['rgba(22, 119, 255, 0.123456)', '#12345678', '#abcd', 'transparent', 'rebeccapurple'])(
    'preserves untouched %s',
    (value) => {
      const changed = vi.fn()
      const view = new ColorInputView(document, '颜色', value, changed)
      expect(view.value).toBe(value)
      expect(view.text.value).toBe(value)
      expect(view.valid).toBe(true)
      expect(changed).not.toHaveBeenCalled()
      view.dispose()
    },
  )

  it('keeps exact alpha and emits no notification after disposal', () => {
    const changed = vi.fn()
    const view = new ColorInputView(document, '颜色', '#123456', changed)
    input(view.alpha, '0.123456')
    expect(view.value).toBe('rgba(18, 52, 86, 0.123456)')
    input(view.swatch, '#fedcba')
    expect(view.value).toBe('rgba(254, 220, 186, 0.123456)')
    input(view.alpha, '0')
    expect(view.value).toBe('rgba(254, 220, 186, 0)')
    expect(view.valid).toBe(true)
    view.dispose()
    view.dispose()
    input(view.alpha, '1')
    expect(changed).toHaveBeenCalledTimes(3)
  })

  it('retains invalid partial text and recovers through valid CSS text', () => {
    const view = new ColorInputView(document, '颜色', 'red', () => {})
    input(view.text, '#')
    expect(view.text.value).toBe('#')
    expect(view.value).toBe('red')
    expect(view.valid).toBe(false)
    input(view.text, 'hsl(120, 100%, 25%)')
    expect(view.value).toBe('hsl(120, 100%, 25%)')
    expect(view.swatch.value).toBe('#008000')
    expect(view.valid).toBe(true)
    input(view.alpha, '-0.01')
    expect(view.valid).toBe(false)
    input(view.alpha, '1')
    expect(view.valid).toBe(true)
    view.dispose()
  })
})
