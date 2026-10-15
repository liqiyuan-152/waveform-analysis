import type { WaveformHoverState } from '../components/core/types'
import { formatTooltipNumber, formatTooltipTime } from '../utils/formatters'
import { tooltipPlacement } from './tooltipPlacement'

/** Text-only content and owner-window measurement; never interprets consumer labels as markup. */
export class TooltipView {
  private element?: HTMLDivElement
  private observer?: ResizeObserver
  private state?: WaveformHoverState
  private container = { width: 0, height: 0 }
  private disposed = false

  constructor(private readonly root: HTMLElement) {}

  render(
    state: WaveformHoverState | undefined,
    timeUnit: 's' | 'ms',
    width: number,
    height: number,
  ) {
    if (this.disposed) return
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
    const document = this.root.ownerDocument
    const rows = state.points.map((item) => {
      const row = document.createElement('span')
      row.className = 'waveform-tooltip__series waveform-chart__tooltip-series'
      const color = document.createElement('i')
      color.style.backgroundColor = item.color
      const content = document.createElement('span')
      content.className = 'waveform-tooltip__series-content'
      const label = document.createElement('span')
      label.className = 'waveform-tooltip__series-label'
      label.textContent = `${item.shotNo?.trim() || '未配置炮号'}： ${item.name}${item.unit ? `(${item.unit})` : ''}`
      const value = document.createElement('span')
      value.className = `waveform-tooltip__value${item.point ? '' : ' waveform-tooltip__value--missing'}`
      value.textContent = item.point
        ? `(x:${formatTooltipTime(item.point.x, timeUnit)} y:${formatTooltipNumber(item.point.y)})`
        : '无数据'
      content.append(label, value)
      row.append(color, content)
      return row
    })
    this.element.replaceChildren(...rows)
    this.element.style.maxWidth = `${Math.max(1, Math.min(560, width - 16))}px`
    this.measure()
  }

  private readonly measure = () => {
    if (this.disposed || !this.element || !this.state) return
    const bounds = this.element.getBoundingClientRect()
    Object.assign(this.element.style, tooltipPlacement(this.state.position, bounds, this.container))
  }

  private hide() {
    this.observer?.disconnect()
    this.observer = undefined
    this.element?.remove()
    this.element = undefined
  }

  dispose() {
    this.disposed = true
    this.state = undefined
    this.hide()
  }
}
