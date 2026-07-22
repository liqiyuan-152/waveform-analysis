import {
  symbol,
  symbolCircle,
  symbolDiamond,
  symbolSquare,
  symbolTriangle,
  type SymbolType,
} from 'd3'

import type { WaveformLineStyle, WaveformLineType, WaveformPointType } from '../../types'

const LEGEND_SWATCH_CENTER_X = 13
const LEGEND_ERROR_BAR_TOP = 2
const LEGEND_ERROR_BAR_BOTTOM = 14
const LEGEND_ERROR_BAR_DEFAULT_CAP_WIDTH = 8
const LEGEND_ERROR_BAR_MAX_CAP_WIDTH = 24

const pointSymbols: Record<Exclude<WaveformPointType, 'none'>, SymbolType> = {
  circle: symbolCircle,
  square: symbolSquare,
  triangle: symbolTriangle,
  diamond: symbolDiamond,
}

export function waveformPointSymbolPath(pointType: WaveformPointType, size = 48): string | null {
  if (pointType === 'none') return null
  return symbol().type(pointSymbols[pointType]).size(size)() ?? null
}

export function waveformPointSeriesPath(
  pointType: WaveformPointType,
  points: ReadonlyArray<{ x: number; y: number }>,
  size = 48,
): string | null {
  if (pointType === 'none' || points.length === 0) return null

  if (pointType === 'circle') {
    const radius = Math.sqrt(size / Math.PI)
    return points
      .map(
        ({ x, y }) =>
          `M${x + radius},${y}A${radius},${radius},0,1,1,${x - radius},${y}` +
          `A${radius},${radius},0,1,1,${x + radius},${y}`,
      )
      .join('')
  }

  if (pointType === 'square') {
    const side = Math.sqrt(size)
    const halfSide = side / 2
    return points
      .map(({ x, y }) => `M${x - halfSide},${y - halfSide}h${side}v${side}h${-side}Z`)
      .join('')
  }

  if (pointType === 'triangle') {
    const topOffset = Math.sqrt(size / ((Math.sqrt(3) * 3) / 4))
    const halfWidth = (topOffset * Math.sqrt(3)) / 2
    const bottomOffset = topOffset / 2
    return points
      .map(
        ({ x, y }) =>
          `M${x},${y - topOffset}L${x + halfWidth},${y + bottomOffset}` +
          `L${x - halfWidth},${y + bottomOffset}Z`,
      )
      .join('')
  }

  const verticalOffset = Math.sqrt(size / (2 * Math.tan(Math.PI / 6)))
  const horizontalOffset = verticalOffset * Math.tan(Math.PI / 6)
  return points
    .map(
      ({ x, y }) =>
        `M${x},${y - verticalOffset}L${x + horizontalOffset},${y}` +
        `L${x},${y + verticalOffset}L${x - horizontalOffset},${y}Z`,
    )
    .join('')
}

export function waveformLegendLinePath(lineType: WaveformLineType): string | null {
  if (lineType === 'none') return null
  return 'M1 8H25'
}

export function waveformLineDasharray(lineStyle: WaveformLineStyle): string | undefined {
  if (lineStyle === 'dashed') return '8 5'
  if (lineStyle === 'dash-dot') return '8 5 1.5 5'
  return undefined
}

export function waveformLegendErrorBarPath(capWidth: number): string {
  const resolvedCapWidth =
    Number.isFinite(capWidth) && capWidth > 0
      ? Math.min(capWidth, LEGEND_ERROR_BAR_MAX_CAP_WIDTH)
      : LEGEND_ERROR_BAR_DEFAULT_CAP_WIDTH
  const capHalfWidth = resolvedCapWidth / 2
  const capStart = LEGEND_SWATCH_CENTER_X - capHalfWidth
  const capEnd = LEGEND_SWATCH_CENTER_X + capHalfWidth
  return [
    `M${capStart} ${LEGEND_ERROR_BAR_TOP}H${capEnd}`,
    `M${LEGEND_SWATCH_CENTER_X} ${LEGEND_ERROR_BAR_TOP}V${LEGEND_ERROR_BAR_BOTTOM}`,
    `M${capStart} ${LEGEND_ERROR_BAR_BOTTOM}H${capEnd}`,
  ].join('')
}
