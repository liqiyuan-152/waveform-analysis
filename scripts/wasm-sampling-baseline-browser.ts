import {
  BASELINE_PLOT_WIDTH,
  BASELINE_SERIES_COUNT,
  BASELINE_MAX_RENDER_POINTS_PER_SERIES,
  createBaselineData,
  createSvgPath,
  measureBaseline,
  summarizeMilliseconds,
} from './wasmSamplingBaseline'
import { prepareWaveformSeries } from '../src/components/core/useWaveformData'
import { resolveWaveformRenderingOptions, selectRenderablePoints } from '../src/core'

const output = document.querySelector<HTMLPreElement>('[data-baseline-output]')
const runButton = document.querySelector<HTMLButtonElement>('[data-run-baseline]')
const trace = document.querySelector<HTMLDivElement>('[data-trace]')

function browserMemory() {
  const memory = (
    performance as Performance & {
      memory?: { jsHeapSizeLimit: number; totalJSHeapSize: number; usedJSHeapSize: number }
    }
  ).memory
  return memory
    ? {
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        totalJSHeapSize: memory.totalJSHeapSize,
        usedJSHeapSize: memory.usedJSHeapSize,
      }
    : null
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

async function runBaseline() {
  if (!output || !runButton || !trace) return
  runButton.disabled = true
  output.textContent = 'Running 10 x 100k baseline...'
  const longTasks: PerformanceEntry[] = []
  const observer = PerformanceObserver.supportedEntryTypes.includes('longtask')
    ? new PerformanceObserver((entries) => longTasks.push(...entries.getEntries()))
    : undefined
  observer?.observe({ type: 'longtask', buffered: true })

  const memoryBefore = browserMemory()
  const data = createBaselineData()
  const metrics = measureBaseline(data)
  const prepared = prepareWaveformSeries(data)
  const domain: [number, number] = [0, 99.999]
  const options = resolveWaveformRenderingOptions({
    downsampleThreshold: 1_000,
    maxPointsPerPixel: 4,
  })
  const firstPathStartedAt = performance.now()
  const paths = prepared.map((series) => {
    const points = selectRenderablePoints(series.points, domain, BASELINE_PLOT_WIDTH, options)
    return createSvgPath(points, series, domain)
  })
  trace.replaceChildren(
    ...paths.map((path) => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      const element = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      svg.setAttribute('viewBox', '0 0 800 300')
      element.setAttribute('d', path)
      svg.append(element)
      return svg
    }),
  )
  await nextFrame()
  const firstPathVisibleMs = performance.now() - firstPathStartedAt
  observer?.disconnect()

  output.textContent = JSON.stringify(
    {
      environment: {
        runtime: 'browser',
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency,
      },
      scenario: { series: BASELINE_SERIES_COUNT, pointsPerSeries: 100_000, totalPoints: 1_000_000 },
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
        firstVisibleSvgPaths: Number(firstPathVisibleMs.toFixed(3)),
      },
      rendering: {
        pointCounts: metrics.renderPointCounts,
        pathCharacterCounts: metrics.pathCharacterCounts,
      },
      memoryBytes: { before: memoryBefore, after: browserMemory() },
      longTasks: {
        supported: Boolean(observer),
        count: longTasks.length,
        longestMs: Math.max(0, ...longTasks.map((entry) => entry.duration)),
      },
    },
    null,
    2,
  )
  runButton.disabled = false
}

runButton?.addEventListener('click', () => void runBaseline())
