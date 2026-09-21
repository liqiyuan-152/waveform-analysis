import { bisector, line, scaleLinear } from 'd3'

import {
  normalizeWaveformSeries,
  resolveWaveformRenderingOptions,
  selectRenderablePoints,
} from '../src/core'
import { resolveVisiblePointRange } from '../src/core/rendering'
import { prepareWaveformSeries } from '../src/components/core/useWaveformData'
import type { PreparedWaveformSeries } from '../src/components/core/useWaveformData'
import type { WaveformData, WaveformPoint } from '../src/types'

export const BASELINE_POINT_COUNT = 100_000
export const BASELINE_SERIES_COUNT = 10
export const BASELINE_PLOT_WIDTH = 800
export const BASELINE_REPEAT_COUNT = 7
export const BASELINE_MAX_RENDER_POINTS_PER_SERIES = BASELINE_PLOT_WIDTH * 4 + 2

const pointBisector = bisector<WaveformPoint, number>((point) => point.x)

export interface BaselineMetrics {
  normalizeMs: number[]
  prepareSeriesMs: number[]
  visibleRangeMs: number[]
  selectionMs: number[]
  svgPathMs: number[]
  hoverMs: number[]
  renderPointCounts: number[]
  pathCharacterCounts: number[]
}

export function createBaselineData(
  seriesCount = BASELINE_SERIES_COUNT,
  pointCount = BASELINE_POINT_COUNT,
): WaveformData {
  return {
    kind: 'series',
    series: Array.from({ length: seriesCount }, (_, seriesIndex) => ({
      id: `baseline-channel-${seriesIndex + 1}`,
      name: `Baseline channel ${seriesIndex + 1}`,
      data: {
        kind: 'points',
        points: Array.from({ length: pointCount }, (_, pointIndex) => ({
          x: pointIndex / 1_000,
          y:
            pointIndex === 50_001
              ? 1_000 + seriesIndex
              : pointIndex === 75_001
                ? -1_000 - seriesIndex
                : Math.sin((pointIndex + seriesIndex * 29) / 50),
          ...(pointIndex % 10_000 === 0 ? { error: 0.25 } : {}),
        })),
      },
    })),
  }
}

export function findNearestBaselinePoint(
  points: WaveformPoint[],
  xValue: number,
): WaveformPoint | undefined {
  const firstPoint = points[0]
  const lastPoint = points.at(-1)
  if (!firstPoint || !lastPoint || xValue < firstPoint.x || xValue > lastPoint.x) return undefined
  return points[pointBisector.center(points, xValue)]
}

export function percentile(values: readonly number[], ratio: number) {
  if (!values.length) return 0
  const ordered = [...values].sort((left, right) => left - right)
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * ratio) - 1)]
}

export function summarizeMilliseconds(values: readonly number[]) {
  const total = values.reduce((sum, value) => sum + value, 0)
  return {
    samples: values.length,
    mean: Number((total / values.length).toFixed(3)),
    p50: Number(percentile(values, 0.5).toFixed(3)),
    p95: Number(percentile(values, 0.95).toFixed(3)),
  }
}

export function measureBaseline(
  data: WaveformData,
  repeats = BASELINE_REPEAT_COUNT,
): BaselineMetrics {
  const metrics: BaselineMetrics = {
    normalizeMs: [],
    prepareSeriesMs: [],
    visibleRangeMs: [],
    selectionMs: [],
    svgPathMs: [],
    hoverMs: [],
    renderPointCounts: [],
    pathCharacterCounts: [],
  }
  const rendering = resolveWaveformRenderingOptions({
    downsampleThreshold: 1_000,
    maxPointsPerPixel: 4,
  })
  const domain: [number, number] = [0, BASELINE_POINT_COUNT / 1_000 - 0.001]

  for (let repeat = 0; repeat < repeats; repeat += 1) {
    let startedAt = performance.now()
    normalizeWaveformSeries(data)
    metrics.normalizeMs.push(performance.now() - startedAt)

    startedAt = performance.now()
    const preparedSeries = prepareWaveformSeries(data)
    metrics.prepareSeriesMs.push(performance.now() - startedAt)

    startedAt = performance.now()
    const ranges = preparedSeries.map((series) => resolveVisiblePointRange(series.points, domain))
    metrics.visibleRangeMs.push(performance.now() - startedAt)

    startedAt = performance.now()
    const renderPoints = preparedSeries.map((series) =>
      selectRenderablePoints(series.points, domain, BASELINE_PLOT_WIDTH, rendering),
    )
    metrics.selectionMs.push(performance.now() - startedAt)
    if (repeat === repeats - 1)
      metrics.renderPointCounts = renderPoints.map((points) => points.length)

    startedAt = performance.now()
    const paths = renderPoints.map((points, index) =>
      createSvgPath(points, preparedSeries[index], domain),
    )
    metrics.svgPathMs.push(performance.now() - startedAt)
    if (repeat === repeats - 1) metrics.pathCharacterCounts = paths.map((path) => path.length)

    startedAt = performance.now()
    for (let query = 0; query < 100; query += 1) {
      const xValue = ((query * 997) % BASELINE_POINT_COUNT) / 1_000
      for (const series of preparedSeries) findNearestBaselinePoint(series.points, xValue)
    }
    metrics.hoverMs.push(performance.now() - startedAt)

    // Retain the range calculation in the measured path so it cannot be optimized away.
    if (ranges.some((range) => range.end <= range.start))
      throw new Error('Baseline data has no visible points')
  }
  return metrics
}

export function createSvgPath(
  points: WaveformPoint[],
  series: PreparedWaveformSeries,
  domain: [number, number],
) {
  const xScale = scaleLinear(domain, [0, BASELINE_PLOT_WIDTH])
  const yScale = scaleLinear(series.yDomain, [300, 0])
  return (
    line<WaveformPoint>()
      .x((point) => xScale(point.x))
      .y((point) => yScale(point.y))(points) ?? ''
  )
}
