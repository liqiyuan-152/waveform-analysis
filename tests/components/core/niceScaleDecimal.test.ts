import { describe, expect, it } from 'vitest'
import { calculateNiceScale } from '@/components/core/niceScale'

describe('niceScale 小数场景验证', () => {
  describe('典型小数范围', () => {
    it('毫伏级别 [0.123, 0.456] 应该生成间隔 0.1', () => {
      const result = calculateNiceScale(0.123, 0.456, 5)
      expect(result.tickSpacing).toBe(0.1)
      expect(result.niceMin).toBe(0.1)
      expect(result.niceMax).toBe(0.5)
      expect(result.ticks).toEqual([0.1, 0.2, 0.3, 0.4, 0.5])
    })

    it('ECharts 官方示例 [2.04, 2.16] 应该生成间隔 0.05', () => {
      const result = calculateNiceScale(2.04, 2.16, 5)
      expect(result.niceMin).toBe(2.0)
      expect(result.niceMax).toBe(2.2)
      expect(result.tickSpacing).toBeCloseTo(0.05, 10)
      // 验证刻度值
      expect(result.ticks.length).toBe(5)
      expect(result.ticks[0]).toBeCloseTo(2.0, 10)
      expect(result.ticks[1]).toBeCloseTo(2.05, 10)
      expect(result.ticks[2]).toBeCloseTo(2.1, 10)
      expect(result.ticks[3]).toBeCloseTo(2.15, 10)
      expect(result.ticks[4]).toBeCloseTo(2.2, 10)
    })

    it('微伏级别 [0.0001, 0.0009] 应该生成适当的小刻度', () => {
      const result = calculateNiceScale(0.0001, 0.0009, 5)
      expect(result.tickSpacing).toBeCloseTo(0.0002, 10)
      expect(result.niceMin).toBeCloseTo(0.0, 10)
      expect(result.niceMax).toBeCloseTo(0.001, 10)
      // 验证刻度数量
      expect(result.ticks.length).toBeGreaterThanOrEqual(4)
      expect(result.ticks.length).toBeLessThanOrEqual(6)
    })

    it('百分比级别 [0.0025, 0.0875] 应该使用 0.02 间隔', () => {
      const result = calculateNiceScale(0.0025, 0.0875, 5)
      expect(result.tickSpacing).toBe(0.02)
      expect(result.niceMin).toBe(0.0)
      expect(result.niceMax).toBe(0.1)
    })
  })

  describe('负小数和跨零范围', () => {
    it('负小数范围 [-0.75, -0.25] 应该正确处理', () => {
      const result = calculateNiceScale(-0.75, -0.25, 5)
      expect(result.niceMin).toBeLessThanOrEqual(-0.75)
      expect(result.niceMax).toBeGreaterThanOrEqual(-0.25)
      // 验证间隔是 1/2/5 系列
      const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(result.tickSpacing))))
      const normalized = Math.abs(result.tickSpacing) / magnitude
      expect([1, 2, 5, 10]).toContain(normalized)
    })

    it('跨零点小数 [-0.15, 0.35] 应该包含零点', () => {
      const result = calculateNiceScale(-0.15, 0.35, 5)
      expect(result.ticks).toContain(0)
      expect(result.niceMin).toBeLessThanOrEqual(-0.15)
      expect(result.niceMax).toBeGreaterThanOrEqual(0.35)
    })
  })

  describe('极小差异范围', () => {
    it('微小差异 [3.1415, 3.1416] 应该生成合理的刻度', () => {
      const result = calculateNiceScale(3.1415, 3.1416, 5)
      expect(result.niceMin).toBeLessThanOrEqual(3.1415)
      expect(result.niceMax).toBeGreaterThanOrEqual(3.1416)
      expect(result.ticks.length).toBeGreaterThan(2)
      // 验证刻度覆盖原始范围
      const coveredMin = result.ticks.some(t => t <= 3.1415)
      const coveredMax = result.ticks.some(t => t >= 3.1416)
      expect(coveredMin || result.niceMin <= 3.1415).toBe(true)
      expect(coveredMax || result.niceMax >= 3.1416).toBe(true)
    })

    it('亚毫米测量 [0.00123, 0.00987] 应该使用合适的间隔', () => {
      const result = calculateNiceScale(0.00123, 0.00987, 5)
      expect(result.niceMin).toBeLessThanOrEqual(0.00123)
      expect(result.niceMax).toBeGreaterThanOrEqual(0.00987)
      // 验证间隔的量级
      expect(result.tickSpacing).toBeGreaterThan(0)
      expect(result.tickSpacing).toBeLessThan(0.01)
    })
  })

  describe('浮点精度测试', () => {
    it('应该避免 0.1 + 0.2 = 0.30000000000000004 问题', () => {
      const result = calculateNiceScale(0.1, 0.3, 3)
      // 验证刻度值没有过长的小数
      result.ticks.forEach(tick => {
        const str = tick.toString()
        const decimals = str.split('.')[1]
        if (decimals) {
          expect(decimals.length).toBeLessThan(12)
        }
      })
    })

    it('应该为 [0.7, 0.9] 生成干净的刻度', () => {
      const result = calculateNiceScale(0.7, 0.9, 3)
      result.ticks.forEach(tick => {
        // 验证没有浮点精度问题
        const str = tick.toFixed(10)
        expect(str).not.toMatch(/\.9999999\d+/)
        expect(str).not.toMatch(/\.0000000[1-9]\d+/)
      })
    })

    it('百分之一级别 [0.01, 0.09] 应该生成精确刻度', () => {
      const result = calculateNiceScale(0.01, 0.09, 5)
      expect(result.tickSpacing).toBe(0.02)
      expect(result.ticks).toEqual([0.0, 0.02, 0.04, 0.06, 0.08, 0.1])
    })
  })

  describe('实际应用场景', () => {
    it('典型传感器读数 [-0.0234, 0.0567]', () => {
      const result = calculateNiceScale(-0.0234, 0.0567, 5)
      expect(result.ticks).toContain(0)
      expect(result.niceMin).toBeLessThanOrEqual(-0.0234)
      expect(result.niceMax).toBeGreaterThanOrEqual(0.0567)
      // 验证间隔合理
      expect(result.tickSpacing).toBeGreaterThan(0)
      expect(result.tickSpacing).toBeLessThan(0.1)
    })

    it('温度微小变化 [23.456, 23.789]', () => {
      const result = calculateNiceScale(23.456, 23.789, 5)
      expect(result.niceMin).toBeLessThanOrEqual(23.456)
      expect(result.niceMax).toBeGreaterThanOrEqual(23.789)
      // 验证刻度间隔
      const magnitude = Math.pow(10, Math.floor(Math.log10(result.tickSpacing)))
      const normalized = result.tickSpacing / magnitude
      expect([1, 2, 5, 10]).toContain(normalized)
    })

    it('电压波形 [-1.234, 1.567]', () => {
      const result = calculateNiceScale(-1.234, 1.567, 5)
      expect(result.ticks).toContain(0)
      expect(result.tickSpacing).toBeGreaterThan(0)
      // 应该生成类似 [-2, -1, 0, 1, 2] 的刻度
      const allTicksAreClean = result.ticks.every(tick => {
        const str = tick.toString()
        const decimals = str.split('.')[1]
        return !decimals || decimals.length < 5
      })
      expect(allTicksAreClean).toBe(true)
    })
  })

  describe('与 ECharts 兼容性', () => {
    it('所有小数场景都应使用 1/2/5 系列间隔', () => {
      const testRanges: Array<[number, number]> = [
        [0.0001, 0.0009],
        [0.123, 0.456],
        [2.04, 2.16],
        [0.0025, 0.0875],
        [-0.75, -0.25],
        [-0.15, 0.35],
      ]

      testRanges.forEach(([min, max]) => {
        const result = calculateNiceScale(min, max, 5)
        const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(result.tickSpacing))))
        const normalized = Math.abs(result.tickSpacing) / magnitude

        // 归一化值应该接近 1, 2, 5 或 10
        const validValues = [1, 2, 5, 10]
        const closestValid = validValues.reduce((prev, curr) =>
          Math.abs(curr - normalized) < Math.abs(prev - normalized) ? curr : prev,
        )

        expect(Math.abs(normalized - closestValid)).toBeLessThan(0.01)
      })
    })
  })
})
