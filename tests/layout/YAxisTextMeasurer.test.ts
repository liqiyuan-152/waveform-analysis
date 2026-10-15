import { describe, expect, it, vi } from 'vitest'
import { YAxisTextMeasurer } from '@/layout/YAxisTextMeasurer'

describe('document-scoped axis measurement', () => {
  it('creates a lazy canvas in each owning window and keeps contexts separate', () => {
    const frames = [document.createElement('iframe'), document.createElement('iframe')]
    frames.forEach((frame) => document.body.append(frame))
    try {
      const owners = frames.map((frame, index) => {
        const owner = frame.contentDocument!
        Object.defineProperty(owner.defaultView, 'CanvasRenderingContext2D', {
          configurable: true,
          value: class {},
        })
        const canvas = owner.createElement('canvas')
        const context = { font: '', measureText: vi.fn(() => ({ width: 20.1 + index * 10 })) }
        Object.defineProperty(canvas, 'getContext', { value: () => context })
        const create = vi.spyOn(owner, 'createElement').mockReturnValue(canvas)
        return { owner, context, create, measurer: new YAxisTextMeasurer(owner) }
      })
      expect(owners.every(({ create }) => create.mock.calls.length === 0)).toBe(true)
      expect(owners[0]!.measurer.measure('123')).toBe(21)
      expect(owners[1]!.measurer.measure('123')).toBe(31)
      expect(owners[0]!.measurer.measure('456')).toBe(21)
      for (const { create, context } of owners) {
        expect(create).toHaveBeenCalledExactlyOnceWith('canvas')
        expect(context.font).toBe('700 11px sans-serif')
      }
    } finally {
      frames.forEach((frame) => frame.remove())
      vi.restoreAllMocks()
    }
  })

  it('uses deterministic conservative numeric widths without a canvas window', () => {
    const owner = document.implementation.createHTMLDocument('no window')
    const create = vi.spyOn(owner, 'createElement')
    const measurer = new YAxisTextMeasurer(owner)
    expect(measurer.measure('12.3')).toBe(22)
    expect(measurer.measure('-1V')).toBe(21)
    expect(create).not.toHaveBeenCalled()
    create.mockRestore()
  })
})
