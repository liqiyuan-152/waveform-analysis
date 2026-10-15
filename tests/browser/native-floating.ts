import { createApp, h, shallowRef, type App } from 'vue'
import { init, type WaveformChartInstance } from '../../src/native'
import WaveformAnnotationEditor from '../fixtures/legacy/components/annotation/WaveformAnnotationEditor.vue'
import '../fixtures/legacy/components/WaveformChart.css'
import '../../src/styles/native.css'

let charts: WaveformChartInstance[] = []
let app: App | undefined
const vueOpen = shallowRef(false)
let requests = 0
const annotation = { id: 'note', seriesId: 'a', x: 1, y: 1, text: '浮层验收' }
async function settle() {
  for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame)
}
function dispose() {
  charts.forEach((chart) => chart.dispose())
  charts = []
  app?.unmount()
  app = undefined
  vueOpen.value = false
  document.body.replaceChildren()
}
async function setup(width: number) {
  dispose()
  requests = 0
  document.body.style.cssText =
    'overflow-x: hidden !important; overflow-y: scroll !important; padding-right: 7px !important; color: rgb(30, 40, 50)'
  const trigger = document.createElement('button')
  trigger.id = 'outside'
  trigger.textContent = '外部按钮'
  document.body.append(trigger)
  for (let i = 0; i < 2; i++) {
    const host = document.createElement('div')
    host.id = `chart-${i}`
    document.body.append(host)
    const chart = init(host, {
      width,
      height: 280,
      annotations: [annotation],
      animationEnabled: false,
      grid: { rowCount: 1, columnCount: 1 },
      data: {
        kind: 'series',
        series: [
          {
            id: 'a',
            name: 'A',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
            },
          },
        ],
      },
    })
    chart.on('update:annotations', () => requests++)
    charts.push(chart)
  }
  const vueHost = document.createElement('div')
  document.body.append(vueHost)
  app = createApp({
    render: () =>
      vueOpen.value
        ? h(WaveformAnnotationEditor, {
            annotation: { ...annotation, id: 'vue-note' },
            mode: 'edit',
            onCancel: () => {
              vueOpen.value = false
            },
          })
        : null,
  })
  app.mount(vueHost)
  await settle()
}
function open(index: number) {
  const host = document.getElementById(`chart-${index}`)!
  host
    .querySelector('.waveform-annotation')!
    .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 }))
  host.querySelector<HTMLButtonElement>('.waveform-annotation-context-menu button')!.click()
  const dialog = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1)!
  dialog.dataset.owner = `native-${index}`
}
async function openVue() {
  vueOpen.value = true
  await settle()
  document.querySelector<HTMLDialogElement>('dialog:not([data-owner])')!.dataset.owner = 'vue'
}
async function disposeChart(index: number) {
  charts[index].dispose()
  await settle()
}
function state() {
  const active = document.activeElement as HTMLElement | null
  return {
    dialogs: [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].map(
      (dialog) => dialog.dataset.owner,
    ),
    focus: {
      owner: active?.closest('dialog')?.getAttribute('data-owner') ?? null,
      label: active?.getAttribute('aria-label') ?? null,
      id: active?.id ?? null,
    },
    overflow: document.body.style.overflow,
    overflowX: document.body.style.overflowX,
    overflowY: document.body.style.overflowY,
    overflowPriority: document.body.style.getPropertyPriority('overflow'),
    overflowXPriority: document.body.style.getPropertyPriority('overflow-x'),
    overflowYPriority: document.body.style.getPropertyPriority('overflow-y'),
    padding: document.body.style.paddingRight,
    paddingPriority: document.body.style.getPropertyPriority('padding-right'),
    requests,
  }
}
const probe = { setup, open, openVue, state, disposeChart, dispose, settle }
declare global {
  var nativeFloatingProbe: typeof probe
}
globalThis.nativeFloatingProbe = probe
// Desktop automation route opens a real editor through normal application initialization.
if (new URLSearchParams(location.search).has('system-palette')) void setup(1200).then(() => open(0))
