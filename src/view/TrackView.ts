import type { TrackLayout } from '../components/core/types'
import type { ResolvedWaveformChartProps } from '../types/options'
import { orderSvgChildren, setSvgAttributes, svgNode } from '../rendering/SvgDom'
import { resolveFrameStyle, resolveZeroLine } from '../rendering/presentationOptions'
import { SeriesView } from './SeriesView'
import { AxisView } from './AxisView'
import { GridView } from './GridView'
import { ZeroLineView } from './ZeroLineView'

export interface TrackPresentation {
  hideTitles: boolean
  frameNumber?: string | number
  framePath?: string
}

export class TrackView {
  readonly root: SVGGElement
  private readonly clip: SVGClipPathElement
  private readonly clipRect: SVGRectElement
  private readonly background: SVGRectElement
  private readonly frame: SVGPathElement
  private readonly watermark: SVGTextElement
  private readonly empty: SVGTextElement
  private readonly geometry: SVGGElement
  private readonly axes: AxisView
  private readonly grid: GridView
  private readonly zero: ZeroLineView
  private readonly series = new Map<string, SeriesView>()

  constructor(parent: SVGGElement, defs: SVGDefsElement, clipId: string) {
    const document = parent.ownerDocument
    this.root = svgNode(document, 'g', { class: 'waveform-track waveform-chart__track' })
    this.clip = svgNode(document, 'clipPath', { id: clipId })
    this.clipRect = svgNode(document, 'rect')
    this.clip.append(this.clipRect)
    defs.append(this.clip)
    this.background = svgNode(document, 'rect', {
      class: 'waveform-track__plot-background waveform-chart__plot-background',
      'aria-hidden': 'true',
    })
    this.root.append(this.background)
    this.grid = new GridView(this.root, clipId)
    this.watermark = svgNode(document, 'text', {
      class: 'waveform-track__watermark waveform-chart__watermark',
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'aria-hidden': 'true',
    })
    this.root.append(this.watermark)
    this.axes = new AxisView(this.root)
    this.frame = svgNode(document, 'path', {
      class: 'waveform-track__plot-frame waveform-chart__plot-frame',
      fill: 'none',
      'aria-hidden': 'true',
    })
    this.geometry = svgNode(document, 'g', {
      class: 'waveform-track__series',
      'clip-path': `url(#${clipId})`,
    })
    this.root.append(this.frame, this.geometry)
    this.zero = new ZeroLineView(this.root, clipId)
    this.empty = svgNode(document, 'text', {
      class: 'waveform-track__no-visible-series',
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
    })
    this.empty.textContent = '暂无可见曲线'
    this.root.append(this.empty)
    parent.append(this.root)
  }

  render(track: TrackLayout, options: ResolvedWaveformChartProps, presentation: TrackPresentation) {
    const frame = resolveFrameStyle(options.frameStyle)
    const inset = options.layoutPreset === 'edge-compact' ? frame.borderWidth / 2 : 0
    const right = Math.max(inset, track.width - inset)
    const bottom = Math.max(inset, track.height - inset)
    setSvgAttributes(this.root, {
      transform: `translate(${track.left},${track.top})`,
      'data-track-id': track.id,
      'data-track-index': track.index,
      'data-track-height': track.height,
      'data-track-width': track.width,
      'data-track-top': track.top,
      'data-track-left': track.left,
      'data-y-axis-label-x': track.yAxisLabelX,
    })
    this.root.classList.toggle('waveform-track--empty', track.isEmpty)
    this.root.classList.toggle('waveform-chart__track--empty', track.isEmpty)
    if (track.isEmpty) this.root.setAttribute('data-track-empty', 'true')
    else this.root.removeAttribute('data-track-empty')
    setSvgAttributes(this.clipRect, { width: track.width, height: track.height })
    setSvgAttributes(this.background, {
      width: track.width,
      height: track.height,
      fill: frame.backgroundColor,
    })
    this.background.style.display = options.cleanView ? 'none' : ''
    this.grid.render(track, options.cleanView)
    this.watermark.textContent = String(presentation.frameNumber ?? '')
    this.watermark.style.display =
      !options.cleanView &&
      presentation.frameNumber !== undefined &&
      (track.hasVisibleSeries || track.isEmpty)
        ? ''
        : 'none'
    setSvgAttributes(this.watermark, { x: track.width / 2, y: track.height / 2 })
    this.watermark.style.fontSize = `${Math.min(120, track.height * 0.65)}px`
    setSvgAttributes(this.frame, {
      d: presentation.framePath ?? `M${inset},${inset}H${right}V${bottom}H${inset}Z`,
      stroke: frame.borderColor,
      'stroke-width': frame.borderWidth,
      'stroke-dasharray':
        frame.borderStyle === 'dashed' ? '6 4' : frame.borderStyle === 'dotted' ? '1 3' : undefined,
      'stroke-linecap': frame.borderStyle === 'dotted' ? 'round' : 'butt',
    })
    this.axes.render(track, options, presentation.hideTitles)
    this.zero.render(track, resolveZeroLine(options.zeroLine), options.cleanView)
    setSvgAttributes(this.empty, { x: track.width / 2, y: track.height / 2 })
    this.empty.style.display =
      !track.isEmpty && !track.hasVisibleSeries && !options.cleanView ? '' : 'none'
    const active = new Set(track.seriesPaths.map((path) => path.presentationKey ?? path.series.id))
    for (const [id, view] of this.series)
      if (!active.has(id)) {
        view.dispose()
        this.series.delete(id)
      }
    const orderedSeries: Element[] = []
    for (const path of track.seriesPaths) {
      const key = path.presentationKey ?? path.series.id
      let view = this.series.get(key)
      if (!view) {
        view = new SeriesView(this.geometry, path.series.id)
        this.series.set(key, view)
      }
      view.render(path, track)
      orderedSeries.push(view.root)
    }
    orderSvgChildren(this.geometry, orderedSeries)
  }

  dispose() {
    for (const view of this.series.values()) view.dispose()
    this.series.clear()
    this.axes.dispose()
    this.grid.dispose()
    this.zero.dispose()
    this.clip.remove()
    this.root.remove()
  }
}
