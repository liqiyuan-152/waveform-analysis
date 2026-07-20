import { describe, expect, it } from 'vitest'

import {
  formatAnnotationTime,
  formatPlainNumber,
  formatScientificYAxisLabel,
  formatTooltipNumber,
  shouldUseScientificYAxisLabel,
} from './formatters'

describe('waveform number formatters', () => {
  it('uses the reference Y-axis scientific notation boundaries', () => {
    expect(shouldUseScientificYAxisLabel(0)).toBe(false)
    expect(shouldUseScientificYAxisLabel(0.009)).toBe(true)
    expect(shouldUseScientificYAxisLabel(0.01)).toBe(false)
    expect(shouldUseScientificYAxisLabel(99.99)).toBe(false)
    expect(shouldUseScientificYAxisLabel(100)).toBe(true)
  })

  it('shares one exponent and prefixes only the top visible tick', () => {
    const positiveAxis = { axisMin: 0, axisMax: 254, topTickValue: 254 }
    expect(formatScientificYAxisLabel(127, positiveAxis)).toBe('1.27')
    expect(formatScientificYAxisLabel(254, positiveAxis)).toBe('E+02 2.54')

    const tinyAxis = { axisMin: 0, axisMax: 0.0002, topTickValue: 0.0002 }
    expect(formatScientificYAxisLabel(0.0001, tinyAxis)).toBe('1.00')
    expect(formatScientificYAxisLabel(0.0002, tinyAxis)).toBe('E-04 2.00')

    const negativeAxis = { axisMin: -254, axisMax: 0, topTickValue: 0 }
    expect(formatScientificYAxisLabel(-254, negativeAxis)).toBe('-2.54')
    expect(formatScientificYAxisLabel(0, negativeAxis)).toBe('E+02 0.00')
  })

  it('keeps plain axes at two decimals and removes negative zero', () => {
    expect(formatScientificYAxisLabel(99.99, { axisMin: 0, axisMax: 99.99 })).toBe('99.99')
    expect(formatScientificYAxisLabel(0.01, { axisMin: 0, axisMax: 0.01 })).toBe('0.01')
    expect(formatScientificYAxisLabel(-0.001, { axisMin: -1, axisMax: 1 })).toBe('0.00')
    expect(formatScientificYAxisLabel(Number.NaN)).toBe('NaN')
    expect(formatScientificYAxisLabel(Number.POSITIVE_INFINITY)).toBe('Infinity')
  })

  it('formats tooltip and raw values for their display contexts', () => {
    expect(formatTooltipNumber(12345.67891)).toBe('12,345.6789')
    expect(formatTooltipNumber(-0)).toBe('0')
    expect(formatTooltipNumber(Number.POSITIVE_INFINITY)).toBe('Infinity')
    expect(formatPlainNumber(0.0000001)).toBe('0.0000001')
    expect(formatPlainNumber(1e21)).toBe('1000000000000000000000')
    expect(formatPlainNumber(-0)).toBe('0')
  })

  it('formats annotation time in the selected unit without changing source seconds', () => {
    expect(formatAnnotationTime(1, 'ms')).toBe('1000.000')
    expect(formatAnnotationTime(1, 's')).toBe('1.000')
    expect(formatAnnotationTime(-0, 'ms')).toBe('0.000')
    expect(formatAnnotationTime(Number.NaN, 's')).toBe('NaN')
  })
})
