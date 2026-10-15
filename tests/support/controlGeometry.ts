import { vi } from 'vitest'

/** jsdom has no layout; opt in for tests exercising visible custom popups. */
export function mockControlGeometry() {
  const original = HTMLElement.prototype.getClientRects
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (!this.matches('.waveform-select__trigger, .waveform-color-input__trigger'))
      return original.call(this)
    return [this.getBoundingClientRect()] as unknown as DOMRectList
  })
}
