import type { ChartLayoutSnapshot } from '../layout/ChartLayoutEngine'
import type { ResolvedWaveformChartProps } from '../types/options'
import { TrackView } from '../view/TrackView'
import { orderSvgChildren, setSvgAttributes, svgNode } from './SvgDom'
import { createFrameNumberResolver } from '../components/core/trackPagination'
import { getPageSize, normalizeGridOptions } from '../components/core/grid'
import { compactFramePath } from '../components/rendering/compactFrame'
import { updateMaximumTickVisibility } from '../components/rendering/yAxisTickVisibility'
import { resolveFrameStyle } from './presentationOptions'
import { LegendView } from '../view/LegendView'
import { TitleView } from '../view/TitleView'
import { PaginationView } from '../view/PaginationView'

let instanceSequence = 0

/** Owns the SVG root; each view owns its nodes and survives stable-ID updates. */
export class SvgChartRenderer {
  readonly svg: SVGSVGElement
  private readonly title: TitleView
  private readonly pagination: PaginationView
  private readonly xLabel: SVGTextElement
  private readonly empty: SVGTextElement
  private readonly defs: SVGDefsElement
  private readonly plot: SVGGElement
  private readonly legendLayer: SVGGElement
  private readonly legends = new Map<string, LegendView>()
  private readonly tracks = new Map<string, TrackView>()
  private readonly instanceId = ++instanceSequence
  private trackSequence = 0
  private disposed = false
  private readonly onFontsLoaded = () => {
    if (!this.disposed) {
      updateMaximumTickVisibility(this.svg)
      this.onMeasurementChange()
    }
  }

  constructor(
    private readonly root: HTMLElement,
    private readonly toggleSeries: (id: string) => void = () => {},
    private readonly onMeasurementChange: () => void = () => {},
    changePage: (page: number) => void = () => {},
  ) {
    this.title = new TitleView(root)
    this.svg = svgNode(root.ownerDocument, 'svg', {
      class: 'waveform-chart__svg',
      // Interactive descendants must remain exposed to the accessibility tree.
      role: 'group',
      'aria-label': '波形图表',
    })
    this.defs = svgNode(root.ownerDocument, 'defs')
    this.plot = svgNode(root.ownerDocument, 'g', { class: 'waveform-chart__plot' })
    this.legendLayer = svgNode(root.ownerDocument, 'g', { class: 'waveform-chart__legends' })
    this.svg.append(this.defs, this.plot, this.legendLayer)
    this.xLabel = svgNode(root.ownerDocument, 'text', {
      class: 'waveform-chart__label waveform-chart__x-label',
      'text-anchor': 'middle',
    })
    this.empty = svgNode(root.ownerDocument, 'text', {
      class: 'waveform-chart__empty',
      'text-anchor': 'middle',
    })
    this.empty.textContent = '暂无有效波形数据'
    this.svg.append(this.xLabel, this.empty)
    root.append(this.svg)
    this.pagination = new PaginationView(root, changePage)
    root.ownerDocument.fonts?.addEventListener?.('loadingdone', this.onFontsLoaded)
    void root.ownerDocument.fonts?.ready.then(this.onFontsLoaded)
  }

  measureTitle(width: number, options: ResolvedWaveformChartProps) {
    return this.title.update(width, options)
  }

  remeasureTitle(width: number, options: ResolvedWaveformChartProps, previousHeight?: number) {
    if (!this.disposed && this.measureTitle(width, options) !== previousHeight)
      this.onMeasurementChange()
  }

  isStable() {
    return this.svg.ownerDocument.fonts?.status !== 'loading'
  }

  render(
    layout: ChartLayoutSnapshot,
    options: ResolvedWaveformChartProps,
    hidden: ReadonlySet<string> = new Set(),
  ) {
    setSvgAttributes(this.root, {
      'data-display-mode': options.displayMode,
      'data-overlay-mode': options.overlayMode,
      'data-presentation-mode': String(options.presentationMode),
      'data-chart-left-margin': layout.left,
      'data-plot-margin-top': layout.top,
      'data-plot-margin-bottom': layout.drawingHeight - layout.top - layout.innerHeight,
      'data-title-area-height': layout.titleHeight,
    })
    this.root.classList.toggle('waveform-chart--scrollable', layout.renderedWidth > layout.width)
    this.root.classList.toggle('waveform-chart--clean', options.cleanView)
    this.root.classList.toggle(
      'waveform-chart--edge-compact',
      options.layoutPreset === 'edge-compact',
    )
    this.root.classList.toggle('waveform-chart--presentation', options.presentationMode)
    this.pagination.setTheme(options.controlTheme)
    this.pagination.render(layout)
    this.title.alignToPlot(layout.left, layout.innerWidth, options)
    setSvgAttributes(this.svg, {
      width: layout.renderedWidth,
      height: layout.drawingHeight,
      viewBox: `0 0 ${layout.renderedWidth} ${layout.drawingHeight}`,
    })
    if (
      layout.width <= 0 ||
      layout.height <= 0 ||
      layout.innerWidth <= 0 ||
      layout.innerHeight <= 0
    )
      return false
    this.plot.setAttribute('transform', `translate(${layout.left},${layout.top})`)
    this.legendLayer.setAttribute('transform', `translate(${layout.left},${layout.top})`)
    const xLabel = options.xLabel ?? `时间（${options.timeUnit}）`
    this.xLabel.textContent = xLabel
    this.xLabel.style.display = xLabel && !options.cleanView ? '' : 'none'
    this.xLabel.style.fontSize =
      options.layoutPreset === 'edge-compact' ? `${options.title?.textStyle?.fontSize ?? 14}px` : ''
    setSvgAttributes(this.xLabel, {
      x: layout.left + layout.innerWidth / 2,
      y: Math.max(0, layout.drawingHeight - 12 + (options.layoutPreset === 'edge-compact' ? 3 : 0)),
    })
    const hasSamples = layout.tracks.some((track) =>
      track.series.some((series) => (series.source?.length ?? series.points.length) > 0),
    )
    this.svg.setAttribute('aria-label', hasSamples ? '波形折线图' : '暂无波形数据')
    this.empty.style.display = hasSamples ? 'none' : ''
    setSvgAttributes(this.empty, { x: layout.renderedWidth / 2, y: layout.drawingHeight / 2 })
    const active = new Set(layout.trackLayouts.map((track) => track.id))
    const hideTitles =
      options.unitDisplayMode === 'channel-label-or-legend' &&
      layout.trackLayouts.some((track) => track.legendSeries.length > 1)
    const resolveFrameNumber = createFrameNumberResolver(
      () => options.frameNumber,
      () => options.frameNumbers,
      () => layout.tracks,
    )
    const frameInset =
      options.layoutPreset === 'edge-compact'
        ? resolveFrameStyle(options.frameStyle).borderWidth / 2
        : 0
    for (const [id, view] of this.tracks)
      if (!active.has(id)) {
        view.dispose()
        this.tracks.delete(id)
      }
    const orderedTracks: Element[] = []
    for (const track of layout.trackLayouts) {
      let view = this.tracks.get(track.id)
      if (!view) {
        view = new TrackView(
          this.plot,
          this.defs,
          `waveform-native-${this.instanceId}-${++this.trackSequence}`,
        )
        this.tracks.set(track.id, view)
      }
      view.render(track, options, {
        hideTitles,
        frameNumber: resolveFrameNumber(
          track.id,
          (layout.page - 1) * getPageSize(normalizeGridOptions(options.grid)) + track.index,
        ),
        framePath:
          options.displayMode === 'compact'
            ? compactFramePath(track, layout.trackLayouts, frameInset)
            : undefined,
      })
      orderedTracks.push(view.root)
    }
    orderSvgChildren(this.plot, orderedTracks)
    updateMaximumTickVisibility(this.svg)
    const legendTracks = options.cleanView
      ? []
      : layout.trackLayouts.filter(
          (track) => !track.isEmpty && (track.legendSeries.length > 1 || hideTitles),
        )
    const legendIds = new Set(legendTracks.map((track) => track.id))
    for (const [id, view] of this.legends)
      if (!legendIds.has(id)) {
        view.dispose()
        this.legends.delete(id)
      }
    const showUnits =
      options.unitDisplayMode === 'channel-label-or-legend' ||
      (options.unitDisplayMode === 'legend-single-series' &&
        !layout.tracks.some((track) => track.series.length > 1))
    for (const track of legendTracks) {
      let view = this.legends.get(track.id)
      if (!view) {
        view = new LegendView(this.legendLayer, this.toggleSeries)
        this.legends.set(track.id, view)
      }
      view.render(track, options, hidden, showUnits)
    }
    return true
  }

  dispose() {
    this.disposed = true
    this.svg.ownerDocument.fonts?.removeEventListener?.('loadingdone', this.onFontsLoaded)
    for (const view of this.tracks.values()) view.dispose()
    this.tracks.clear()
    for (const view of this.legends.values()) view.dispose()
    this.legends.clear()
    this.title.dispose()
    this.pagination.dispose()
    this.svg.remove()
  }
}
