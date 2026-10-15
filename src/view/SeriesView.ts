import type { TrackLayout, TrackSeriesPath } from '../components/core/types'
import { waveformLineDasharray } from '../components/rendering/seriesStyle'
import { updateSvgAttribute } from '../components/rendering/updateAxis'
import { seriesGeometry } from '../rendering/geometry/seriesGeometry'
import { setSvgAttributes, svgNode } from '../rendering/SvgDom'

export class SeriesView {
  readonly root: SVGGElement
  private readonly line: SVGPathElement
  private readonly points: SVGPathElement
  private readonly errors: SVGPathElement
  private animationDefs?: SVGDefsElement
  private animationClip?: SVGClipPathElement
  private animationRect?: SVGRectElement

  constructor(parent: SVGGElement, seriesId: string) {
    const document = parent.ownerDocument
    this.root = svgNode(document, 'g', {
      class: 'waveform-track__series-item waveform-chart__series',
      'data-series-id': seriesId,
    })
    this.line = svgNode(document, 'path', {
      class: 'waveform-track__line waveform-chart__line',
      fill: 'none',
      'stroke-width': 1,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    })
    this.points = svgNode(document, 'path', {
      class: 'waveform-track__point waveform-chart__point',
      'pointer-events': 'none',
    })
    this.errors = svgNode(document, 'path', {
      class: 'waveform-track__error-bar waveform-chart__error-bar',
      fill: 'none',
      'pointer-events': 'none',
    })
    this.root.append(this.line, this.errors, this.points)
    parent.append(this.root)
  }

  render(path: TrackSeriesPath, track: TrackLayout) {
    const series = path.series
    const geometry = seriesGeometry(path, track)
    setSvgAttributes(this.root, { opacity: path.opacity ?? 1 })
    this.renderAnimationClip(path.animationClip, track.height)
    updateSvgAttribute(this.root, 'data-series-name', series.name || null)
    setSvgAttributes(this.line, {
      d: path.path ?? '',
      stroke: series.color,
      'data-series-id': series.id,
      'data-y-axis-index': path.yAxisIndex,
      'data-line-type': series.lineType,
      'data-line-style': series.lineStyle,
    })
    updateSvgAttribute(this.line, 'display', path.path ? null : 'none')
    updateSvgAttribute(this.line, 'data-series-name', series.name || null)
    updateSvgAttribute(
      this.line,
      'stroke-dasharray',
      waveformLineDasharray(series.lineStyle) ?? null,
    )
    setSvgAttributes(this.points, {
      d: geometry.pointPath ?? '',
      fill: series.color,
      'data-series-id': series.id,
      'data-point-type': series.pointType,
    })
    updateSvgAttribute(this.points, 'display', geometry.pointPath ? null : 'none')
    setSvgAttributes(this.errors, {
      d: geometry.errorBarPath ?? '',
      stroke: series.errorBar.color || series.color,
      'stroke-width': series.errorBar.width,
      'data-series-id': series.id,
    })
    updateSvgAttribute(
      this.errors,
      'display',
      series.errorBar.visible && geometry.errorBarPath ? null : 'none',
    )
  }

  private renderAnimationClip(clip: TrackSeriesPath['animationClip'], height: number) {
    if (!clip) {
      this.animationDefs?.remove()
      this.animationDefs = undefined
      this.animationClip = undefined
      this.animationRect = undefined
      this.root.removeAttribute('clip-path')
      return
    }
    if (!this.animationDefs) {
      const document = this.root.ownerDocument
      this.animationDefs = svgNode(document, 'defs')
      this.animationClip = svgNode(document, 'clipPath', { clipPathUnits: 'userSpaceOnUse' })
      this.animationRect = svgNode(document, 'rect')
      this.animationClip.append(this.animationRect)
      this.animationDefs.append(this.animationClip)
      this.root.prepend(this.animationDefs)
    }
    setSvgAttributes(this.animationClip!, { id: clip.id })
    setSvgAttributes(this.animationRect!, { x: clip.x, width: clip.width, height })
    this.root.setAttribute('clip-path', `url(#${clip.id})`)
  }

  dispose() {
    this.root.remove()
  }
}
