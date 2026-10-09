import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('Y-axis text width', () => {
  it('measures the actual bold axis font and rounds up', async () => {
    vi.resetModules()
    const context = { font: '', measureText: vi.fn(() => ({ width: 32.4 })) }
    vi.stubGlobal('CanvasRenderingContext2D', class {})
    vi.spyOn(document, 'createElement').mockReturnValue({
      getContext: () => context,
    } as unknown as HTMLCanvasElement)
    const { measureYAxisTextWidth } = await import('@/components/core/yAxisTextWidth')
    expect(measureYAxisTextWidth('0.8485')).toBe(33)
    expect(context.font).toBe('700 11px sans-serif')
    expect(context.measureText).toHaveBeenCalledWith('0.8485')
  })

  it('handles environments without canvas with narrower decimal glyphs', async () => {
    vi.resetModules()
    vi.stubGlobal('CanvasRenderingContext2D', undefined)
    const { measureYAxisTextWidth } = await import('@/components/core/yAxisTextWidth')
    expect(measureYAxisTextWidth('0.8485')).toBe(35)
    expect(measureYAxisTextWidth('E+04')).toBe(27)
  })
})
