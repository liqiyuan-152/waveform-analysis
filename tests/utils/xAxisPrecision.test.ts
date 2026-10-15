import { describe, expect, it } from 'vitest'
import { formatAxisTime, formatXAxisLabel } from '@/utils/formatters'

describe('adaptive X labels', () => {
  it('removes conversion and viewport noise before rounding endpoints outward', () => {
    expect(formatXAxisLabel(1.001, [1.001, 1.003], 'ms', 'start')).toBe('1001')
    expect(formatXAxisLabel(1.6999999999999997, [1.6999999999999997, 1.9], 's', 'start')).toBe(
      '1.7',
    )
    expect(formatXAxisLabel(-62.88152000000001, [-62.88152000000001, 15], 'ms', 'start')).toBe(
      '-62881.52',
    )
    expect(formatXAxisLabel(1.7000000000000002, [1, 1.7000000000000002], 's', 'end')).toBe('1.7')
  })
  it('rounds endpoints while preserving adaptive interior tick precision', () => {
    const domain: [number, number] = [1.175356, 1.175358]
    expect(formatXAxisLabel(domain[0], domain, 'ms', 'start')).toBe('1175.356')
    expect(formatXAxisLabel(1.1753565, domain, 'ms', 'tick')).toBe('1175.3565')
    expect(formatXAxisLabel(domain[1], domain, 'ms', 'end')).toBe('1175.358')
    const close: [number, number] = [1, 1 + Number.EPSILON]
    expect(formatXAxisLabel(close[0], close, 's', 'start')).not.toBe(
      formatXAxisLabel(close[1], close, 's', 'end'),
    )
    expect(formatAxisTime(1e-120, 's')).toBe('1e-120')
    expect(formatAxisTime(1e21, 's')).toBe('1e+21')
    expect(formatAxisTime(Infinity, 's')).toBe('Infinity')
  })
  it.each([
    { domain: [0, 4], labels: ['0', '4'] },
    { domain: [2.76, 4.76], labels: ['2.76', '4.76'] },
    { domain: [0.98, 1.02], labels: ['0.98', '1.02'] },
    { domain: [-0.02, 0.02], labels: ['-0.02', '0.02'] },
    { domain: [0.123456789, 0.203456789], labels: ['0.1234', '0.2035'] },
    { domain: [0.000000001, 0.000000002], labels: ['0', '0.0001'] },
  ])('formats $domain without long decimal tails', ({ domain, labels }) => {
    const original = [...domain]
    expect(
      domain.map((value, index) =>
        formatXAxisLabel(value, domain as [number, number], 's', index === 0 ? 'start' : 'end'),
      ),
    ).toEqual(labels)
    expect(domain).toEqual(original)
  })

  it('rounds tiny windows with a large offset and keeps custom formatters', () => {
    const domain: [number, number] = [1234.000000001, 1234.000000002]
    const start = formatXAxisLabel(domain[0], domain, 's', 'start')
    const end = formatXAxisLabel(domain[1], domain, 's', 'end')
    expect(start).toBe('1234')
    expect(end).toBe('1234.0001')
    expect(formatXAxisLabel(domain[0], domain, 's', 'start', () => 'custom')).toBe('custom')
    expect(formatXAxisLabel(-0, [-0, 1], 's', 'start')).toBe('0')
    expect(formatXAxisLabel(0.30000000000000004, [0, 1], 's', 'tick')).toBe('0.3')
    expect(formatAxisTime(1e-9, 's')).toBe('0.000000001')
    expect(formatXAxisLabel(1e-9, [0, 1], 's', 'tick')).toBe('0.000000001')
  })

  it.each([
    [1.23444, '1.2344', '1.2345'],
    [1.23445, '1.2344', '1.2345'],
    [-1.23445, '-1.2345', '-1.2344'],
    [9.99995, '9.9999', '10'],
    [1.23, '1.23', '1.23'],
    [1.0001, '1.0001', '1.0001'],
    [-0.00001, '-0.0001', '0'],
    [1e-120, '0', '0.0001'],
    [-1e-120, '-0.0001', '0'],
    [1e21, '1000000000000000000000', '1000000000000000000000'],
    [Infinity, 'Infinity', 'Infinity'],
    [NaN, 'NaN', 'NaN'],
  ] as const)('rounds %s outward to %s and %s', (value, start, end) => {
    expect(formatXAxisLabel(value, [0, 10], 's', 'start')).toBe(start)
    expect(formatXAxisLabel(value, [0, 10], 's', 'end')).toBe(end)
  })

  it('rounds after unit conversion and passes full precision to custom formatters', () => {
    const value = 1.23456789
    const domain: [number, number] = [value, 2]
    expect(formatXAxisLabel(value, domain, 'ms', 'start')).toBe('1234.5678')
    expect(formatXAxisLabel(value, domain, 'ms', 'end')).toBe('1234.5679')
    expect(formatXAxisLabel(value, domain, 's', 'end', String)).toBe(String(value))
    expect(domain).toEqual([value, 2])
  })
})
