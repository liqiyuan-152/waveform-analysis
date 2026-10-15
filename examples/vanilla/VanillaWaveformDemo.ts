import {
  init,
  type WaveformAnnotation,
  type WaveformChartInstance,
  type WaveformData,
  type WaveformInteractionMode,
} from 'waveform-analysis/native'
import { ExampleImageDownload } from '../shared/ExampleImageDownload'
import { diagnostics } from '../shared/diagnostics'

/** A consumer class owns controlled values, subscriptions and its DOM lifecycle. */
export class VanillaWaveformDemo {
  readonly root: HTMLElement
  private readonly host: HTMLDivElement
  private readonly controls: HTMLDivElement
  private readonly state: HTMLParagraphElement
  private readonly chart: WaveformChartInstance
  private readonly download: ExampleImageDownload
  private readonly subscriptions: Array<() => void>
  private annotations: WaveformAnnotation[] = []
  private hiddenSeriesIds: string[] = []
  private interactionMode: WaveformInteractionMode = 'zoom'
  private disposed = false

  constructor(parent: HTMLElement, data: WaveformData, onRendered: () => void) {
    const document = parent.ownerDocument
    this.root = document.createElement('section')
    this.root.className = 'example-chart'
    this.controls = document.createElement('div')
    this.controls.className = 'example-controls'
    this.controls.setAttribute('aria-label', '图表操作')
    this.state = document.createElement('p')
    this.state.className = 'example-state'
    this.state.setAttribute('aria-live', 'polite')
    const message = document.createElement('p')
    message.className = 'example-export-status'
    message.setAttribute('role', 'status')
    this.host = document.createElement('div')
    this.host.className = 'example-host'
    this.root.append(this.controls, this.state, message, this.host)
    parent.append(this.root)
    this.chart = init(this.host, {
      data,
      animationEnabled: false,
      toolbar: true,
      pannable: true,
      legend: { interactive: true },
      grid: { rowCount: 1, columnCount: 1 },
      annotations: this.annotations,
      hiddenSeriesIds: this.hiddenSeriesIds,
      interactionMode: this.interactionMode,
    })
    diagnostics.mounted(this.host)
    this.subscriptions = [
      this.chart.on('rendered', onRendered),
      this.chart.on('update:annotations', (value) => {
        this.annotations = value
        this.commit()
      }),
      this.chart.on('update:hidden-series-ids', (value) => {
        this.hiddenSeriesIds = value
        this.commit()
      }),
      this.chart.on('update:interactionMode', (value) => {
        this.interactionMode = value
        this.commit()
      }),
    ]
    this.download = new ExampleImageDownload(this.chart, document, (text, busy) => {
      message.textContent = text
      for (const button of this.controls.querySelectorAll<HTMLButtonElement>('[data-export]'))
        button.disabled = busy
    })
    this.button('放大', () => this.chart.zoomIn())
    this.button('缩小', () => this.chart.zoomOut())
    this.button('重置视口', () => this.chart.resetViewport())
    this.button('显示全部', () => this.chart.fitToData())
    for (const [mode, label] of [
      ['zoom', '缩放模式'],
      ['pan', '平移模式'],
      ['annotation', '标注模式'],
    ] as const) {
      const button = this.button(label, () => {
        this.interactionMode = mode
        this.commit()
      })
      button.dataset.mode = mode
    }
    this.button('切换通道 2', () => {
      this.hiddenSeriesIds = this.hiddenSeriesIds.includes('b') ? [] : ['b']
      this.commit()
    })
    this.button('清空标注', () => {
      this.annotations = []
      this.commit()
    })
    for (const format of ['svg', 'png'] as const)
      this.button(`导出 ${format.toUpperCase()}`, () => this.download.save(format)).dataset.export =
        format
    this.commit()
  }

  private button(label: string, action: () => unknown) {
    const button = this.root.ownerDocument.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.onclick = () => {
      if (!this.disposed) void action()
    }
    this.controls.append(button)
    return button
  }

  private commit() {
    if (this.disposed) return
    this.chart.setOption({
      annotations: this.annotations,
      hiddenSeriesIds: this.hiddenSeriesIds,
      interactionMode: this.interactionMode,
    })
    this.state.textContent = `标注 ${this.annotations.length} 条；隐藏 ${this.hiddenSeriesIds.length} 个通道；模式 ${this.interactionMode}`
    for (const button of this.controls.querySelectorAll<HTMLButtonElement>('[data-mode]'))
      button.setAttribute('aria-pressed', String(button.dataset.mode === this.interactionMode))
  }

  setData(data: WaveformData) {
    if (!this.disposed) this.chart.setOption({ data })
  }

  resize(narrow: boolean) {
    if (this.disposed) return
    this.host.style.width = narrow ? '360px' : '100%'
    this.chart.resize()
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.subscriptions.forEach((cancel) => cancel())
    this.download.dispose()
    for (const button of this.controls.querySelectorAll('button')) button.onclick = null
    this.chart.dispose()
    diagnostics.unmounted(this.chart)
    this.root.remove()
  }
}
