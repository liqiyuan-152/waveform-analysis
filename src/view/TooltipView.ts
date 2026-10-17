import type { WaveformHoverState } from '../components/core/types'
import { formatTooltipNumber, formatTooltipTime } from '../utils/formatters'
import { tooltipPlacement } from './tooltipPlacement'

interface TooltipRow {
  element: HTMLSpanElement
  color: HTMLElement
  colorValue?: string
  label: HTMLSpanElement
  value: HTMLSpanElement
}

/** Text-only content and owner-window measurement; never interprets consumer labels as markup. */
export class TooltipView {
  private element?: HTMLDivElement
  private observer?: ResizeObserver
  private state?: WaveformHoverState
  private container = { width: 0, height: 0 }
  private disposed = false
  private readonly rows = new Map<string, TooltipRow>()
  private bounds?: { width: number; height: number }

  constructor(private readonly root: HTMLElement) {}

  render(
    state: WaveformHoverState | undefined,
    timeUnit: 's' | 'ms',
    width: number,
    height: number,
  ) {
    if (this.disposed) return
    let changed = this.container.width !== width || this.container.height !== height
    this.state = state
    this.container = { width, height }
    if (!state?.points.some((item) => item.point)) {
      this.hide()
      return
    }
    if (!this.element) {
      this.element = this.root.ownerDocument.createElement('div')
      this.element.className = 'waveform-tooltip waveform-chart__tooltip'
      this.element.setAttribute('role', 'tooltip')
      this.root.append(this.element)
      const Observer = this.root.ownerDocument.defaultView?.ResizeObserver
      if (Observer) {
        this.observer = new Observer(this.measure)
        this.observer.observe(this.element)
      }
    }
    const ids = new Set(state.points.map((item) => item.id))
    for (const id of this.rows.keys()) {
      if (!ids.has(id)) this.rows.delete(id)
    }
    const elements = state.points.map((item) => {
      let row = this.rows.get(item.id)
      if (!row) {
        row = this.createRow()
        this.rows.set(item.id, row)
        changed = true
      }
      if (row.colorValue !== item.color) {
        row.color.style.backgroundColor = item.color
        row.colorValue = item.color
      }
      const label = `${item.shotNo?.trim() || '未配置炮号'}： ${item.name}${item.unit ? `(${item.unit})` : ''}`
      const value = item.point
        ? `(x:${formatTooltipTime(item.point.x, timeUnit)} y:${formatTooltipNumber(item.point.y)})`
        : '无数据'
      const valueClass = `waveform-tooltip__value${item.point ? '' : ' waveform-tooltip__value--missing'}`
      if (row.label.textContent !== label) {
        row.label.textContent = label
        changed = true
      }
      if (row.value.textContent !== value || row.value.className !== valueClass) {
        row.value.textContent = value
        row.value.className = valueClass
        changed = true
      }
      return row.element
    })
    if (
      elements.length !== this.element.children.length ||
      elements.some((element, index) => element !== this.element!.children[index])
    ) {
      this.element.replaceChildren(...elements)
      changed = true
    }
    this.element.style.maxWidth = `${Math.max(1, Math.min(560, width - 16))}px`
    if (changed || !this.bounds) this.measure()
    else this.place()
  }

  private createRow(): TooltipRow {
    const document = this.root.ownerDocument
    const element = document.createElement('span')
    element.className = 'waveform-tooltip__series waveform-chart__tooltip-series'
    const color = document.createElement('i')
    const content = document.createElement('span')
    content.className = 'waveform-tooltip__series-content'
    const label = document.createElement('span')
    label.className = 'waveform-tooltip__series-label'
    const value = document.createElement('span')
    content.append(label, value)
    element.append(color, content)
    return { element, color, label, value }
  }

  private readonly measure = () => {
    if (this.disposed || !this.element || !this.state) return
    this.bounds = this.element.getBoundingClientRect()
    this.place()
  }

  private place() {
    if (!this.element || !this.state || !this.bounds) return
    Object.assign(
      this.element.style,
      tooltipPlacement(this.state.position, this.bounds, this.container),
    )
  }

  private hide() {
    this.observer?.disconnect()
    this.observer = undefined
    this.element?.remove()
    this.element = undefined
    this.bounds = undefined
    this.rows.clear()
  }

  dispose() {
    this.disposed = true
    this.state = undefined
    this.hide()
  }
}
