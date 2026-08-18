import { describe, expect, it } from 'vitest'

import type { WaveformXAxisLabelFormatter, WaveformXAxisLabelFormatterContext } from '../types'
import {
  formatAnnotationTime,
  formatAxisTime,
  formatEndpointTime,
  formatPlainNumber,
  formatScientificAxisExponent,
  formatScientificAxisLabel,
  formatTooltipNumber,
  formatTooltipTime,
  formatXAxisLabel,
  resolveScientificAxisExponent,
  shouldUseScientificAxisLabel,
} from './formatters'

describe('waveform number formatters', () => {
  it('uses the reference Y-axis scientific notation boundaries', () => {
    expect(shouldUseScientificAxisLabel(0)).toBe(false)
    expect(shouldUseScientificAxisLabel(0.000999)).toBe(true)
    expect(shouldUseScientificAxisLabel(0.001)).toBe(false)
    expect(shouldUseScientificAxisLabel(999.999)).toBe(false)
    expect(shouldUseScientificAxisLabel(1000)).toBe(true)
  })

  it('prefixes one shared exponent to the largest visible tick', () => {
    const positiveAxis = { axisMin: 1000, axisMax: 3000 }
    expect(formatScientificAxisLabel(1000, positiveAxis)).toBe('1')
    expect(formatScientificAxisLabel(2000, positiveAxis)).toBe('2')
    expect(formatScientificAxisLabel(3000, positiveAxis)).toBe('E+03 3')
    expect(formatScientificAxisLabel(2000, { ...positiveAxis, topTickValue: 2000 })).toBe('E+03 2')
    expect(formatScientificAxisExponent(1000, 3000)).toBe('E+03')
    expect(formatScientificAxisExponent(0, 1e120)).toBe('E+120')

    const tinyAxis = { axisMin: 0.0001, axisMax: 0.0003 }
    expect(formatScientificAxisLabel(0.0001, tinyAxis)).toBe('1')
    expect(formatScientificAxisLabel(0.0002, tinyAxis)).toBe('2')
    expect(formatScientificAxisLabel(0.0003, tinyAxis)).toBe('E-04 3')
    expect(formatScientificAxisExponent(0.0001, 0.0003)).toBe('E-04')
  })

  it('appends a unit to the top tick with or without scientific notation', () => {
    expect(formatScientificAxisLabel(3000, { axisMin: 1000, axisMax: 3000, unit: 'V' })).toBe(
      'E+03 (V) 3',
    )
    expect(formatScientificAxisLabel(3, { axisMin: 0, axisMax: 3, unit: 'A' })).toBe('(A) 3')
    expect(formatScientificAxisLabel(2, { axisMin: 0, axisMax: 3, unit: 'A' })).toBe('2')
    expect(formatScientificAxisLabel(3, { axisMin: 0, axisMax: 3, unit: '  ' })).toBe('3')
  })

  it('derives the exponent from the largest absolute endpoint', () => {
    expect(resolveScientificAxisExponent(-9000, -1000)).toBe(3)
    expect(resolveScientificAxisExponent(-100_000, -3000)).toBe(5)
    expect(resolveScientificAxisExponent(-10_000, 3000)).toBe(4)
    expect(resolveScientificAxisExponent(-1000, 0)).toBe(3)
    expect(resolveScientificAxisExponent(0, 0)).toBeNull()
  })

  it('keeps five significant digits, removes trailing zeroes, and limits decimals to four', () => {
    expect(formatScientificAxisLabel(123.456, { axisMin: 0, axisMax: 999 })).toBe('123.46')
    expect(formatScientificAxisLabel(1234.56, { axisMin: 0, axisMax: 9999 })).toBe('1.2346')
    expect(formatScientificAxisLabel(3000, { axisMin: 1000, axisMax: 3000 })).toBe('E+03 3')
    expect(formatScientificAxisLabel(-0, { axisMin: -1, axisMax: 1 })).toBe('0')
    expect(formatScientificAxisLabel(Number.NaN)).toBe('NaN')
    expect(formatScientificAxisLabel(Number.POSITIVE_INFINITY)).toBe('Infinity')
    expect(formatScientificAxisExponent(0, 0)).toBeNull()
  })

  it('formats X-axis ticks and endpoints as complete plain values in the display unit', () => {
    const domain: [number, number] = [0, 1]
    expect(formatAxisTime(0.5004, 'ms', domain)).toBe('500.4')
    expect(formatEndpointTime(1, domain, 'ms')).toBe('1000')
    expect(formatAxisTime(0.5, 's', domain)).toBe('0.5')
    expect(formatEndpointTime(1, domain, 's')).toBe('1')

    const tinyDomain: [number, number] = [0, 0.000001]
    expect(formatEndpointTime(0.000001, tinyDomain, 's')).toBe('0.000001')
    expect(formatAxisTime(-0.000001, 's', tinyDomain)).toBe('-0.000001')
    expect(formatAxisTime(-0, 's')).toBe('0')
    expect(formatAxisTime(1e21, 's')).toBe('1000000000000000000000')
    expect(formatAxisTime(Number.POSITIVE_INFINITY, 's')).toBe('Infinity')
  })

  it('passes display values and complete source context to X-axis label formatters', () => {
    const domain: [number, number] = [0.125, 1.875]
    const formatter: WaveformXAxisLabelFormatter = (value, context) =>
      `${context.kind}:${value / 10}`

    expect(formatXAxisLabel(0.5, domain, 'ms', 'tick', formatter)).toBe('tick:50')
    expect(formatXAxisLabel(domain[0], domain, 'ms', 'start', formatter)).toBe('start:12.5')
    expect(formatXAxisLabel(domain[1], domain, 'ms', 'end', formatter)).toBe('end:187.5')

    let receivedContext: WaveformXAxisLabelFormatterContext | undefined
    formatXAxisLabel(0.5, domain, 'ms', 'tick', (value, context) => {
      receivedContext = context
      return String(value)
    })
    expect(receivedContext).toEqual({
      kind: 'tick',
      rawValue: 0.5,
      timeUnit: 'ms',
      domain: [0.125, 1.875],
      displayDomain: [125, 1875],
    })

    expect(() =>
      formatXAxisLabel(0.5, domain, 's', 'tick', () => {
        throw new Error('formatter failed')
      }),
    ).toThrow('formatter failed')
  })

  it('formats tooltip and raw values for their display contexts', () => {
    expect(formatTooltipNumber(12345.67891)).toBe('12,345.6789')
    expect(formatTooltipNumber(-0)).toBe('0')
    expect(formatTooltipNumber(Number.POSITIVE_INFINITY)).toBe('Infinity')
    expect(formatTooltipTime(1.234567, 's')).toBe('1.2346')
    expect(formatTooltipTime(1, 'ms')).toBe('1,000')
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
