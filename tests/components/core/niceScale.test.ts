import { describe, expect, it } from 'vitest'
import { calculateNiceScale, resolveYAxisTicksECharts } from '@/components/core/niceScale'

describe('niceScale', () => {
  describe('calculateNiceScale', () => {
    it('应该为简单范围生成 1/2/5 系列的刻度间隔', () => {
      const result = calculateNiceScale(0, 100, 5)
      expect(result.tickSpacing).toBe(20) // 1 * 20 = 20 (1/2/5 系列)
      expect(result.niceMin).toBe(0)
      expect(result.niceMax).toBe(100)
      expect(result.ticks).toEqual([0, 20, 40, 60, 80, 100])
    })

    it('应该为小数范围生成适当的刻度', () => {
      const result = calculateNiceScale(0.81, 12.3, 4)
      expect(result.niceMin).toBe(0)
      expect(result.niceMax).toBe(15)
      expect(result.tickSpacing).toBe(5) // 5 是 1/2/5 系列
      expect(result.ticks).toEqual([0, 5, 10, 15])
    })

    it('应该处理负数范围', () => {
      const result = calculateNiceScale(-50, 50, 5)
      expect(result.niceMin).toBeLessThanOrEqual(-50)
      expect(result.niceMax).toBeGreaterThanOrEqual(50)
      expect(result.ticks).toContain(0) // 应该包含零点
    })

    it('应该为 105 到 543 的范围生成合理刻度', () => {
      const result = calculateNiceScale(105, 543, 5)
      expect(result.niceMin).toBe(100)
      expect(result.niceMax).toBe(600)
      expect(result.tickSpacing).toBe(100) // 1 * 100
      expect(result.ticks).toEqual([100, 200, 300, 400, 500, 600])
    })

    it('应该为 2.04 到 2.16 的小范围生成精确刻度', () => {
      const result = calculateNiceScale(2.04, 2.16, 5)
      expect(result.niceMin).toBe(2.0)
      expect(result.niceMax).toBe(2.2)
      expect(result.tickSpacing).toBeCloseTo(0.05, 10)
      expect(result.ticks.length).toBeGreaterThan(0)
      // 验证首尾刻度
      expect(result.ticks[0]).toBeCloseTo(2.0, 10)
      expect(result.ticks[result.ticks.length - 1]).toBeCloseTo(2.2, 10)
    })

    it('应该处理 min === max 的情况', () => {
      const result = calculateNiceScale(100, 100, 5)
      expect(result.ticks.length).toBeGreaterThan(1)
      expect(result.ticks).toContain(100)
      expect(result.niceMin).toBeLessThan(100)
      expect(result.niceMax).toBeGreaterThan(100)
    })

    it('应该处理 min === max === 0 的情况', () => {
      const result = calculateNiceScale(0, 0, 5)
      expect(result.ticks.length).toBeGreaterThan(1)
      expect(result.ticks).toContain(0)
    })

    it('应该处理反向范围 (min > max)', () => {
      const result = calculateNiceScale(100, 0, 5)
      expect(result.niceMin).toBe(0)
      expect(result.niceMax).toBe(100)
      expect(result.ticks[0]).toBeLessThan(result.ticks[result.ticks.length - 1])
    })

    it('应该处理非有限值', () => {
      const result = calculateNiceScale(NaN, 100, 5)
      expect(result.ticks.length).toBeGreaterThan(0)
      expect(result.ticks.every(Number.isFinite)).toBe(true)
    })

    it('应该处理 Infinity', () => {
      const result = calculateNiceScale(-Infinity, Infinity, 5)
      expect(result.ticks.length).toBeGreaterThan(0)
      expect(result.ticks.every(Number.isFinite)).toBe(true)
    })

    it('应该生成包含边界的刻度', () => {
      const result = calculateNiceScale(10, 90, 5)
      expect(result.niceMin).toBeLessThanOrEqual(10)
      expect(result.niceMax).toBeGreaterThanOrEqual(90)
      expect(result.ticks[0]).toBe(result.niceMin)
      expect(result.ticks[result.ticks.length - 1]).toBe(result.niceMax)
    })

    it('应该根据 maxTicks 调整刻度密度', () => {
      const result3 = calculateNiceScale(0, 100, 3)
      const result10 = calculateNiceScale(0, 100, 10)

      expect(result3.ticks.length).toBeLessThan(result10.ticks.length)
      expect(result3.tickSpacing).toBeGreaterThan(result10.tickSpacing)
    })

    it('应该处理非常小的范围', () => {
      const result = calculateNiceScale(0.0001, 0.0002, 5)
      expect(result.ticks.length).toBeGreaterThan(0)
      expect(result.niceMin).toBeLessThanOrEqual(0.0001)
      expect(result.niceMax).toBeGreaterThanOrEqual(0.0002)
    })

    it('应该处理非常大的范围', () => {
      const result = calculateNiceScale(0, 1e6, 5)
      expect(result.ticks.length).toBeGreaterThan(0)
      expect(result.niceMin).toBeLessThanOrEqual(0)
      expect(result.niceMax).toBeGreaterThanOrEqual(1e6)
      // 验证刻度间隔是 1/2/5 系列
      const spacing = result.tickSpacing
      const magnitude = Math.pow(10, Math.floor(Math.log10(spacing)))
      const normalized = spacing / magnitude
      expect([1, 2, 5, 10]).toContain(normalized)
    })

    it('应该生成对称的负数范围刻度', () => {
      const result = calculateNiceScale(-100, 0, 5)
      expect(result.niceMin).toBeLessThanOrEqual(-100)
      expect(result.niceMax).toBe(0)
      expect(result.ticks[result.ticks.length - 1]).toBe(0)
    })

    it('应该防止刻度过多的情况', () => {
      // 极端情况：非常小的间隔可能导致过多刻度
      const result = calculateNiceScale(0, 0.000001, 5)
      expect(result.ticks.length).toBeLessThan(100)
    })
  })

  describe('resolveYAxisTicksECharts', () => {
    it('应该返回与 resolveYAxisTicks 兼容的格式', () => {
      const result = resolveYAxisTicksECharts([0, 100], 5)
      expect(result).toHaveProperty('domain')
      expect(result).toHaveProperty('values')
      expect(Array.isArray(result.domain)).toBe(true)
      expect(Array.isArray(result.values)).toBe(true)
      expect(result.domain.length).toBe(2)
    })

    it('应该扩展定义域以包含所有刻度', () => {
      const result = resolveYAxisTicksECharts([10, 90], 5)
      expect(result.domain[0]).toBeLessThanOrEqual(10)
      expect(result.domain[1]).toBeGreaterThanOrEqual(90)
      expect(result.values[0]).toBe(result.domain[0])
      expect(result.values[result.values.length - 1]).toBe(result.domain[1])
    })

    it('应该处理默认 tickCount', () => {
      const result = resolveYAxisTicksECharts([0, 100])
      expect(result.values.length).toBeGreaterThan(2)
      expect(result.values.length).toBeLessThanOrEqual(7) // 通常 5 个左右
    })

    it('应该与 ECharts 行为一致：优先使用 1/2/5 间隔', () => {
      const testCases = [
        { domain: [0, 100] as [number, number], expected: [0, 20, 40, 60, 80, 100] },
        { domain: [0, 50] as [number, number], expected: [0, 10, 20, 30, 40, 50] },
        { domain: [0, 10] as [number, number], expected: [0, 2, 4, 6, 8, 10] },
      ]

      testCases.forEach(({ domain, expected }) => {
        const result = resolveYAxisTicksECharts(domain, 5)
        expect(result.values).toEqual(expected)
      })
    })
  })

  describe('ECharts 兼容性验证', () => {
    it('示例 1: 数据范围 0.81 到 12.3', () => {
      // ECharts 会生成 [0, 5, 10, 15]
      const result = calculateNiceScale(0.81, 12.3, 4)
      expect(result.ticks).toEqual([0, 5, 10, 15])
    })

    it('示例 2: 数据范围 105 到 543', () => {
      // ECharts 会生成 [100, 200, 300, 400, 500, 600]
      const result = calculateNiceScale(105, 543, 5)
      expect(result.ticks).toEqual([100, 200, 300, 400, 500, 600])
    })

    it('示例 3: 数据范围 2.04 到 2.16', () => {
      // ECharts 会生成 [2.0, 2.05, 2.10, 2.15, 2.20]
      const result = calculateNiceScale(2.04, 2.16, 5)
      expect(result.niceMin).toBe(2.0)
      expect(result.niceMax).toBe(2.2)
      expect(result.tickSpacing).toBeCloseTo(0.05, 10)
    })

    it('示例 4: 负数范围 -50 到 150', () => {
      const result = calculateNiceScale(-50, 150, 5)
      expect(result.tickSpacing).toBe(50) // 5 * 10
      expect(result.ticks).toContain(0)
      expect(result.ticks).toContain(50)
      expect(result.ticks).toContain(100)
    })

    it('刻度间隔应该总是 1/2/5 系列', () => {
      const testRanges: Array<[number, number]> = [
        [0, 37],
        [123, 456],
        [0.003, 0.027],
        [-789, -123],
        [1e-6, 1e-5],
        [1e6, 1e7],
      ]

      testRanges.forEach(([min, max]) => {
        const result = calculateNiceScale(min, max, 5)
        const spacing = result.tickSpacing

        // 提取幅度和归一化值
        const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(spacing))))
        const normalized = Math.abs(spacing) / magnitude

        // 归一化值应该接近 1, 2, 5 或 10
        const validValues = [1, 2, 5, 10]
        const closestValid = validValues.reduce((prev, curr) =>
          Math.abs(curr - normalized) < Math.abs(prev - normalized) ? curr : prev,
        )

        expect(normalized).toBeCloseTo(closestValid, 1)
      })
    })
  })
})
