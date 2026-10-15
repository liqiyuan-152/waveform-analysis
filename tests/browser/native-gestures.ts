import { createApp, h, shallowRef, type App, type ShallowRef } from 'vue'
import { init, type WaveformChartInstance, type WaveformChartEvents } from '../../src/native'
import type { WaveformChartHandle } from '../../src/types/controls'
import type { WaveformChartOptions, WaveformChartOptionUpdate } from '../../src/types/options'
import type { WaveformData } from '../../src/types/data'
import WaveformChart from '../support/LegacyWaveformChart.vue'
import '../../src/styles/native.css'

let native: WaveformChartInstance | undefined
let vue: WaveformChartHandle | undefined
let app: App | undefined
let vueOptions: ShallowRef<WaveformChartOptions> | undefined
let replaceOnIntent = false
let nativeEvents: Record<string, unknown[][]> = {}
let vueEvents: Record<string, unknown[][]> = {}
let nativeHover: unknown = null
let vueHover: unknown = null
let nativeControlEvents: Record<string, unknown[][]> = {}
let vueControlEvents: Record<string, unknown[][]> = {}
let nativeAnnotationEvents: Record<string, unknown[][]> = {}
let vueAnnotationEvents: Record<string, unknown[][]> = {}
const names = ['zoom-intent', 'zoom-change', 'zoom-end', 'pan-end'] as const

function record(destination: Record<string, unknown[][]>, name: string, args: unknown[]) {
  ;(destination[name] ??= []).push(args)
}
function dispose() {
  native?.dispose()
  app?.unmount()
  document.body.replaceChildren()
  native = undefined
  vue = undefined
}
async function settle() {
  for (let turn = 0; turn < 4; turn++) await new Promise(requestAnimationFrame)
}
async function setup(
  width: number,
  displayMode: 'independent' | 'separated' | 'compact',
  extra: WaveformChartOptions = {},
) {
  dispose()
  nativeEvents = {}
  vueEvents = {}
  replaceOnIntent = false
  nativeHover = null
  vueHover = null
  nativeControlEvents = {}
  vueControlEvents = {}
  nativeAnnotationEvents = {}
  vueAnnotationEvents = {}
  const options = {
    width,
    height: 320,
    displayMode,
    data: {
      kind: 'series',
      series: ['a', 'b'].map((id, i) => ({
        id,
        name: id,
        data: {
          kind: 'points',
          points: Array.from({ length: 101 }, (_, n) => ({ x: n / 10, y: (i + 1) * Math.sin(n) })),
        },
      })),
    },
    animationEnabled: false,
    pannable: true,
    xDomainStrategy: { type: 'data' },
    rendering: { sampling: { mode: 'raw' } },
    ...extra,
  } satisfies WaveformChartOptions
  const host = document.createElement('div'),
    vueHost = document.createElement('div')
  host.id = 'native'
  vueHost.id = 'vue'
  document.body.append(host, vueHost)
  native = init(host, options)
  for (const name of [
    'update:annotations',
    'annotation-create',
    'annotation-update',
    'annotation-delete',
  ] as const)
    native.on(name, (...args: WaveformChartEvents[typeof name]) =>
      record(nativeAnnotationEvents, name, args),
    )
  native.on('point-hover', (point) => {
    nativeHover = point
  })
  for (const name of [
    'control-state-change',
    'update:interactionMode',
    'interaction-mode-change',
    'update:hidden-series-ids',
    'series-visibility-change',
    'zoom-reset',
  ] as const)
    native.on(name, (...args: WaveformChartEvents[typeof name]) =>
      record(nativeControlEvents, name, args),
    )
  vueOptions = shallowRef<WaveformChartOptions>(options)
  for (const name of names)
    native.on(name, (...args: WaveformChartEvents[typeof name]) => record(nativeEvents, name, args))
  native.on('zoom-intent', () => {
    if (replaceOnIntent) native!.setOption({ data: windowData(40, 201, ['b', 'a']) })
  })
  app = createApp({
    render: () =>
      h(WaveformChart, {
        ...vueOptions!.value,
        data: vueOptions!.value.data!,
        ref: (instance) => {
          vue = instance as unknown as WaveformChartHandle
        },
        onZoomIntent: (...args: unknown[]) => {
          record(vueEvents, 'zoom-intent', args)
          if (replaceOnIntent)
            vueOptions!.value = { ...vueOptions!.value, data: windowData(40, 201, ['b', 'a']) }
        },
        onZoomChange: (...args: unknown[]) => record(vueEvents, 'zoom-change', args),
        onZoomEnd: (...args: unknown[]) => record(vueEvents, 'zoom-end', args),
        onPanEnd: (...args: unknown[]) => record(vueEvents, 'pan-end', args),
        onPointHover: (point: unknown) => {
          vueHover = point
        },
        onControlStateChange: (...args: unknown[]) =>
          record(vueControlEvents, 'control-state-change', args),
        'onUpdate:interactionMode': (...args: unknown[]) =>
          record(vueControlEvents, 'update:interactionMode', args),
        onInteractionModeChange: (...args: unknown[]) =>
          record(vueControlEvents, 'interaction-mode-change', args),
        'onUpdate:hiddenSeriesIds': (...args: unknown[]) =>
          record(vueControlEvents, 'update:hidden-series-ids', args),
        onSeriesVisibilityChange: (...args: unknown[]) =>
          record(vueControlEvents, 'series-visibility-change', args),
        onZoomReset: (...args: unknown[]) => record(vueControlEvents, 'zoom-reset', args),
        'onUpdate:annotations': (...args: unknown[]) =>
          record(vueAnnotationEvents, 'update:annotations', args),
        onAnnotationCreate: (...args: unknown[]) =>
          record(vueAnnotationEvents, 'annotation-create', args),
        onAnnotationUpdate: (...args: unknown[]) =>
          record(vueAnnotationEvents, 'annotation-update', args),
        onAnnotationDelete: (...args: unknown[]) =>
          record(vueAnnotationEvents, 'annotation-delete', args),
      }),
  })
  app.mount(vueHost)
  await settle()
}
function snapshot() {
  return {
    native: native!.getControlState(),
    vue: vue!.getControlState(),
    nativeEvents,
    vueEvents,
  }
}
function windowData(start: number, count: number, ids = ['a', 'b']): WaveformData {
  return {
    kind: 'series',
    series: ids.map((id) => ({
      id,
      name: id,
      data: {
        kind: 'points',
        points: Array.from({ length: count }, (_, n) => ({ x: start + n / 10, y: Math.sin(n) })),
      },
    })),
  }
}
async function patch(options: WaveformChartOptionUpdate) {
  native!.setOption(options)
  vueOptions!.value = { ...vueOptions!.value, ...options }
  await settle()
}
async function remote(width: number, displayMode: 'independent' | 'separated' | 'compact') {
  await setup(width, displayMode, {
    data: windowData(0, 1001),
    initialXDomain: [0, 100],
    panXDomain: [-100, 200],
    maxZoomScale: null,
    minVisiblePoints: 0,
    minZoomSpan: 0.01,
  })
  replaceOnIntent = true
}
async function hoverSetup(width: number, displayMode: 'independent' | 'separated' | 'compact') {
  await setup(width, displayMode, {
    timeUnit: 'ms',
    initialXDomain: [-1, 1],
    data: {
      kind: 'series',
      series: [
        {
          id: 'a',
          name: '完整通道-很长的显示名称-ENG8KJXAc',
          shotNo: '炮 7',
          unit: 'A',
          data: {
            kind: 'points',
            points: [
              { x: -1, y: 1 },
              { x: 0, y: 2 },
              { x: 1, y: 3 },
            ],
          },
        },
        {
          id: 'b',
          name: '短通道',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 10 },
              { x: 1, y: 20 },
            ],
          },
        },
      ],
    },
  })
}
async function domain(value: [number, number]) {
  native!.setViewportDomain(value)
  vue!.setViewportDomain(value)
  await settle()
}
async function mode(value: 'zoom' | 'pan' | 'none' | 'annotation') {
  const result = { native: native!.setInteractionMode(value), vue: vue!.setInteractionMode(value) }
  await settle()
  return result
}
async function command(value: 'zoom-in' | 'zoom-out' | 'fit' | 'reset') {
  function run(chart: WaveformChartHandle) {
    if (value === 'zoom-in') return chart.zoomIn()
    if (value === 'zoom-out') return chart.zoomOut()
    if (value === 'fit') return chart.fitToData()
    return chart.resetViewport({})
  }
  const result = { native: run(native!), vue: run(vue!) }
  await settle()
  return result
}
function controlSnapshot() {
  return { ...snapshot(), nativeControlEvents, vueControlEvents }
}
function annotationSnapshot() {
  function view(id: string) {
    return [...document.querySelectorAll(`#${id} .waveform-annotation`)].map((node) => {
      const box = node.querySelector('rect')!,
        arrow = node.querySelector('line')!
      return {
        id: node.getAttribute('data-annotation-id'),
        text: node.querySelector('text')!.textContent,
        box: Object.fromEntries(
          ['x', 'y', 'width', 'height'].map((key) => [key, Number(box.getAttribute(key))]),
        ),
        arrow: Object.fromEntries(
          ['x1', 'y1', 'x2', 'y2'].map((key) => [key, Number(arrow.getAttribute(key))]),
        ),
        fill: box.getAttribute('fill'),
        stroke: box.getAttribute('stroke'),
      }
    })
  }
  return { native: view('native'), vue: view('vue'), nativeAnnotationEvents, vueAnnotationEvents }
}
function hoverSnapshot(id: 'native' | 'vue') {
  const root = document.getElementById(id)!.firstElementChild!
  const tooltip = root.querySelector('.waveform-tooltip')
  const bounds = tooltip?.getBoundingClientRect()
  const container = root.getBoundingClientRect()
  return {
    point: id === 'native' ? nativeHover : vueHover,
    labels: [...root.querySelectorAll('.waveform-tooltip__series-label')].map(
      (node) => node.textContent,
    ),
    values: [...root.querySelectorAll('.waveform-tooltip__value')].map((node) => node.textContent),
    crosshairs: root.querySelectorAll('.waveform-chart__crosshair').length,
    placement: bounds
      ? {
          left: bounds.left - container.left,
          right: bounds.right - container.left,
          top: bounds.top - container.top,
          bottom: bounds.bottom - container.top,
          width: bounds.width,
          height: bounds.height,
          containerWidth: container.width,
          containerHeight: container.height,
        }
      : null,
  }
}
const probe = {
  setup,
  settle,
  snapshot,
  dispose,
  patch,
  remote,
  windowData,
  hoverSetup,
  hoverSnapshot,
  domain,
  mode,
  command,
  controlSnapshot,
  annotationSnapshot,
}
declare global {
  var nativeGesturesProbe: typeof probe
}
globalThis.nativeGesturesProbe = probe
