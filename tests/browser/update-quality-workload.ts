import { measureSamplingMemory } from './sampling-memory-workload'
import { createApp, h, nextTick, reactive } from 'vue'
import { init } from '@/native'
import type { WaveformChartInstance } from '@/types/native'
import type { WaveformChartOptions } from '@/types/options'
import type { WaveformData, WaveformSeries } from '@/types/data'
import WaveformChart from '@/adapters/vue/WaveformChart.vue'
import { ChartLayoutEngine } from '@/layout/ChartLayoutEngine'
import { seriesGeometry } from '@/rendering/geometry/seriesGeometry'
import { scaleLinear } from 'd3'
import type { TrackLayout, TrackSeriesPath } from '@/components/core/types'
import '@/styles/native.css'
import { recovery, transport, geometryCandidate } from './update-quality-candidates'
import { startInteractive, interactive } from './update-quality-interactive'

interface Scenario {
  series: number
  points: number
  input: 'objects' | 'typed'
}
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
const host = document.getElementById('benchmark')!
let registrations = 0
let latestSamplingWorker: WeakRef<Worker> | undefined
const originalPost = Worker.prototype.postMessage
Worker.prototype.postMessage = function (request, ...rest: unknown[]) {
  if (request?.type === 'register-dataset' || request?.type === 'replace-dataset') {
    registrations++
    latestSamplingWorker = new WeakRef(this)
  }
  return Reflect.apply(originalPost, this, [request, ...rest])
}
let layouts = 0
const originalCalculate = ChartLayoutEngine.prototype.calculate
ChartLayoutEngine.prototype.calculate = function (...args) {
  layouts++
  return originalCalculate.apply(this, args)
}
function data(scenario: Scenario, phase = 0): WaveformSeries[] {
  return Array.from({ length: scenario.series }, (_, channel) => ({
    id: `s${channel}`,
    name: `通道 ${channel}`,
    data:
      scenario.input === 'typed'
        ? {
            kind: 'typed-samples',
            sampleRate: scenario.points - 1,
            values: Float64Array.from({ length: scenario.points }, (_, i) =>
              Math.sin(i * 0.01 + phase + channel),
            ),
          }
        : {
            kind: 'points',
            points: Array.from({ length: scenario.points }, (_, i) => ({
              x: i / (scenario.points - 1),
              y: Math.sin(i * 0.01 + phase + channel),
            })),
          },
  }))
}
async function stable(chart: Pick<WaveformChartInstance, 'exportImage'>) {
  const deadline = performance.now() + 30_000
  while (true) {
    try {
      await chart.exportImage({ format: 'svg' })
      return
    } catch (error) {
      if ((error as { code?: string }).code !== 'export-stale' || performance.now() > deadline)
        throw error
      await frame()
    }
  }
}
async function measure(scenario: Scenario) {
  const series = data(scenario)
  const replacement = data(scenario, 0.5)
  const mountStart = performance.now()
  const chart = init(host, {
    data: { kind: 'series', series },
    width: 1200,
    height: 720,
    animationEnabled: false,
    grid: { rowCount: scenario.series, columnCount: 1 },
    rendering: { sampling: { mode: 'auto', maxPointCount: 1200 } },
  })
  try {
    await stable(chart)
    const changes: Record<string, unknown> = {
      coldStartup: { stableMs: performance.now() - mountStart },
    }
    for (const [name, patch] of [
      ['color', { lineColor: '#ff0000' }],
      [
        'single-channel',
        { data: { kind: 'series', series: [replacement[0]!, ...series.slice(1)] } },
      ],
      [
        'all-channels',
        {
          data: {
            kind: 'series',
            series: replacement.map((item) => ({ ...item, data: { ...item.data } })),
          },
        },
      ],
    ] as Array<[string, WaveformChartOptions]>) {
      const before = { registrations, layouts }
      const start = performance.now()
      chart.setOption(patch)
      const synchronousMs = performance.now() - start
      await stable(chart)
      changes[name] = {
        synchronousMs,
        stableMs: performance.now() - start,
        registrations: registrations - before.registrations,
        layouts: layouts - before.layouts,
      }
    }
    return changes
  } finally {
    chart.dispose()
    await frame()
  }
}
async function vueUpdate() {
  const options = reactive({ legend: { backgroundColor: '#fff' } })
  let chart: Pick<WaveformChartInstance, 'exportImage'> | undefined
  const input: WaveformData = { kind: 'samples', sampleRate: 10, values: [0, 1, 0] }
  const app = createApp({
    render: () =>
      h(WaveformChart, {
        ...options,
        data: input,
        width: 1200,
        height: 720,
        animationEnabled: false,
        annotations: Array.from({ length: 100 }, (_, i) => ({
          id: `a${i}`,
          seriesId: 'series-0',
          x: i / 1000,
          y: 0,
          text: `标注 ${i}`,
        })),
        ref: (value: unknown) => {
          chart = value as typeof chart
        },
      }),
  })
  app.mount(host)
  try {
    await stable(chart!)
    const start = performance.now()
    options.legend.backgroundColor = '#eee'
    await nextTick()
    const synchronousMs = performance.now() - start
    await stable(chart!)
    return { synchronousMs, stableMs: performance.now() - start }
  } finally {
    app.unmount()
    await frame()
  }
}
function geometry() {
  const points = Array.from({ length: 1200 }, (_, i) => ({ x: i, y: Math.sin(i), error: 0.2 }))
  const track = { xScale: scaleLinear().domain([0, 1200]).range([0, 1200]) } as TrackLayout
  const path = {
    series: { pointType: 'circle', errorBar: { capWidth: 4 } },
    pointRenderPoints: points,
    errorBarRenderPoints: points,
    yScale: scaleLinear().domain([-2, 2]).range([400, 0]),
  } as TrackSeriesPath
  const start = performance.now()
  let bytes = 0
  for (let i = 0; i < 100; i++) {
    const result = seriesGeometry(path, track)
    bytes += (result.pointPath?.length ?? 0) + (result.errorBarPath?.length ?? 0)
  }
  return { durationMs: performance.now() - start, bytes }
}
declare global {
  interface Window {
    updateQuality: {
      measureSamplingMemory: typeof measureSamplingMemory
      measure: typeof measure
      vueUpdate: typeof vueUpdate
      geometry: typeof geometry
      loseTransport: typeof loseTransport
      startInteractive: typeof startInteractive
      interactive: typeof interactive
      recovery: typeof recovery
      transport: typeof transport
      geometryCandidate: typeof geometryCandidate
    }
  }
}
function loseTransport() {
  const worker = latestSamplingWorker?.deref()
  if (!worker) throw new Error('Expected a real sampling Worker')
  worker.addEventListener('error', (event) => event.preventDefault(), { once: true })
  worker.dispatchEvent(
    new ErrorEvent('error', { cancelable: true, message: 'browser transport recovery probe' }),
  )
}
window.updateQuality = {
  measureSamplingMemory,
  loseTransport,
  measure,
  vueUpdate,
  geometry,
  recovery,
  transport,
  geometryCandidate,
  startInteractive,
  interactive,
}
