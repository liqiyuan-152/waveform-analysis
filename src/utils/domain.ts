import { extent } from 'd3'

/**
 * 计算带边距的数据域
 * @param values 数值数组
 * @returns 数据域 [最小值, 最大值]，如果数组为空返回 [0, 1]
 */
export function paddedDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1]
  const [minimum = 0, maximum = 1] = extent(values)
  if (minimum !== maximum) return [minimum, maximum]
  const padding = Math.abs(minimum) * 0.05 || 0.5
  return [minimum - padding, maximum + padding]
}

/**
 * 在主刻度之间生成次要刻度
 * @param values 主刻度值数组
 * @param subdivisions 细分数量，默认 5
 * @returns 次要刻度值数组
 */
export function buildMinorTicks(values: number[], subdivisions = 5): number[] {
  return values.flatMap((value, index) => {
    const nextValue = values[index + 1]
    if (nextValue === undefined) return []
    const step = (nextValue - value) / subdivisions
    return Array.from({ length: subdivisions - 1 }, (_, minorIndex) => value + step * (minorIndex + 1))
  })
}
