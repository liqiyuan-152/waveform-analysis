import { createApp, defineComponent, h, nextTick, shallowRef } from 'vue'
import WaveformChart from '../support/LegacyWaveformChart.vue'
import { globalAnimator } from '@/animation/core/Animator'
import type { WaveformChartHandle } from '@/types/controls'
import type { WaveformData, WaveformSamplingMode } from '@/types'
import { init, type WaveformChartInstance, type WaveformChartOptions } from '@/native'
import '../fixtures/legacy/components/WaveformChart.css'
import '@/styles/native.css'

interface MigrationScenario {
  engine?: 'legacy' | 'native'
  width: number
  height: number
  series: number
  pointsPerSeries: number
  sampling: WaveformSamplingMode
  animationEnabled: boolean
  animationWorkload?: 'update'
}
const host = document.getElementById('benchmark')!
let app: ReturnType<typeof createApp> | undefined
let native: WaveformChartInstance | undefined
let chart: (WaveformChartHandle & { benchmarkIsStable?: () => boolean }) | undefined
let input = shallowRef<WaveformData>({ kind: 'points', points: [] })
let animationsEnabled = shallowRef(false)
let timeline: { event: string; time: number }[] = []
let animationCompletions = { enter: 0, update: 0 }
const mark = (event: string) => timeline.push({ event, time: performance.now() })
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

function data(scenario: MigrationScenario, phase = 0): WaveformData {
  return {
    kind: 'series',
    series: Array.from({ length: scenario.series }, (_, channel) => ({
      id: `s${channel}`,
      name: `通道 ${channel + 1}`,
      unit: 'V',
      data: {
        kind: 'typed-samples',
        values: Float64Array.from({ length: scenario.pointsPerSeries }, (_, i) =>
          Math.sin((i / scenario.pointsPerSeries) * 30 + channel + phase),
        ),
        sampleRate: scenario.pointsPerSeries - 1,
      },
    })),
  }
}

async function stable() {
  mark('stable:start')
  await nextTick()
  await frame()
  // The legacy exporter intentionally finishes animations. Wait for their natural completion
  // first so animation benchmarks do not compare cancelled legacy work with native playback.
  const animationDeadline = performance.now() + 5000
  while (chart?.benchmarkIsStable && !chart.benchmarkIsStable()) {
    if (performance.now() >= animationDeadline) throw new Error('Legacy stability timeout')
    await frame()
    await nextTick()
  }
  mark('export:start')
  // The old API has no finished event; use its stable export barrier for both baseline metrics.
  const deadline = performance.now() + 5000
  while (true) {
    try {
      const blob = await chart!.exportImage({ format: 'svg' })
      if (!blob.size) throw new Error('Empty baseline SVG')
      break
    } catch (error) {
      // Async sampling can invalidate an export while mounting; do not hide other failures.
      if ((error as { code?: string }).code !== 'export-stale' || performance.now() >= deadline)
        throw error
      await frame()
    }
  }
  mark('export:end')
  const stableAt = performance.now()
  // Keep the paint barrier for operation isolation, but do not count phase-dependent idle time
  // after both exporters have already produced a stable, nonempty snapshot.
  await frame()
  mark('stable:end')
  return stableAt
}

async function mount(scenario: MigrationScenario) {
  unmount()
  host.style.width = `${scenario.width}px`
  host.style.height = `${scenario.height}px`
  input = shallowRef(data(scenario))
  animationsEnabled = shallowRef(
    scenario.animationWorkload === 'update' ? false : scenario.animationEnabled,
  )
  animationCompletions = { enter: 0, update: 0 }
  const options: WaveformChartOptions = {
    data: input.value,
    width: scenario.width,
    height: scenario.height,
    grid: { rowCount: scenario.series, columnCount: 1 },
    title: { text: '波形迁移基线' },
    frameNumber: '001',
    animationEnabled: animationsEnabled.value,
    animationThreshold: 10_000_000,
    animation: { duration: 100, staggerDelay: 0, onComplete: () => animationCompletions.enter++ },
    animationUpdate: { duration: 100, onComplete: () => animationCompletions.update++ },
    rendering: { sampling: { mode: scenario.sampling, maxPointCount: 1200 } },
  }
  const start = performance.now()
  timeline = []
  mark('mount:start')
  if (scenario.engine === 'native') {
    native = init(host, options)
    native.on('rendered', () => mark('rendered'))
    native.on('finished', () => mark('finished'))
    chart = native
    return (await stable()) - start
  }
  app = createApp(
    defineComponent({
      setup: () => () =>
        h(WaveformChart, {
          ref: (instance: unknown) => (chart = instance as WaveformChartHandle),
          ...options,
          data: input.value,
          animationEnabled: animationsEnabled.value,
        }),
    }),
  )
  app.mount(host)
  return (await stable()) - start
}

async function measure(scenario: MigrationScenario) {
  const mountMs = await mount(scenario)
  const replacement = data(scenario, 0.5)
  const start = performance.now()
  mark('update:start')
  input.value = replacement
  animationsEnabled.value = scenario.animationEnabled
  native?.setOption({ data: replacement, animationEnabled: scenario.animationEnabled })
  const stableAt = await stable()
  return {
    mountMs,
    updateMs: stableAt - start,
    paths: host.querySelectorAll('.waveform-chart__line').length,
    timeline: [...timeline],
    animationCompletions: { ...animationCompletions },
  }
}

async function viewport() {
  const samples: number[] = []
  for (let i = 0; i < 100; i++) {
    const start = performance.now()
    chart!.setViewportDomain([0.1 + (i % 5) * 0.01, 0.8 + (i % 5) * 0.01])
    await frame()
    samples.push(performance.now() - start)
  }
  await stable()
  return samples
}

function unmount() {
  native?.dispose()
  native = undefined
  app?.unmount()
  app = undefined
  chart = undefined
  // The benchmark owns this reference. Release it before the runner's between-run GC barrier.
  input.value = { kind: 'points', points: [] }
  return { elements: host.childElementCount, animationTasks: globalAnimator.getAnimationCount() }
}

declare global {
  interface Window {
    waveformMigrationBaseline: {
      mount: typeof mount
      measure: typeof measure
      viewport: typeof viewport
      unmount: typeof unmount
    }
  }
}
window.waveformMigrationBaseline = { mount, measure, viewport, unmount }
