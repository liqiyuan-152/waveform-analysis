import { describe, expect, it } from 'vitest'

import {
  formatAnnotationTime,
  formatAxisTime,
  formatAxisTimeExponent,
  formatEndpointTime,
  formatPlainNumber,
  formatScientificAxisExponent,
  formatScientificAxisLabel,
  formatTooltipNumber,
  shouldUseScientificAxisLabel,
} from './formatters'

describe('waveform number formatters', () => {
  it('uses the reference Y-axis scientific notation boundaries', () => {
    expect(shouldUseScientificAxisLabel(0)).toBe(false)
    expect(shouldUseScientificAxisLabel(0.009)).toBe(true)
    expect(shouldUseScientificAxisLabel(0.01)).toBe(false)
    expect(shouldUseScientificAxisLabel(99.99)).toBe(false)
    expect(shouldUseScientificAxisLabel(100)).toBe(true)
  })

  it('shares one separate exponent across an axis', () => {
    const positiveAxis = { axisMin: 0, axisMax: 254 }
    expect(formatScientificAxisLabel(127, positiveAxis)).toBe('1.27')
    expect(formatScientificAxisLabel(254, positiveAxis)).toBe('2.54')
    expect(formatScientificAxisExponent(0, 254)).toBe('E+02')
    expect(formatScientificAxisExponent(0, 1e120)).toBe('E+120')

    const tinyAxis = { axisMin: 0, axisMax: 0.0002 }
    expect(formatScientificAxisLabel(0.0001, tinyAxis)).toBe('1.00')
    expect(formatScientificAxisLabel(0.0002, tinyAxis)).toBe('2.00')
    expect(formatScientificAxisExponent(0, 0.0002)).toBe('E-04')

    const negativeAxis = { axisMin: -254, axisMax: 0 }
    expect(formatScientificAxisLabel(-254, negativeAxis)).toBe('-2.54')
    expect(formatScientificAxisLabel(0, negativeAxis)).toBe('0.00')
    expect(formatScientificAxisExponent(-254, 0)).toBe('E+02')
  })

  it('keeps plain axes at two decimals and removes negative zero', () => {
    expect(formatScientificAxisLabel(99.99, { axisMin: 0, axisMax: 99.99 })).toBe('99.99')
    expect(formatScientificAxisLabel(0.01, { axisMin: 0, axisMax: 0.01 })).toBe('0.01')
    expect(formatScientificAxisLabel(-0.001, { axisMin: -1, axisMax: 1 })).toBe('0.00')
    expect(formatScientificAxisLabel(Number.NaN)).toBe('NaN')
    expect(formatScientificAxisLabel(Number.POSITIVE_INFINITY)).toBe('Infinity')
    expect(formatScientificAxisExponent(0, 0)).toBeNull()
  })

  it('formats X-axis ticks and endpoints from the selected display unit', () => {
    const domain: [number, number] = [0, 1]
    expect(formatAxisTime(0.5, 'ms', domain)).toBe('0.50')
    expect(formatEndpointTime(1, domain, 'ms')).toBe('1.00')
    expect(formatAxisTimeExponent(domain, 'ms')).toBe('E+03')
    expect(formatAxisTime(0.5, 's', domain)).toBe('0.50')
    expect(formatEndpointTime(1, domain, 's')).toBe('1.00')
    expect(formatAxisTimeExponent(domain, 's')).toBeNull()

    const tinyDomain: [number, number] = [0, 0.000001]
    expect(formatEndpointTime(0.000001, tinyDomain, 's')).toBe('1.00')
    expect(formatAxisTimeExponent(tinyDomain, 's')).toBe('E-06')
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
