import { describe, expect, it } from 'vitest'
import { formatAxisTime, formatXAxisLabel } from '@/utils/formatters'

describe('adaptive X labels', () => {
  it('preserves the screenshot range and adjacent representable endpoints', () => {
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
    { domain: [0.123456789, 0.203456789], labels: ['0.123456789', '0.203456789'] },
    { domain: [0.000000001, 0.000000002], labels: ['0.000000001', '0.000000002'] },
  ])('formats $domain without long decimal tails', ({ domain, labels }) => {
    const original = [...domain]
    expect(
      domain.map((value) => formatXAxisLabel(value, domain as [number, number], 's', 'end')),
    ).toEqual(labels)
    expect(domain).toEqual(original)
  })

  it('distinguishes tiny windows with a large offset and keeps custom formatters', () => {
    const domain: [number, number] = [1234.000000001, 1234.000000002]
    const start = formatXAxisLabel(domain[0], domain, 's', 'start')
    const end = formatXAxisLabel(domain[1], domain, 's', 'end')
    expect(start).not.toBe(end)
    expect(Number(start)).toBeCloseTo(domain[0], 10)
    expect(Number(end)).toBeCloseTo(domain[1], 10)
    expect(formatXAxisLabel(domain[0], domain, 's', 'start', () => 'custom')).toBe('custom')
    expect(formatXAxisLabel(-0, [-0, 1], 's', 'start')).toBe('0')
    expect(formatXAxisLabel(0.30000000000000004, [0, 1], 's', 'tick')).toBe('0.3')
    expect(formatAxisTime(1e-9, 's')).toBe('0.000000001')
    expect(formatXAxisLabel(1e-9, [0, 1], 's', 'tick')).toBe('0.000000001')
  })
})
