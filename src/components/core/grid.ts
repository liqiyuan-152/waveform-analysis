import type { WaveformDisplayMode } from '../../types'

export const GRID_MIN_COUNT = 1
export const GRID_MAX_COUNT = 10
export const X_AXIS_BAND = 30

export interface WaveformGridOptions {
  rowCount?: number
  columnCount?: number
  showPagination?: boolean
  fillIncompleteLastRow?: boolean
  trackLines?: WaveformGridTrackLines
}

export interface WaveformGridLineOptions {
  horizontal?: boolean
  vertical?: boolean
  /** Optional stroke color for horizontal major and minor grid lines. */
  horizontalColor?: string
  /** Optional stroke color for vertical major and minor grid lines. */
  verticalColor?: string
}

export type WaveformGridTrackLines = Record<string, WaveformGridLineOptions>

export interface NormalizedWaveformGridLineOptions {
  horizontal: boolean
  vertical: boolean
  horizontalColor?: string
  verticalColor?: string
}

export interface NormalizedWaveformGridOptions {
  rowCount: number
  columnCount: number
  showPagination: boolean
  fillIncompleteLastRow: boolean
  trackLines: Record<string, NormalizedWaveformGridLineOptions>
}

export interface GridCellGeometry {
  slotIndex: number
  row: number
  column: number
  left: number
  top: number
  width: number
  /** Backward-compatible alias for the actual plot height. */
  height: number
  plotHeight: number
  cellHeight: number
  xAxisBand: number
  isLastRow?: boolean
}

const normalizeCount = (value: unknown, fallback: number) => {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(GRID_MAX_COUNT, Math.max(GRID_MIN_COUNT, Math.floor(numeric)))
}

export function normalizeGridOptions(options?: WaveformGridOptions): NormalizedWaveformGridOptions {
  const trackLines = Object.fromEntries(
    Object.entries(options?.trackLines ?? {}).map(([trackId, lines]) => [
      trackId,
      {
        horizontal: typeof lines?.horizontal === 'boolean' ? lines.horizontal : true,
        vertical: typeof lines?.vertical === 'boolean' ? lines.vertical : true,
        horizontalColor:
          typeof lines?.horizontalColor === 'string' && lines.horizontalColor.trim()
            ? lines.horizontalColor
            : undefined,
        verticalColor:
          typeof lines?.verticalColor === 'string' && lines.verticalColor.trim()
            ? lines.verticalColor
            : undefined,
      },
    ]),
  )
  return {
    rowCount: normalizeCount(options?.rowCount, 2),
    columnCount: normalizeCount(options?.columnCount, 1),
    showPagination: options?.showPagination ?? true,
    fillIncompleteLastRow: options?.fillIncompleteLastRow ?? false,
    trackLines,
  }
}

export function getPageSize(options: NormalizedWaveformGridOptions): number {
  return options.rowCount * options.columnCount
}

export function getPageCount(seriesCount: number, options: NormalizedWaveformGridOptions): number {
  return Math.max(1, Math.ceil(Math.max(0, seriesCount) / getPageSize(options)))
}

export function paginateSeries<T>(
  series: T[],
  page: number,
  options: NormalizedWaveformGridOptions,
): T[] {
  const pageCount = getPageCount(series.length, options)
  const safePage = Math.min(pageCount, Math.max(1, Math.floor(page)))
  const start = (safePage - 1) * getPageSize(options)
  return series.slice(start, start + getPageSize(options))
}

export function getGridGap(displayMode: WaveformDisplayMode): number {
  return displayMode === 'compact' ? 0 : displayMode === 'separated' ? 16 : 14
}

export function resolveGridCellGeometry(
  innerWidth: number,
  innerHeight: number,
  options: NormalizedWaveformGridOptions,
  displayMode: WaveformDisplayMode,
  slotHasSeries: boolean[] = [],
  horizontalGap?: number,
  showXAxis = true,
): GridCellGeometry[] {
  const pageSize = getPageSize(options)
  const seriesCount = slotHasSeries.filter(Boolean).length
  const filledLastRow = options.fillIncompleteLastRow && seriesCount > 0 && seriesCount < pageSize
  const rowCount = filledLastRow ? Math.ceil(seriesCount / options.columnCount) : options.rowCount
  const defaultGap = getGridGap(displayMode)
  const columnGap = Number.isFinite(horizontalGap)
    ? Math.max(0, horizontalGap as number)
    : defaultGap
  const axisRows = new Set<number>()
  if (!showXAxis) {
    // Net view uses the full drawing area for waveform pixels.
  } else if (displayMode === 'independent') {
    for (let row = 0; row < rowCount; row += 1) axisRows.add(row)
  } else if (displayMode === 'compact') {
    // Compact tracks share one continuous plot stack. Reserve the X-axis band
    // only beneath the final grid row, including when that row is empty.
    axisRows.add(rowCount - 1)
  } else {
    for (let column = 0; column < options.columnCount; column += 1) {
      for (let slotIndex = getPageSize(options) - 1; slotIndex >= 0; slotIndex -= 1) {
        if (slotIndex % options.columnCount !== column) continue
        if (slotHasSeries[slotIndex]) {
          axisRows.add(Math.floor(slotIndex / options.columnCount))
          break
        }
      }
    }
  }
  const totalVerticalGap = Math.max(0, rowCount - 1) * defaultGap
  const totalAxisBand = axisRows.size * X_AXIS_BAND
  const plotHeight = Math.max(
    1,
    (innerHeight - totalVerticalGap - totalAxisBand) / rowCount,
  )

  return Array.from({ length: filledLastRow ? seriesCount : pageSize }, (_, slotIndex) => {
    const row = Math.floor(slotIndex / options.columnCount)
    const column = slotIndex % options.columnCount
    const rowSeriesCount =
      filledLastRow && row === rowCount - 1
        ? seriesCount - row * options.columnCount
        : options.columnCount
    const rowGap = Math.max(0, rowSeriesCount - 1) * columnGap
    const width = Math.max(1, (innerWidth - rowGap) / rowSeriesCount)
    const xAxisBand = axisRows.has(row) ? X_AXIS_BAND : 0
    const cellHeight = plotHeight + xAxisBand
    const top = Array.from({ length: row }, (_, previousRow) => {
      const previousBand = axisRows.has(previousRow) ? X_AXIS_BAND : 0
      return plotHeight + previousBand + defaultGap
    }).reduce((sum, value) => sum + value, 0)
    return {
      slotIndex,
      row,
      column,
      left: column * (width + columnGap),
      top,
      width,
      height: plotHeight,
      plotHeight,
      cellHeight,
      xAxisBand,
      isLastRow: row === rowCount - 1,
    }
  })
}

export function getBottomRowCellIndexes(
  cells: Array<GridCellGeometry & { hasSeries?: boolean }>,
  columnCount: number,
): Set<number> {
  const visible = new Set<number>()
  for (let column = 0; column < columnCount; column += 1) {
    for (let index = cells.length - 1; index >= 0; index -= 1) {
      const cell = cells[index]
      if (cell.column === column && cell.hasSeries) {
        visible.add(cell.slotIndex)
        break
      }
    }
  }
  return visible
}
