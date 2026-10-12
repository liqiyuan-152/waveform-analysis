import { createApp, h, nextTick, shallowRef } from 'vue'
import WaveformChart from '../src/components/WaveformChart.vue'
import type { WaveformData, WaveformSamplingDiagnostics, WaveformSamplingError } from '../src/types'

const NativeWorker = window.Worker
const rejected: string[] = []
window.addEventListener('unhandledrejection', (event) => rejected.push(String(event.reason)))
const wait = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms))
let app: ReturnType<typeof createApp> | undefined
const data = shallowRef<WaveformData>({ kind: 'points', points: [] })
let diagnostics: WaveformSamplingDiagnostics[] = []
let errors: WaveformSamplingError[] = []
let workers = 0
let terminations = 0
let messages = 0
function input(offset = 0): WaveformData {
  return {
    kind: 'series',
    series: [
      {
        id: 'signal',
        name: 'Signal',
        data: {
          kind: 'typed-samples',
          values: Float64Array.from({ length: 10000 }, (_, i) => Math.sin(i / 30) + offset),
          sampleRate: 1000,
        },
      },
    ],
  }
}
async function settle() {
  for (let i = 0; i < 100 && !diagnostics.length; i++) await wait(50)
}
async function scenario(
  mode: 'auto' | 'wasm' | 'raw',
  fallback: 'javascript' | 'error',
  fault: boolean | 'wasm',
  width: number,
) {
  app?.unmount()
  diagnostics = []
  errors = []
  workers = 0
  terminations = 0
  messages = 0
  window.Worker = class extends NativeWorker {
    constructor(url: string | URL, options?: WorkerOptions) {
      super(
        fault
          ? URL.createObjectURL(
              new Blob(
                [
                  fault === 'wasm'
                    ? `const queued = []; globalThis.onmessage = event => queued.push(event); const originalFetch = fetch; globalThis.fetch = (url, ...args) => String(url).includes('.wasm') ? Promise.reject(new Error('injected WASM fetch failure')) : originalFetch(url, ...args); await import(${JSON.stringify(String(url))}); for (const event of queued) globalThis.onmessage(event);`
                    : 'throw new Error("injected Worker failure")',
                ],
                { type: 'text/javascript' },
              ),
            )
          : url,
        options,
      )
      workers++
    }
    postMessage(message: unknown) {
      messages++
      super.postMessage(message)
    }
    terminate() {
      terminations++
      super.terminate()
    }
  }
  const container = document.getElementById('chart')!
  container.style.width = `${width}px`
  data.value = input()
  app = createApp({
    render: () =>
      h(WaveformChart, {
        data: data.value,
        title: { text: `${mode}/${fallback} ${fault ? '故障' : '正常'} ${width}px` },
        height: 400,
        initialXDomain: [2, 8],
        rendering: {
          sampling: { mode, wasmFailureFallback: fallback, maxPointCount: 100, autoThreshold: 10 },
        },
        onSamplingComplete: (value: WaveformSamplingDiagnostics) => diagnostics.push(value),
        onSamplingError: (value: WaveformSamplingError) => errors.push(value),
      }),
  })
  app.mount(container)
  await settle()
  const first = {
    diagnostics: [...diagnostics],
    errors: [...errors],
    path: container.querySelector('.waveform-chart__line')?.getAttribute('d'),
  }
  // Rapid data-reference replacement invalidates requests and retains the latest session only.
  diagnostics = []
  errors = []
  for (let i = 1; i <= 5; i++) {
    data.value = input(i)
    await nextTick()
  }
  await settle()
  const svg = container.querySelector(
    '.waveform-chart__overlay--shared, .waveform-chart__overlay--independent',
  )!
  const bounds = svg.getBoundingClientRect()
  const beforeZoomCount = diagnostics.at(-1)?.visiblePointCount
  for (let i = 0; i < 10; i++)
    svg.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -20,
        clientX: bounds.left + bounds.width / 2,
        clientY: bounds.top + bounds.height / 2,
        bubbles: true,
        cancelable: true,
      }),
    )
  await wait()
  const result = {
    beforeZoomCount,
    mode,
    fallback,
    fault,
    width,
    first,
    last: diagnostics.at(-1),
    errors,
    workers,
    messages,
    rejected: [...rejected],
    path: container.querySelector('.waveform-chart__line')?.getAttribute('d'),
  }
  return result
}
async function crossing(
  lineType: 'linear' | 'step-start' | 'step-middle' | 'step-end' | 'step-after',
  width: number,
) {
  app?.unmount()
  window.Worker = NativeWorker
  const container = document.getElementById('chart')!
  container.style.width = `${width}px`
  app = createApp({
    render: () =>
      h(WaveformChart, {
        height: 400,
        initialXDomain: [2, 8],
        data: {
          kind: 'series',
          series: [
            {
              id: 's',
              name: 'Crossing',
              lineType,
              data: {
                kind: 'points',
                points: [
                  { x: 0, y: 0 },
                  { x: 10, y: 10 },
                ],
              },
            },
          ],
        },
        rendering: { sampling: { mode: 'raw' } },
      }),
  })
  app.mount(container)
  await nextTick()
  await wait()
  return {
    lineType,
    width,
    path: container.querySelector('.waveform-chart__line')?.getAttribute('d'),
  }
}
async function dispose() {
  const before = diagnostics.length
  app?.unmount()
  app = undefined
  await wait()
  window.Worker = NativeWorker
  return { lateDiagnostics: diagnostics.length - before, workers, terminations, rejected }
}
Object.assign(window, { reliability: { scenario, crossing, dispose } })

async function presentation(width: number, displayMode: 'separated' | 'independent') {
  app?.unmount()
  window.Worker = NativeWorker
  const container = document.getElementById('chart')!
  container.style.width = `${width}px`
  const source = () => ({
    kind: 'series' as const,
    series: Array.from({ length: 6 }, (_, i) => ({
      id: `s${i}`,
      trackId: `t${Math.floor(i / 2)}`,
      name: `Channel ${i}`,
      data: {
        kind: 'points' as const,
        points: [
          { x: 0, y: i },
          { x: 5, y: i + 1 },
          { x: 10, y: i },
        ],
      },
    })),
  })
  data.value = source()
  const chart = shallowRef<InstanceType<typeof WaveformChart>>()
  const pages: number[] = []
  app = createApp({
    render: () =>
      h(WaveformChart, {
        ref: chart,
        data: data.value,
        height: 400,
        displayMode,
        grid: { rowCount: 1, columnCount: 1 },
        legend: { interactive: true },
        annotations: [{ id: 'note', seriesId: 's0', x: 5, y: 1, text: 'Keep annotation' }],
        rendering: { sampling: { mode: 'raw' } },
        onPageChange: (page: number) => pages.push(page),
      }),
  })
  app.mount(container)
  await wait()
  const before = {
    ids: [...container.querySelectorAll('.waveform-chart__line')].map((n) =>
      n.getAttribute('data-series-id'),
    ),
    annotation: !!container.querySelector('[data-annotation-id="note"]'),
  }
  ;(container.querySelector('.ant-pagination-next button') as HTMLElement).click()
  await wait()
  const next = [...container.querySelectorAll('.waveform-chart__line')].map((n) =>
    n.getAttribute('data-series-id'),
  )
  ;(container.querySelector('.ant-pagination-prev button') as HTMLElement).click()
  await wait()
  ;(container.querySelector('.waveform-chart__legend-item') as HTMLElement).click()
  await wait()
  const hidden = {
    paths: container.querySelectorAll('.waveform-chart__line').length,
    annotation: !!container.querySelector('[data-annotation-id="note"]'),
  }
  ;(container.querySelector('.waveform-chart__legend-item') as HTMLElement).click()
  await wait()
  chart.value!.setViewportDomain([2, 8])
  await wait()
  const ticks = () =>
    [...container.querySelectorAll('.waveform-chart__axis-endpoint')].map((n) => n.textContent)
  const zoomed = ticks()
  data.value = source()
  await wait()
  const restored = ticks()
  return {
    width,
    displayMode,
    before,
    next,
    pages,
    hidden,
    annotationRestored: !!container.querySelector('[data-annotation-id="note"]'),
    zoomed,
    restored,
  }
}
Object.assign((window as unknown as { reliability: object }).reliability, { presentation })
