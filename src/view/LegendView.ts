import type { TrackLayout } from '../components/core/types'
import type { ResolvedWaveformChartProps } from '../types/options'
import { formatChannelLabel } from '../components/rendering/channelLabel'
import {
  waveformLegendErrorBarPath,
  waveformLegendLinePath,
  waveformLineDasharray,
  waveformPointSymbolPath,
  waveformPointSymbolArea,
} from '../components/rendering/seriesStyle'
import { setSvgAttributes, svgNode } from '../rendering/SvgDom'
import { updateSvgAttribute } from '../components/rendering/updateAxis'

interface LegendItem {
  item: HTMLDivElement
  button: HTMLButtonElement
  label: HTMLSpanElement
  swatch: SVGSVGElement
  line: SVGPathElement
  error: SVGPathElement
  point: SVGPathElement
}

export class LegendView {
  readonly root: SVGGElement
  private readonly foreign: SVGForeignObjectElement
  private readonly viewport: HTMLDivElement
  private readonly panel: HTMLDivElement
  private readonly items = new Map<string, LegendItem>()
  private interactive = false

  constructor(
    parent: SVGGElement,
    private readonly toggle: (id: string) => void,
  ) {
    const document = parent.ownerDocument
    this.root = svgNode(document, 'g', { class: 'waveform-chart__legend-track' })
    this.foreign = svgNode(document, 'foreignObject', {
      class: 'waveform-legend waveform-chart__legend',
      x: 0,
      y: 0,
      'aria-label': '曲线图例',
    })
    this.viewport = document.createElement('div')
    this.panel = document.createElement('div')
    this.panel.setAttribute('role', 'list')
    this.viewport.append(this.panel)
    this.foreign.append(this.viewport)
    this.root.append(this.foreign)
    parent.append(this.root)
  }

  render(
    track: TrackLayout,
    options: ResolvedWaveformChartProps,
    hidden: ReadonlySet<string>,
    showUnits: boolean,
  ) {
    const position =
      options.legend.trackPositions?.[track.id] ?? options.legend.position ?? 'top-right'
    const configured = options.legend.orientation ?? 'auto'
    const orientation =
      configured === 'auto'
        ? position === 'top' || position === 'bottom'
          ? 'horizontal'
          : 'vertical'
        : configured
    this.interactive = options.legend.interactive === true
    setSvgAttributes(this.root, {
      transform: `translate(${track.left},${track.top})`,
      'data-legend-track-index': track.index,
      'data-legend-track-id': track.id,
    })
    setSvgAttributes(this.foreign, {
      width: track.width,
      height: track.height,
      'data-position': position,
      'data-orientation': orientation,
    })
    this.viewport.className = `waveform-legend__viewport waveform-legend__viewport--${position}`
    this.panel.className = `waveform-legend__panel waveform-legend__panel--${orientation}${this.interactive ? ' waveform-legend__panel--interactive' : ''}`
    this.panel.style.backgroundColor = options.legend.backgroundColor || 'transparent'
    const active = new Set(track.legendSeries.map((series) => series.id))
    for (const [id, item] of this.items)
      if (!active.has(id)) {
        item.button.onclick = null
        item.item.remove()
        this.items.delete(id)
      }
    let previous: HTMLDivElement | undefined
    for (const series of track.legendSeries) {
      let item = this.items.get(series.id)
      if (!item) {
        item = this.createItem(series.id)
        this.items.set(series.id, item)
      }
      const isHidden = hidden.has(series.id)
      item.button.className = `waveform-legend__item waveform-chart__legend-item${isHidden ? ' is-hidden' : ''}`
      item.button.disabled = !this.interactive
      updateSvgAttribute(item.button, 'aria-pressed', this.interactive ? String(!isHidden) : null)
      updateSvgAttribute(
        item.button,
        'aria-label',
        this.interactive ? `${isHidden ? '显示' : '隐藏'}曲线 ${series.name}` : null,
      )
      const label = showUnits ? formatChannelLabel(series.name, series.unit, ' ') : series.name
      item.label.textContent = label
      item.label.title = label
      setSvgAttributes(item.swatch, {
        'data-line-type': series.lineType,
        'data-line-style': series.lineStyle,
        'data-point-type': series.pointType,
        'data-error-bar-visible': String(series.errorBar.visible),
      })
      const linePath = waveformLegendLinePath(series.lineType)
      setSvgAttributes(item.line, { d: linePath ?? '', stroke: series.color })
      updateSvgAttribute(item.line, 'display', linePath ? null : 'none')
      updateSvgAttribute(
        item.line,
        'stroke-dasharray',
        waveformLineDasharray(series.lineStyle) ?? null,
      )
      setSvgAttributes(item.error, {
        d: waveformLegendErrorBarPath(series.errorBar.capWidth),
        stroke: series.errorBar.color || series.color,
        'stroke-width': series.errorBar.width,
      })
      updateSvgAttribute(item.error, 'display', series.errorBar.visible ? null : 'none')
      setSvgAttributes(item.point, {
        d:
          waveformPointSymbolPath(series.pointType, waveformPointSymbolArea(series.pointSize)) ??
          '',
        fill: series.color,
      })
      updateSvgAttribute(item.point, 'display', series.pointType === 'none' ? 'none' : null)
      const next = previous ? previous.nextSibling : this.panel.firstChild
      if (next !== item.item) this.panel.insertBefore(item.item, next)
      previous = item.item
    }
  }

  private createItem(id: string): LegendItem {
    const document = this.root.ownerDocument
    const button = document.createElement('button')
    button.type = 'button'
    const item = document.createElement('div')
    item.setAttribute('role', 'listitem')
    item.className = 'waveform-legend__list-item'
    item.append(button)
    button.setAttribute('data-series-id', id)
    button.onclick = (event) => {
      event.stopPropagation()
      if (this.interactive) this.toggle(id)
    }
    const swatch = svgNode(document, 'svg', {
      class: 'waveform-legend__swatch',
      viewBox: '0 0 26 16',
      'aria-hidden': 'true',
    })
    const line = svgNode(document, 'path', {
      class: 'waveform-legend__line',
      fill: 'none',
      'stroke-width': 1,
    })
    const error = svgNode(document, 'path', {
      class: 'waveform-legend__error-bar',
      fill: 'none',
      'stroke-linecap': 'butt',
    })
    const point = svgNode(document, 'path', {
      class: 'waveform-legend__point',
      transform: 'translate(13 8)',
    })
    swatch.append(line, error, point)
    const label = document.createElement('span')
    label.className = 'waveform-legend__label'
    button.append(swatch, label)
    return { item, button, swatch, line, error, point, label }
  }

  dispose() {
    for (const item of this.items.values()) item.button.onclick = null
    this.items.clear()
    this.root.remove()
  }
}
