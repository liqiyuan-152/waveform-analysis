/**
 * 数据抽样算法
 * 用于在保持视觉保真度的同时减少渲染点数
 */

import type { WaveformPoint } from '../types'

/**
 * Largest Triangle Three Buckets (LTTB) 抽样算法
 *
 * 这是一种高效的降采样算法，能够在减少数据点的同时保持波形的视觉特征。
 * 算法通过计算三角形面积来选择最具代表性的点。
 *
 * 参考文献: Sveinn Steinarsson. 2013.
 * "Downsampling Time Series for Visual Representation"
 *
 * @param data 原始数据点数组
 * @param threshold 目标点数（必须 >= 3）
 * @returns 抽样后的数据点数组
 *
 * @example
 * const original = Array.from({ length: 10000 }, (_, i) => ({ x: i, y: Math.sin(i / 100) }))
 * const sampled = downsampleLTTB(original, 500) // 从 10000 点降至 500 点
 */
export function downsampleLTTB(data: WaveformPoint[], threshold: number): WaveformPoint[] {
  // 边界检查
  if (!Array.isArray(data) || data.length === 0) {
    return []
  }

  const dataLength = data.length

  // 如果数据点数少于或等于阈值，直接返回
  if (threshold >= dataLength || threshold <= 2) {
    return data
  }

  // 确保阈值至少为 3
  const sampledLength = Math.max(3, Math.floor(threshold))
  const sampled: WaveformPoint[] = []
  sampled.length = sampledLength

  // 始终保留第一个和最后一个点
  sampled[0] = data[0]!
  sampled[sampledLength - 1] = data[dataLength - 1]!

  // 计算每个桶的大小（除了第一个和最后一个点）
  const bucketSize = (dataLength - 2) / (sampledLength - 2)

  // 用于计算三角形面积的辅助变量
  let sampledIndex = 1

  for (let i = 0; i < sampledLength - 2; i++) {
    // 当前桶的范围
    const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1
    const avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1
    const avgRangeLength = Math.min(avgRangeEnd, dataLength) - avgRangeStart

    // 计算下一个桶的平均点（用于三角形计算）
    let avgX = 0
    let avgY = 0

    for (let j = avgRangeStart; j < Math.min(avgRangeEnd, dataLength); j++) {
      const point = data[j]!
      avgX += point.x
      avgY += point.y
    }

    if (avgRangeLength > 0) {
      avgX /= avgRangeLength
      avgY /= avgRangeLength
    }

    // 当前桶的范围
    const rangeStart = Math.floor(i * bucketSize) + 1
    const rangeEnd = Math.floor((i + 1) * bucketSize) + 1

    // 上一个选中的点
    const prevPoint = sampled[sampledIndex - 1]!

    // 在当前桶中找到形成最大三角形面积的点
    let maxArea = -1
    let maxAreaIndex = rangeStart

    for (let j = rangeStart; j < Math.min(rangeEnd, dataLength); j++) {
      const point = data[j]!

      // 计算三角形面积（使用叉积公式的绝对值）
      // Area = |((x1 - x3)(y2 - y1) - (x1 - x2)(y3 - y1))| / 2
      // 为了性能，我们省略除以2，因为只需要比较相对大小
      const area = Math.abs(
        (prevPoint.x - avgX) * (point.y - prevPoint.y) -
          (prevPoint.x - point.x) * (avgY - prevPoint.y),
      )

      if (area > maxArea) {
        maxArea = area
        maxAreaIndex = j
      }
    }

    // 选择形成最大面积的点
    sampled[sampledIndex] = data[maxAreaIndex]!
    sampledIndex++
  }

  return sampled
}

/**
 * 最小-最大抽样算法
 *
 * 这是一种简单但有效的抽样方法，将数据分成桶，每个桶选择最小值和最大值。
 * 适合展示数据的整体范围和波动，但可能会丢失一些细节特征。
 *
 * @param data 原始数据点数组
 * @param threshold 目标点数（必须 >= 2，最终点数可能略多于阈值）
 * @returns 抽样后的数据点数组
 *
 * @example
 * const original = Array.from({ length: 10000 }, (_, i) => ({ x: i, y: Math.sin(i / 100) }))
 * const sampled = downsampleMinMax(original, 500)
 */
export function downsampleMinMax(data: WaveformPoint[], threshold: number): WaveformPoint[] {
  if (!Array.isArray(data) || data.length === 0) {
    return []
  }

  const dataLength = data.length

  // 如果数据点数少于阈值，直接返回
  if (threshold >= dataLength || threshold <= 1) {
    return data
  }

  const sampled: WaveformPoint[] = []

  // 计算每个桶的大小
  const bucketSize = Math.max(1, Math.floor(dataLength / Math.floor(threshold / 2)))

  for (let i = 0; i < dataLength; i += bucketSize) {
    const bucketEnd = Math.min(i + bucketSize, dataLength)
    let minPoint = data[i]!
    let maxPoint = data[i]!

    // 在当前桶中找到最小和最大的Y值
    for (let j = i + 1; j < bucketEnd; j++) {
      const point = data[j]!
      if (point.y < minPoint.y) {
        minPoint = point
      }
      if (point.y > maxPoint.y) {
        maxPoint = point
      }
    }

    // 按X坐标顺序添加最小值和最大值
    if (minPoint.x < maxPoint.x) {
      sampled.push(minPoint)
      if (minPoint !== maxPoint) {
        sampled.push(maxPoint)
      }
    } else {
      sampled.push(maxPoint)
      if (minPoint !== maxPoint) {
        sampled.push(minPoint)
      }
    }
  }

  return sampled
}

/**
 * 自适应抽样策略
 *
 * 根据数据量自动选择最合适的抽样算法和阈值
 *
 * @param data 原始数据点数组
 * @param maxPoints 最大显示点数（可选，默认为5000）
 * @returns 抽样后的数据点数组和使用的算法信息
 */
export function adaptiveSampling(
  data: WaveformPoint[],
  maxPoints: number = 5000,
): { points: WaveformPoint[]; algorithm: 'none' | 'lttb' | 'minmax'; originalCount: number } {
  const dataLength = data.length

  // 不需要抽样
  if (dataLength <= maxPoints) {
    return { points: data, algorithm: 'none', originalCount: dataLength }
  }

  // 根据数据量选择算法
  // LTTB 适合保持波形形状，但对极大数据集可能较慢
  // MinMax 适合快速预览大数据集的范围
  if (dataLength > maxPoints * 10) {
    // 超大数据集，使用更快的 MinMax
    return {
      points: downsampleMinMax(data, maxPoints),
      algorithm: 'minmax',
      originalCount: dataLength,
    }
  } else {
    // 使用 LTTB 以获得更好的视觉质量
    return {
      points: downsampleLTTB(data, maxPoints),
      algorithm: 'lttb',
      originalCount: dataLength,
    }
  }
}

/**
 * 计算推荐的抽样阈值
 *
 * 基于视口宽度和像素密度计算合理的抽样点数
 *
 * @param viewportWidth 视口宽度（像素）
 * @param pixelRatio 设备像素比（默认为 window.devicePixelRatio 或 1）
 * @param pointsPerPixel 每像素点数（默认为 2，意味着每像素最多2个数据点）
 * @returns 推荐的抽样点数
 */
export function calculateSamplingThreshold(
  viewportWidth: number,
  pixelRatio: number = typeof window !== 'undefined' ? window.devicePixelRatio : 1,
  pointsPerPixel: number = 2,
): number {
  return Math.max(100, Math.floor(viewportWidth * pixelRatio * pointsPerPixel))
}
