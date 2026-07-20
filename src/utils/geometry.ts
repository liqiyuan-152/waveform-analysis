import type { WaveformDisplayMode } from '@/types'

/**
 * 轨道几何信息
 */
export interface TrackGeometry {
  /** 轨道间距 */
  gap: number
  /** 坐标轴区域高度 */
  axisBand: number
  /** 单个轨道高度 */
  height: number
}

/**
 * 计算轨道布局几何信息
 * @param trackCount 轨道数量
 * @param displayMode 显示模式
 * @param innerHeight 可用高度
 * @returns 轨道几何信息
 */
export function resolveTrackGeometry(
  trackCount: number,
  displayMode: WaveformDisplayMode,
  innerHeight: number,
): TrackGeometry {
  if (trackCount <= 0) return { gap: 0, axisBand: 0, height: 0 }

  const desiredGap = displayMode === 'compact' ? 0 : displayMode === 'separated' ? 16 : 14
  const desiredAxisBand = displayMode === 'independent' ? 30 : 0
  const desiredReserve = (trackCount - 1) * (desiredGap + desiredAxisBand)
  const maximumReserve = innerHeight * 0.45
  const reserveScale = desiredReserve > maximumReserve ? maximumReserve / desiredReserve : 1
  const gap = desiredGap * reserveScale
  const axisBand = desiredAxisBand * reserveScale
  const height = Math.max(1, (innerHeight - (trackCount - 1) * (gap + axisBand)) / trackCount)

  return { gap, axisBand, height }
}

/**
 * 限制数值在指定范围内
 * @param value 待限制的值
 * @param min 最小值
 * @param max 最大值
 * @returns 限制后的值
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
