import { describe, expect, it } from 'vitest'

import { formatYAxisTickLabel } from '@/components/core/layout'
import { Y_AXIS_OUTER_PADDING, Y_AXIS_TICK_PADDING } from '@/components/core/yAxisConstants'
import { mergeYAxisSpaceBudgets, resolveYAxisSpaceBudget } from '@/components/core/yAxisSpaceBudget'
import { measureYAxisTextWidth } from '@/components/core/yAxisTextWidth'
import { formatScientificAxisLabel } from '@/utils/formatters'

describe('stable Y-axis space budget', () => {
  it.each([undefined, 'V', '  volt-amperes-per-phase  ', '微伏'])(
    'contains actual ordinary and scientific labels for unit %s',
    (unit) => {
      const budget = resolveYAxisSpaceBudget({ unit })
      const domains: [number, number][] = [
        [-999.999, 999.999],
        [-888.88, 999],
        [-88.888, 99],
        [-8.8888, 9],
        [-0.8888, 0.9999],
        [-0.0003, 0.0003],
        [-8.8888e100, 9e100],
        [-8.8888e-100, 9e-100],
        [-8.8888e307, 9e307],
        [-8.8888e-307, 9e-307],
      ]
      for (const domain of domains) {
        for (const value of [domain[0], 0, domain[1]]) {
          for (const side of ['left', 'right'] as const) {
            // A surviving lower tick can receive metadata in compact tracks.
            const label = formatYAxisTickLabel(value, domain, [value], unit, side)
            expect(measureYAxisTextWidth(label), label).toBeLessThanOrEqual(budget.tickWidth)
            const body = label.replace(/^E[+-]\d+\s*|\s*E[+-]\d+$/g, '')
            expect(measureYAxisTextWidth(body), body).toBeLessThanOrEqual(budget.titleTickWidth)
          }
        }
      }
    },
  )

  it('covers five significant digits, four decimals, negative signs and grouped rounding', () => {
    const budget = resolveYAxisSpaceBudget()
    const values = [-999.999, -888.88, -88.888, -8.8888, -0.8888]
    const labels = values.map((value) =>
      formatScientificAxisLabel(value, { axisMin: -999.999, axisMax: 999.999 }),
    )
    expect(labels).toEqual(['-1,000', '-888.88', '-88.888', '-8.8888', '-0.8888'])
    for (const label of labels) {
      expect(measureYAxisTextWidth(label)).toBeLessThanOrEqual(budget.titleTickWidth)
    }
  })

  it('budgets units and scientific exponents as alternative labels', () => {
    const unit = 'volt-amperes-per-phase'
    const budget = resolveYAxisSpaceBudget({ unit, measureTextWidth: (text) => text.length })
    const scientific = formatScientificAxisLabel(-8.8888e100, {
      axisMin: -9e100,
      axisMax: 9e100,
      topTickValue: -8.8888e100,
      unit,
    })
    expect(scientific).toBe('E+100 -8.8888')
    expect(scientific).not.toContain(unit)
    expect(budget.tickWidth).toBe(`(${unit}) -888.88`.length)
    expect(resolveYAxisSpaceBudget({ unit: `  ${unit}  ` })).toEqual(
      resolveYAxisSpaceBudget({ unit }),
    )
    expect(resolveYAxisSpaceBudget({ unit: '   ' })).toEqual(resolveYAxisSpaceBudget())
  })

  it('uses the supplied text measurement for complete labels on either side', () => {
    const measureTextWidth = (text: string) => text.length * 2 + (text.startsWith('E+') ? 5 : 0)
    const budget = resolveYAxisSpaceBudget({ measureTextWidth })
    const label = formatYAxisTickLabel(-8.8888e100, [-9e100, 9e100], [-8.8888e100])
    expect(budget.tickWidth).toBe(measureTextWidth(label))
    expect(budget.tickClearance).toBe(budget.tickWidth + Y_AXIS_TICK_PADDING + Y_AXIS_OUTER_PADDING)
    expect(budget.titleDistance).toBe(budget.titleTickWidth + Y_AXIS_TICK_PADDING + 2 + 10)
    expect(budget.titleTickWidth).toBe(measureTextWidth('-8.8888'))
    expect(budget.clearance).toBe(budget.titleTickWidth + Y_AXIS_TICK_PADDING + 2 + 20 + 6)
    expect(budget.clearance).toBeLessThan(budget.tickClearance + 6 + 20)
  })

  it('reserves larger title fonts without changing the tick budget', () => {
    const normal = resolveYAxisSpaceBudget()
    const larger = resolveYAxisSpaceBudget({ labelTextStyle: { fontSize: 24 } })
    expect(larger.tickWidth).toBe(normal.tickWidth)
    expect(larger.titleWidth).toBe(32)
    expect(larger.titleGap).toBe(2)
    expect(larger.clearance).toBe(normal.clearance)
    expect(larger.titleDistance - normal.titleDistance).toBe(6)
    expect(resolveYAxisSpaceBudget({ labelTextStyle: { fontSize: 48 } }).clearance).toBeGreaterThan(
      larger.clearance,
    )
  })

  it('merges name widths independently when full exponent widths are equal', () => {
    const measureTextWidth = (text: string) => text.length + (text.includes('E') ? 100 : 0)
    const plain = resolveYAxisSpaceBudget({ measureTextWidth })
    const unit = resolveYAxisSpaceBudget({ unit: 'V', measureTextWidth })
    expect(plain.clearance).toBe(unit.clearance)
    expect(unit.titleTickWidth).toBeGreaterThan(plain.titleTickWidth)
    expect(mergeYAxisSpaceBudgets(plain, unit)).toEqual(unit)
    expect(mergeYAxisSpaceBudgets(unit, plain)).toEqual(unit)
  })

  it.each([1, 12, 24, 48])('keeps a fixed 2px numeric gap for font size %s', (fontSize) => {
    for (const unit of [undefined, 'V', 'volt-amperes-per-phase']) {
      const budget = resolveYAxisSpaceBudget({ unit, labelTextStyle: { fontSize } })
      const outerGap = budget.clearance - budget.titleDistance - budget.titleWidth / 2
      const innerGap =
        budget.titleDistance - budget.titleWidth / 2 - budget.titleTickWidth - Y_AXIS_TICK_PADDING
      expect(outerGap).toBeGreaterThanOrEqual(6)
      expect(innerGap).toBe(2)
      expect(budget.clearance).toBeGreaterThanOrEqual(budget.tickClearance)
    }
  })
})
