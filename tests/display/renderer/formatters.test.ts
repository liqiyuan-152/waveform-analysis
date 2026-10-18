import { describe, expect, it } from 'vitest'
import {
  formatScientificAxisHeader,
  formatScientificAxisTick,
  resolveScientificExponent,
} from '../../../src/display/renderer/formatters'

describe('Y-axis scientific formatting', () => {
  it('formats independent headers with trimmed units and shared exponents', () => {
    expect(formatScientificAxisHeader([0, 3], ' V ')).toBe('V')
    expect(formatScientificAxisHeader([0, 3], '  ')).toBe('')
    expect(formatScientificAxisHeader([0, 3000], 'V')).toBe('V\u00a0\u00a0E+03')
    expect(formatScientificAxisHeader([0, 3000])).toBe('E+03')
    expect(formatScientificAxisHeader([0, 0.0003], 'V')).toBe('V\u00a0\u00a0E-04')
    expect(formatScientificAxisHeader([-100000, -3000])).toBe('E+05')
    expect(formatScientificAxisHeader([-1000, 0])).toBe('E+03')
  })

  it('rounds to five significant digits and at most four decimal places', () => {
    expect(formatScientificAxisTick(1234.56, [0, 9999])).toBe('1.2346')
    expect(formatScientificAxisTick(12.34567, [0, 999])).toBe('12.346')
    expect(formatScientificAxisTick(0.123456, [0, 1])).toBe('0.1235')
    expect(formatScientificAxisTick(3.1, [0, 5])).toBe('3.1')
    expect(formatScientificAxisTick(-0.00001, [-1, 1])).toBe('0')
  })

  it.each([
    [7.9999, '7.9999'],
    [43.999, '43.999'],
    [1.2, '1.2'],
    [1.236, '1.236'],
    [0, '0'],
    [-0, '0'],
    [-0.0049, '-0.0049'],
    [-0.005, '-0.005'],
    [1.23499, '1.235'],
    [43.9949, '43.995'],
    [-7.9999, '-7.9999'],
  ])('formats %s as %s with reference precision', (value, expected) => {
    expect(formatScientificAxisTick(value, [-100, 100])).toBe(expected)
    expect(formatScientificAxisTick(value * 1000, [-1000, 1000])).toBe(expected)
  })

  it('keeps all tick values numeric in either notation', () => {
    expect(formatScientificAxisTick(3, [0, 3])).toBe('3')
    expect(formatScientificAxisTick(2, [0, 3])).toBe('2')
    expect(formatScientificAxisTick(3000, [0, 3000])).toBe('3')
  })

  it('handles negative and crossing-zero domains with one shared exponent', () => {
    expect(formatScientificAxisTick(-3000, [-100000, -3000])).toBe('-0.03')
    expect(formatScientificAxisTick(3000, [-10000, 3000])).toBe('0.3')
    expect(formatScientificAxisTick(0, [-1000, 0])).toBe('0')
    expect(formatScientificAxisTick(1e120, [0, 1e120])).toBe('1')
  })

  it('preserves non-finite values and rejects non-finite domain magnitudes', () => {
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(formatScientificAxisTick(value, [0, 1])).toBe(String(value))
      expect(resolveScientificExponent(0, value)).toBeNull()
    }
  })

  it('uses scientific notation at the supported magnitude boundaries', () => {
    expect(resolveScientificExponent(0, 0)).toBeNull()
    expect(resolveScientificExponent(0, 0.00999)).toBeNull()
    expect(resolveScientificExponent(0, 0.001001)).toBeNull()
    expect(resolveScientificExponent(0, 0.001)).toBe(-3)
    expect(resolveScientificExponent(-0.001, 0)).toBe(-3)
    expect(resolveScientificExponent(-0.001, 0.001)).toBe(-3)
    expect(resolveScientificExponent(0, 0.000999)).toBe(-4)
    expect(resolveScientificExponent(0, 0.01)).toBeNull()
    expect(resolveScientificExponent(-0.00999, -0.001)).toBeNull()
    expect(resolveScientificExponent(0, 999.999)).toBeNull()
    expect(resolveScientificExponent(0, 1000)).toBe(3)
  })

  it('derives the exponent from the largest absolute endpoint', () => {
    expect(resolveScientificExponent(-100_000, -3000)).toBe(5)
    expect(resolveScientificExponent(-10_000, 3000)).toBe(4)
  })

  it('scales every tick including the domain end', () => {
    const domain: [number, number] = [1000, 3000]
    expect(formatScientificAxisTick(1000, domain)).toBe('1')
    expect(formatScientificAxisTick(2000, domain)).toBe('2')
    expect(formatScientificAxisTick(3000, domain)).toBe('3')
  })

  it('scales small values', () => {
    const domain: [number, number] = [0.0001, 0.0003]
    expect(formatScientificAxisTick(0.0001, domain)).toBe('1')
    expect(formatScientificAxisTick(0.0003, domain)).toBe('3')
  })

  it('omits trailing zeroes and normalizes negative zero', () => {
    expect(formatScientificAxisTick(123.456, [0, 999])).toBe('123.46')
    expect(formatScientificAxisTick(1, [0, 2])).toBe('1')
    expect(formatScientificAxisTick(-0, [-1, 1])).toBe('0')
  })
})
