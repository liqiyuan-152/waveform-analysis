/**
 * ECharts-compatible Nice Number algorithm for axis tick calculation
 * Based on "Nice Numbers for Graph Labels" from Graphics Gems
 *
 * References:
 * - https://github.com/cenfun/nice-ticks
 * - https://github.com/qianfan-Zhao/nice_number
 * - https://stackoverflow.com/questions/8506881/nice-label-algorithm-for-charts-with-minimum-ticks
 */

/**
 * 将数字转换为"优雅"的数字（1, 2, 5 系列）
 * @param value - 原始值
 * @param round - 是否向上取整
 * @returns 优雅的数字
 */
function niceNumber(value: number, round: boolean): number {
  if (value === 0) return 0

  const exponent = Math.floor(Math.log10(Math.abs(value)))
  const fraction = Math.abs(value) / Math.pow(10, exponent)

  let niceFraction: number
  if (round) {
    // 向上取整到 1, 2, 5, 10
    if (fraction < 1.5) niceFraction = 1
    else if (fraction < 3) niceFraction = 2
    else if (fraction < 7) niceFraction = 5
    else niceFraction = 10
  } else {
    // 向下取整到 1, 2, 5, 10
    if (fraction <= 1) niceFraction = 1
    else if (fraction <= 2) niceFraction = 2
    else if (fraction <= 5) niceFraction = 5
    else niceFraction = 10
  }

  return niceFraction * Math.pow(10, exponent) * Math.sign(value)
}

export interface NiceScaleResult {
  /** 扩展后的最小值 */
  niceMin: number
  /** 扩展后的最大值 */
  niceMax: number
  /** 刻度间隔 */
  tickSpacing: number
  /** 刻度值数组 */
  ticks: number[]
}

/**
 * 计算 ECharts 风格的优雅刻度
 * @param min - 数据最小值
 * @param max - 数据最大值
 * @param maxTicks - 期望的最大刻度数（类似 ECharts 的 splitNumber，默认 5）
 * @returns 刻度计算结果
 */
export function calculateNiceScale(min: number, max: number, maxTicks = 5): NiceScaleResult {
  // 处理边界情况
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { niceMin: 0, niceMax: 1, tickSpacing: 1, ticks: [0, 1] }
  }

  if (min === max) {
    if (min === 0) {
      // 特殊处理零点
      return {
        niceMin: -1,
        niceMax: 1,
        tickSpacing: 0.5,
        ticks: [-1, -0.5, 0, 0.5, 1],
      }
    }
    const value = min
    const spacing = Math.abs(value) * 0.2
    return {
      niceMin: value - spacing,
      niceMax: value + spacing,
      tickSpacing: spacing,
      ticks: [value - spacing, value, value + spacing],
    }
  }

  // 确保 min < max
  if (min > max) {
    ;[min, max] = [max, min]
  }

  const range = max - min

  // 计算优雅的刻度间隔
  const roughTickSpacing = range / Math.max(1, maxTicks - 1)
  const tickSpacing = niceNumber(roughTickSpacing, true)

  // 计算优雅的边界
  const niceMin = Math.floor(min / tickSpacing) * tickSpacing
  const niceMax = Math.ceil(max / tickSpacing) * tickSpacing

  // 生成刻度值
  const ticks: number[] = []
  const tickCount = Math.round((niceMax - niceMin) / tickSpacing) + 1

  // 防止刻度过多（安全检查）
  if (tickCount > 100) {
    // 退回到简单的线性刻度
    const safeTickCount = Math.min(maxTicks + 2, 10)
    const safeSpacing = (max - min) / (safeTickCount - 1)
    for (let i = 0; i < safeTickCount; i++) {
      ticks.push(min + safeSpacing * i)
    }
    return {
      niceMin: min,
      niceMax: max,
      tickSpacing: safeSpacing,
      ticks,
    }
  }

  // 生成刻度值（处理浮点数精度问题）
  for (let i = 0; i < tickCount; i++) {
    const tick = niceMin + tickSpacing * i
    // 修正浮点数误差 - 使用更智能的四舍五入
    // 确定合适的精度（基于刻度间隔的量级）
    const precision = Math.max(0, -Math.floor(Math.log10(Math.abs(tickSpacing))) + 1)
    const roundedTick = Number(tick.toFixed(precision))
    ticks.push(roundedTick)
  }

  return {
    // Keep floating-point multiplication from shrinking the enclosing data domain.
    niceMin: Math.min(min, ticks[0] ?? niceMin),
    niceMax: Math.max(max, ticks.at(-1) ?? niceMax),
    tickSpacing,
    ticks,
  }
}

/**
 * ECharts 兼容的刻度计算（与 resolveYAxisTicks 接口兼容）
 */
export function resolveYAxisTicksECharts(
  domain: [number, number],
  tickCount = 5,
): { domain: [number, number]; values: number[] } {
  const result = calculateNiceScale(domain[0], domain[1], tickCount)
  return {
    domain: [result.niceMin, result.niceMax],
    values: result.ticks,
  }
}
