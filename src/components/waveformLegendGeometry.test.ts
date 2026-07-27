import { describe, expect, it } from 'vitest'
import {
  waveformLegendErrorBarPath,
  waveformLegendLinePath,
  waveformLineDasharray,
} from './rendering/seriesStyle'
describe('legend series geometry', () => {
  it('keeps line samples centered and clamps error-bar caps to the swatch', () => {
    expect(waveformLegendLinePath('linear')).toBe('M1 8H25')
    expect(waveformLegendLinePath('step-start')).toBe('M1 8H25')
    expect(waveformLegendLinePath('step-middle')).toBe('M1 8H25')
    expect(waveformLegendLinePath('step-end')).toBe('M1 8H25')
    expect(waveformLegendLinePath('step-after')).toBe('M1 8H25')
    expect(waveformLegendLinePath('none')).toBeNull()
    expect(waveformLegendErrorBarPath(10)).toBe('M8 2H18M13 2V14M8 14H18')
    expect(waveformLegendErrorBarPath(100)).toBe('M1 2H25M13 2V14M1 14H25')
    expect(waveformLineDasharray('solid')).toBeUndefined()
    expect(waveformLineDasharray('dashed')).toBe('8 5')
    expect(waveformLineDasharray('dash-dot')).toBe('8 5 1.5 5')
  })
})
