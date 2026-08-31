import { describe, expect, it } from 'vitest'

import {
  BASELINE_PLOT_WIDTH,
  BASELINE_SERIES_COUNT,
  BASELINE_MAX_RENDER_POINTS_PER_SERIES,
  createBaselineData,
  createSvgPath,
  findNearestBaselinePoint,
  measureBaseline,
  summarizeMilliseconds,
} from './wasmSamplingBaseline'
import { prepareWaveformSeries } from '../src/components/core/useWaveformData'
import { resolveWaveformRenderingOptions, selectRenderablePoints } from '../src/core'
import { resolveVisiblePointRange } from '../src/core/rendering'

const reportEnabled = process.env.WAVEFORM_BASELINE_REPORT === '1'
const data = createBaselineData()

describe('WASM sampling phase 0 baseline', () => {
  it('keeps 10 independent 100k-point series intact through the current render preparation path', () => {
    const prepared = prepareWaveformSeries(data)

    expect(prepared).toHaveLength(BASELINE_SERIES_COUNT)
    expect(new Set(prepared.map((series) => series.id)).size).toBe(BASELINE_SERIES_COUNT)
    expect(prepared.every((series) => series.points.length === 100_000)).toBe(true)
    expect(prepared.every((series) => series.xDomain[0] <= 0 && series.xDomain[1] >= 99.999)).toBe(
      true,
    )
    expect(prepared.every((series, index) => series.yDomain[1] >= 1_000 + index)).toBe(true)
    expect(prepared.every((series, index) => series.yDomain[0] <= -1_000 - index)).toBe(true)
  })

  it('bounds each 100k-point rendered path and retains narrow source extrema', () => {
    const prepared = prepareWaveformSeries(data)
    const domain: [number, number] = [0, 99.999]
    const options = resolveWaveformRenderingOptions({
      downsampleThreshold: 1_000,
      maxPointsPerPixel: 4,
    })

    for (const [index, series] of prepared.entries()) {
      const selected = selectRenderablePoints(series.points, domain, BASELINE_PLOT_WIDTH, options)
      const path = createSvgPath(selected, series, domain)

      expect(selected.length).toBeLessThanOrEqual(BASELINE_MAX_RENDER_POINTS_PER_SERIES)
      expect(selected).toContain(series.points[50_001])
      expect(selected).toContain(series.points[75_001])
      expect(path.match(/[ML]/g)).toHaveLength(selected.length)
      expect(selected.some((point) => point.y === 1_000 + index)).toBe(true)
    }
  })

  it('uses binary visible-range and hover lookups against full source data', () => {
    const prepared = prepareWaveformSeries(data)

    for (const series of prepared) {
      expect(resolveVisiblePointRange(series.points, [50, 50.001])).toEqual({
        start: 50_000,
        end: 50_002,
      })
      expect(findNearestBaselinePoint(series.points, 50.0012)).toBe(series.points[50_001])
      expect(findNearestBaselinePoint(series.points, -1)).toBeUndefined()
    }
  })

  it('reports repeatable core-operation timings only when invoked as a benchmark', () => {
    if (!reportEnabled) return

    const before = process.memoryUsage()
    const metrics = measureBaseline(data)
    const after = process.memoryUsage()
    const report = {
      environment: {
        runtime: 'node',
        node: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      scenario: {
        series: BASELINE_SERIES_COUNT,
        pointsPerSeries: 100_000,
        totalPoints: BASELINE_SERIES_COUNT * 100_000,
        plotWidth: BASELINE_PLOT_WIDTH,
        repeats: 7,
      },
      baselineDecision: {
        maxVisibleSeries: BASELINE_SERIES_COUNT,
        maxRenderPointsPerSeries: BASELINE_MAX_RENDER_POINTS_PER_SERIES,
        timingBudget:
          'report-only until independent hardware baselines establish a regression budget',
      },
      milliseconds: {
        normalization: summarizeMilliseconds(metrics.normalizeMs),
        prepareSeriesIncludingDomainScan: summarizeMilliseconds(metrics.prepareSeriesMs),
        visibleRangeForAllSeries: summarizeMilliseconds(metrics.visibleRangeMs),
        peakSelectionForAllSeries: summarizeMilliseconds(metrics.selectionMs),
        svgPathGenerationForAllSeries: summarizeMilliseconds(metrics.svgPathMs),
        hover100QueriesAcrossAllSeries: summarizeMilliseconds(metrics.hoverMs),
      },
      rendering: {
        pointCounts: metrics.renderPointCounts,
        pathCharacterCounts: metrics.pathCharacterCounts,
      },
      memoryBytes: {
        before,
        after,
        delta: Object.fromEntries(
          Object.entries(after).map(([key, value]) => [
            key,
            value - before[key as keyof typeof before],
          ]),
        ),
      },
    }
    console.info(JSON.stringify(report, null, 2))
  })
})
