import { createApp, defineComponent, h, nextTick, shallowRef } from 'vue'
import { WaveformChart, globalAnimator, type WaveformData, type WaveformChartHandle } from '@/index'
import '@/components/WaveformChart.css'

interface Scenario {
  width: number
  height: number
  series: number
  points: number
  mode: 'static' | 'enter' | 'compatible' | 'crossfade'
  enabled?: boolean
  duration?: number
}
function data(s: Scenario, phase = 0, incompatible = false): WaveformData {
  return {
    kind: 'series',
    series: Array.from({ length: s.series }, (_, channel) => {
      const count = Math.floor(s.points / s.series) + (channel < s.points % s.series ? 1 : 0)
      return {
        id: `s${channel}`,
        name: `Channel ${channel}`,
        data: {
          kind: 'points',
          points: Array.from({ length: count }, (_, i) => ({
            x: i / Math.max(1, count - 1) + (incompatible ? 0.00001 * (i % 2) : 0),
            y: Math.sin((i / Math.max(1, count - 1)) * 30 + channel) * (10 + phase),
          })),
        },
      }
    }),
  }
}
const host = document.getElementById('benchmark')!
let app: ReturnType<typeof createApp> | undefined
let chart: WaveformChartHandle | undefined
const raf = () => new Promise<number>((resolve) => requestAnimationFrame(resolve))
async function mount(s: Scenario) {
  app?.unmount()
  host.style.width = `${s.width}px`
  host.style.height = `${s.height}px`
  const input = shallowRef(data(s))
  app = createApp(
    defineComponent({
      setup: () => () =>
        h(WaveformChart, {
          ref: (value: unknown) => {
            chart = value as WaveformChartHandle
          },
          data: input.value,
          width: s.width,
          height: s.height,
          grid: { rowCount: s.series, columnCount: 1, showPagination: false },
          animationEnabled: s.enabled ?? s.mode !== 'static',
          animation: { duration: s.mode === 'enter' ? (s.duration ?? 2000) : 0, staggerDelay: 0 },
          animationUpdate: { duration: s.duration ?? 2000 },
          rendering: { sampling: { mode: 'auto', maxPointCount: 1200 } },
        }),
    }),
  )
  app.mount(host)
  await nextTick()
  // Allow asynchronous sampling and layout to settle before starting updates.
  await new Promise((resolve) => setTimeout(resolve, 100))
  await raf()
  if (s.mode === 'compatible' || s.mode === 'crossfade') {
    input.value = data(s, 5, s.mode === 'crossfade')
    await nextTick()
  }
}
async function observe(s: Scenario) {
  await mount(s)
  const intervals: number[] = []
  let maxActiveTasks = globalAnimator.getAnimationCount()
  const start = await raf()
  let previous = start
  while (previous - start < 2100) {
    const time = await raf()
    maxActiveTasks = Math.max(maxActiveTasks, globalAnimator.getAnimationCount())
    intervals.push(time - previous)
    previous = time
  }
  const displayedCoordinates = [...host.querySelectorAll('path.waveform-chart__line')].reduce(
    (sum, path) => sum + ((path.getAttribute('d') ?? '').match(/[ML]/g)?.length ?? 0),
    0,
  )
  const active = globalAnimator.getAnimationCount()
  if (s.enabled !== false && s.points < 50000 && s.mode !== 'static' && !maxActiveTasks)
    throw new Error(`No animation observed for ${s.mode} at ${s.points} points`)
  app?.unmount()
  app = undefined
  if (globalAnimator.getAnimationCount() !== 0) throw new Error('Tasks survived unmount')
  return {
    intervals,
    elapsed: previous - start,
    displayedCoordinates,
    activeAfterObservation: active,
    maxActiveTasks,
  }
}
async function exportImage(format: 'svg' | 'png') {
  const blob = await chart!.exportImage({ format })
  return { type: blob.type, size: blob.size, svg: format === 'svg' ? await blob.text() : undefined }
}
async function refresh() {
  const values: number[] = []
  let previous = await raf()
  for (let i = 0; i < 120; i++) {
    const time = await raf()
    values.push(time - previous)
    previous = time
  }
  return values
}
async function cycles(s: Scenario) {
  let maxActiveTasks = 0
  for (let i = 0; i < 20; i++) {
    await mount(s)
    // Update sampling settles asynchronously; unmount only after a task was actually registered.
    if (s.enabled !== false && s.points < 50000 && s.mode !== 'static') {
      for (let frame = 0; frame < 60 && !globalAnimator.getAnimationCount(); frame++) await raf()
      if (!globalAnimator.getAnimationCount())
        throw new Error(`No animation observed during mount/unmount cycle ${i}`)
    }
    maxActiveTasks = Math.max(maxActiveTasks, globalAnimator.getAnimationCount())
    app?.unmount()
    app = undefined
  }
  return {
    tasks: globalAnimator.getAnimationCount(),
    elements: host.childElementCount,
    maxActiveTasks,
  }
}
function unmount() {
  app?.unmount()
  app = undefined
  return { tasks: globalAnimator.getAnimationCount(), elements: host.childElementCount }
}
declare global {
  interface Window {
    animationBenchmark: {
      mount: typeof mount
      exportImage: typeof exportImage
      observe: typeof observe
      refresh: typeof refresh
      cycles: typeof cycles
      activeTasks: () => number
      unmount: typeof unmount
    }
  }
}
export const animationBenchmark = {
  mount,
  exportImage,
  observe,
  refresh,
  cycles,
  activeTasks: () => globalAnimator.getAnimationCount(),
  unmount,
}
window.animationBenchmark = animationBenchmark
