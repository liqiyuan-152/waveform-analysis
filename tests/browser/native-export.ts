import { init, type WaveformChartInstance } from '../../src/native'
import type { WaveformDisplayMode } from '../../src/types/chart'
import '../../src/styles/native.css'

let chart: WaveformChartInstance | undefined
const urls = new Set<string>()
const create = URL.createObjectURL.bind(URL)
const revoke = URL.revokeObjectURL.bind(URL)
URL.createObjectURL = (blob) => {
  const url = create(blob)
  urls.add(url)
  return url
}
URL.revokeObjectURL = (url) => {
  urls.delete(url)
  revoke(url)
}
const settle = async () => {
  for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame)
}
async function setup(width: number, displayMode: WaveformDisplayMode) {
  chart?.dispose()
  document.body.replaceChildren()
  const host = document.createElement('div')
  host.id = 'chart'
  document.body.append(host)
  chart = init(host, {
    width,
    height: 420,
    displayMode,
    animationEnabled: false,
    title: { text: '中文标题：波形导出', textStyle: { color: '#123456', rotation: 10 } },
    toolbar: { display: 'always' },
    grid: { rowCount: 1, columnCount: 1 },
    annotations: [{ id: 'note', seriesId: 'a', x: 1, y: 0.5, text: '中文标注' }],
    hiddenSeriesIds: ['b'],
    rendering: { sampling: { mode: 'raw' } },
    data: {
      kind: 'series',
      series: ['a', 'b', 'c'].map((id, index) => ({
        id,
        trackId: id === 'c' ? 'second' : 'first',
        name: `通道${id}`,
        color: index ? '#dc2626' : '#2563eb',
        pointType: 'circle',
        lineStyle: 'dashed',
        errorBar: { visible: true },
        data: {
          kind: 'points',
          points: [
            { x: 0, y: 0, error: 0.2 },
            { x: 1, y: 0.5, error: 0.1 },
            { x: 2, y: -0.3 },
          ],
        },
      })),
    },
  })
  await settle()
}
async function api() {
  const svg = await chart!.exportImage({ format: 'svg', backgroundColor: '#fff' })
  const png = await chart!.exportImage({ format: 'png', scale: 2, backgroundColor: '#fff' })
  const url = URL.createObjectURL(png)
  const image = new Image()
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = reject
      image.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let colored = 0
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i]! < 240 || pixels[i + 1]! < 240 || pixels[i + 2]! < 240) colored++
    let bytes = ''
    for (const byte of new Uint8Array(await png.arrayBuffer())) bytes += String.fromCharCode(byte)
    return {
      contentWidth: document.querySelector<HTMLElement>('.waveform-chart')!.clientWidth,
      contentHeight: document.querySelector<HTMLElement>('.waveform-chart')!.clientHeight,
      svg: await svg.text(),
      png: btoa(bytes),
      width: image.naturalWidth,
      height: image.naturalHeight,
      colored,
    }
  } finally {
    URL.revokeObjectURL(url)
    image.src = ''
  }
}
function failNextPng() {
  const original = HTMLCanvasElement.prototype.toBlob
  HTMLCanvasElement.prototype.toBlob = function (callback) {
    HTMLCanvasElement.prototype.toBlob = original
    callback(null)
  }
}
Object.assign(globalThis, {
  nativeExportProbe: {
    setup,
    api,
    settle,
    failNextPng,
    resourceCount: () => urls.size,
    dispose: () => chart?.dispose(),
  },
})
