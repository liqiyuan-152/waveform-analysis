import type { TrackLayout } from '../components/core/types'
import type { WaveformZeroLineOptions } from '../types/chart'
import { setSvgAttributes, svgNode } from '../rendering/SvgDom'

export class ZeroLineView {
  readonly root: SVGGElement
  private readonly lines = new Map<number, SVGLineElement>()

  constructor(parent: SVGGElement, clipId: string) {
    this.root = svgNode(parent.ownerDocument, 'g', {
      class: 'waveform-track__zero-lines waveform-chart__zero-lines',
      'clip-path': `url(#${clipId})`,
      'aria-hidden': 'true',
      'pointer-events': 'none',
    })
    parent.append(this.root)
  }

  render(track: TrackLayout, options: Required<WaveformZeroLineOptions>, clean: boolean) {
    const active = new Set<number>()
    if (!clean && !track.isEmpty && track.hasVisibleSeries && options.visible)
      for (const axis of track.yAxes) {
        const [min, max] = axis.scale.domain()
        const margin = Math.abs(axis.tickValues[1] - axis.tickValues[0]) * options.boundaryThreshold
        if (min >= 0 || max <= 0 || -min < margin || max < margin) continue
        active.add(axis.index)
        let line = this.lines.get(axis.index)
        if (!line) {
          line = svgNode(this.root.ownerDocument, 'line', {
            class: 'waveform-track__zero-line waveform-chart__zero-line',
            'data-y-axis-index': axis.index,
          })
          this.lines.set(axis.index, line)
          this.root.append(line)
        }
        setSvgAttributes(line, {
          x1: 0,
          x2: track.width,
          y1: axis.scale(0),
          y2: axis.scale(0),
          stroke: options.color,
          'stroke-opacity': options.opacity,
          'stroke-width': options.width,
          'stroke-dasharray': options.dash || undefined,
        })
      }
    for (const [index, line] of this.lines)
      if (!active.has(index)) {
        line.remove()
        this.lines.delete(index)
      }
  }

  dispose() {
    this.lines.clear()
    this.root.remove()
  }
}
