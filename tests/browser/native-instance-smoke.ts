import { init, getInstanceByDom } from '../../src/native'
import '../../src/styles/native.css'
import type { WaveformData } from '../../src/types/data'
import type { WaveformSamplingDiagnostics } from '../../src/types/chart'

const host = document.getElementById('chart')!
const data: WaveformData = {
  kind: 'series',
  series: ['a', 'b'].map((id, index) => ({
    id,
    name: `通道 ${index + 1}`,
    unit: 'V',
    data: {
      kind: 'samples',
      sampleRate: 1000,
      values: Array.from({ length: 10000 }, (_, i) => Math.sin(i / (40 + index * 20))),
    },
  })),
}
const chart = init(host, { data, animationEnabled: false })
const revisions: number[] = []
chart.on('finished', ({ revision }) => revisions.push(revision))
const samplingDiagnostics: WaveformSamplingDiagnostics[] = []
chart.on('sampling-complete', (diagnostic) => samplingDiagnostics.push(diagnostic))

async function stable() {
  // The native stable barrier must work even if finished already fired before export started.
  const blob = await chart.exportImage({ format: 'svg' })
  return blob.text()
}

const api = {
  stable,
  async pagination(width: number, layoutPreset: 'default' | 'edge-compact') {
    host.style.width = `${width}px`
    chart.setOption({
      data: {
        kind: 'series',
        series: Array.from({ length: 12 }, (_, index) => ({
          id: `page-${index}`,
          name: `分页通道 ${index + 1}`,
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ],
          },
        })),
      },
      title: undefined,
      initialXDomain: undefined,
      layoutPreset,
      grid: { rowCount: 1, columnCount: 1, showPagination: true },
      rendering: { sampling: { mode: 'raw' } },
      cleanView: false,
      hiddenSeriesIds: [],
    })
    chart.resize()
    await stable()
    host.querySelector<HTMLButtonElement>('[aria-label="第 1 页"]')!.click()
    await stable()
    const next = host.querySelector<HTMLButtonElement>('[aria-label="下一页"]')!
    next.focus()
    next.click()
    await stable()
    if (
      document.activeElement !== next ||
      host.querySelector('[aria-current="page"]')?.textContent !== '2'
    )
      throw new Error('pagination lost focus or did not advance')
    host.querySelector<HTMLButtonElement>('[aria-label="向后 5 页"]')!.click()
    await stable()
    if (host.querySelector('[aria-current="page"]')?.textContent !== '7')
      throw new Error('page jump failed')
    const nav = host.querySelector<HTMLElement>('.waveform-pagination')!
    const rect = nav.getBoundingClientRect()
    const hostRect = host.getBoundingClientRect()
    if (rect.left < hostRect.left || rect.right > hostRect.right || rect.bottom > hostRect.bottom)
      throw new Error('pagination overflowed the small container')
    const svgHeight = Number(host.querySelector('svg.waveform-chart__svg')?.getAttribute('height'))
    const band = layoutPreset === 'edge-compact' ? 16 : width <= 520 ? 40 : 0
    const rootHeight = host.querySelector<HTMLElement>('.waveform-native-chart')!.clientHeight
    if (svgHeight !== rootHeight - band) throw new Error(`pagination band differs: ${svgHeight}`)
    chart.setOption({ cleanView: true })
    await stable()
    if (nav.getBoundingClientRect().height !== 0) throw new Error('clean pagination still visible')
    chart.setOption({ cleanView: false })
    await stable()
    return {
      width,
      layoutPreset,
      page: nav.querySelector('[aria-current="page"]')?.textContent,
      svgHeight,
    }
  },
  async samplingProbe() {
    chart.setOption({
      data: {
        kind: 'typed-samples',
        sampleRate: 1000,
        values: Float64Array.from({ length: 50000 }, (_, index) =>
          index === 23456 ? 1000 : Math.sin(index / 20),
        ),
      },
      rendering: { sampling: { mode: 'wasm', strategy: 'peak', maxPointCount: 64 } },
    })
    await stable()
    await new Promise((resolve) => setTimeout(resolve, 150))
    const diagnostic = samplingDiagnostics.at(-1)
    if (diagnostic?.backend !== 'wasm' || diagnostic.renderedPointCount > 68)
      throw new Error(`native Worker/WASM sampling not active: ${JSON.stringify(diagnostic)}`)
    // Style-only changes must reuse the settled sampling result rather than launch another task.
    const before = samplingDiagnostics.length
    chart.setOption({ lineColor: '#123456' })
    await stable()
    await new Promise((resolve) => setTimeout(resolve, 150))
    if (samplingDiagnostics.length !== before) throw new Error('style update repeated sampling')
    const result = { ...diagnostic }
    chart.setOption({ rendering: undefined })
    await stable()
    return result
  },
  async resize(width: number) {
    host.style.width = `${width}px`
    chart.resize()
    return stable()
  },
  async exercise() {
    if (init(host) !== chart || getInstanceByDom(host) !== chart)
      throw new Error('registry identity')
    const svg = host.querySelector('svg')
    const line = host.querySelector('.waveform-chart__line')
    chart.setOption({ lineColor: 'red' })
    await stable()
    if (host.querySelector('svg') !== svg || host.querySelector('.waveform-chart__line') !== line)
      throw new Error('stable nodes replaced')
    chart.setOption({
      data: {
        kind: 'points',
        points: [
          { x: 10, y: -2 },
          { x: 20, y: 2 },
        ],
      },
    })
    chart.setViewportDomain([12, 14])
    const domain = chart.getControlState().targets[0]?.viewport.xDomain
    if (domain?.[0] !== 12 || domain[1] !== 14) throw new Error('stale command data')
    const snapshot = await stable()
    const parsed = new DOMParser().parseFromString(snapshot, 'image/svg+xml')
    if (parsed.querySelector('parsererror')) throw new Error('invalid SVG export')
    const png = await chart.exportImage({ format: 'png', scale: 2 })
    const url = URL.createObjectURL(png)
    try {
      const image = new Image()
      image.src = url
      await image.decode()
      if (image.naturalWidth !== Number(svg?.getAttribute('width')) * 2)
        throw new Error('PNG dimensions')
    } finally {
      URL.revokeObjectURL(url)
    }
    const count = revisions.length
    host.style.display = 'none'
    chart.resize()
    await new Promise((resolve) => setTimeout(resolve, 50))
    if (revisions.length !== count) throw new Error('hidden finished event')
    host.style.display = ''
    chart.resize()
    await stable()
    const root = host.querySelector<HTMLElement>('.waveform-native-chart')!
    root.style.maxWidth = '280px'
    root.style.maxHeight = '220px'
    chart.resize()
    await stable()
    if (
      Number(host.querySelector('svg')?.getAttribute('width')) !== root.clientWidth ||
      Number(host.querySelector('svg')?.getAttribute('height')) !== root.clientHeight
    )
      throw new Error('CSS constrained dimensions ignored')
    root.style.maxWidth = ''
    root.style.maxHeight = ''
    chart.resize()
    await stable()
    return { svgLength: snapshot.length, pngBytes: png.size, domain, revisions }
  },
  async cycles() {
    for (let index = 0; index < 30; index++) {
      const container = document.createElement('div')
      container.style.cssText = 'width: 360px; height: 200px'
      const child = document.createElement('span')
      container.append(child)
      document.body.append(container)
      const instance = init(container, { data, animationEnabled: false })
      await instance.exportImage({ format: 'svg' })
      instance.dispose()
      if (
        container.firstChild !== child ||
        container.childElementCount !== 1 ||
        getInstanceByDom(container)
      )
        throw new Error('lifecycle residue')
      container.remove()
    }
    return { cycles: 30, roots: document.querySelectorAll('.waveform-native-chart').length }
  },
  async visual(width: number) {
    host.style.width = `${width}px`
    chart.setOption({
      data: {
        kind: 'series',
        series: ['a', 'b'].map((id, index) => ({
          id,
          trackId: 'voltage',
          name: `电压通道 ${index + 1}`,
          unit: 'V',
          lineStyle: index ? 'dash-dot' : 'solid',
          pointType: index ? 'diamond' : 'circle',
          errorBar: { visible: true },
          data: {
            kind: 'points',
            points: Array.from({ length: 25 }, (_, point) => ({
              x: point / 24,
              y: Math.sin(point / 3 + index),
              error: 0.12,
            })),
          },
        })),
      },
      title: { text: '原生波形 · 图层与单位验证', textStyle: { fontSize: 18 } },
      initialXDomain: [0, 1],
      grid: { rowCount: 1, columnCount: 1 },
      unitDisplayMode: 'channel-label-or-legend',
      legend: { position: 'top-right', interactive: true },
      frameNumber: 'A01',
      cleanView: false,
      layoutPreset: 'default',
      hiddenSeriesIds: undefined,
    })
    chart.resize()
    await stable()
    const button = host.querySelector<HTMLButtonElement>('.waveform-chart__legend-item')!
    button.focus()
    chart.setOption({ lineColor: '#0960bd' })
    await stable()
    if (document.activeElement !== button) throw new Error('legend update lost keyboard focus')
    button.click()
    await stable()
    if (button.getAttribute('aria-pressed') !== 'false') throw new Error('legend toggle failed')
    button.click()
    await stable()
    if (button.getAttribute('aria-pressed') !== 'true') throw new Error('legend restore failed')
    if (!host.querySelector('.waveform-chart__zero-line')) throw new Error('zero-line missing')
    const root = host.querySelector<HTMLElement>('.waveform-native-chart')!
    const title = host.querySelector<HTMLElement>('.waveform-chart__title-area')!
    const svg = host.querySelector('svg')!
    const rootBox = root.getBoundingClientRect()
    const titleBox = title.getBoundingClientRect()
    const svgBox = svg.getBoundingClientRect()
    if (Math.abs(titleBox.height + svgBox.height - rootBox.height) > 3)
      throw new Error('title and SVG exceed available chart height')
    return {
      width,
      titleHeight: titleBox.height,
      drawingHeight: svgBox.height,
      points: host.querySelectorAll('.waveform-chart__point').length,
      errors: host.querySelectorAll('.waveform-chart__error-bar').length,
    }
  },
}

declare global {
  interface Window {
    nativeInstanceSmoke: typeof api
  }
}
window.nativeInstanceSmoke = api
