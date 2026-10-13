import { describe, expect, it } from 'vitest'
import { formatAxisTime, formatXAxisLabel } from '@/utils/formatters'

describe('adaptive X labels', () => {
  it.each([
    { domain: [0, 4], labels: ['0', '4'] },
    { domain: [2.76, 4.76], labels: ['2.76', '4.76'] },
    { domain: [0.98, 1.02], labels: ['0.98', '1.02'] },
    { domain: [-0.02, 0.02], labels: ['-0.02', '0.02'] },
    { domain: [0.123456789, 0.203456789], labels: ['0.123', '0.203'] },
    { domain: [0.000000001, 0.000000002], labels: ['1e-9', '2e-9'] },
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
    expect(formatAxisTime(1e-9, 's')).toBe('1e-9')
    expect(formatXAxisLabel(1e-9, [0, 1], 's', 'tick')).toBe('1e-9')
  })
})
