import type { TrackLayout, WaveformHoverState } from '../components/core/types'
import { setSvgAttributes, svgNode } from '../rendering/SvgDom'

let hoverSequence = 0
interface HoverLine {
  line: SVGLineElement
  clip: SVGClipPathElement
  rect: SVGRectElement
}

/** Each line is bounded by its business track, independent of animation presentation geometry. */
export class HoverView {
  private readonly root: SVGGElement
  private readonly defs: SVGDefsElement
  private readonly lines = new Map<string, HoverLine>()

  constructor(svg: SVGSVGElement) {
    this.root = svgNode(svg.ownerDocument, 'g', {
      class: 'waveform-chart__hover-layer',
      'pointer-events': 'none',
      'aria-hidden': 'true',
    })
    this.defs = svgNode(svg.ownerDocument, 'defs')
    this.root.append(this.defs)
    svg.insertBefore(this.root, svg.querySelector('.waveform-chart__legends'))
  }

  render(state: WaveformHoverState | undefined, tracks: TrackLayout[], left = 0, top = 0) {
    const active = new Set<string>()
    setSvgAttributes(this.root, { transform: `translate(${left},${top})` })
    if (state?.queryX !== null && state) {
      for (const track of tracks) {
        const x = state.crosshairXByTrack[track.index]
        if (
          x === undefined ||
          track.isEmpty ||
          !track.hasVisibleSeries ||
          (state.trackIndex !== null && state.trackIndex !== track.index)
        )
          continue
        active.add(track.id)
        let entry = this.lines.get(track.id)
        if (!entry) {
          const clipId = `waveform-hover-${++hoverSequence}`
          const clip = svgNode(this.root.ownerDocument, 'clipPath', { id: clipId })
          const rect = svgNode(this.root.ownerDocument, 'rect')
          clip.append(rect)
          this.defs.append(clip)
          const line = svgNode(this.root.ownerDocument, 'line', {
            class: 'waveform-track__crosshair waveform-chart__crosshair',
            'clip-path': `url(#${clipId})`,
          })
          entry = { line, clip, rect }
          this.lines.set(track.id, entry)
          this.root.append(line)
        }
        setSvgAttributes(entry.rect, { width: track.width, height: track.height })
        const pixel = track.xScale(x)
        setSvgAttributes(entry.line, {
          transform: `translate(${track.left},${track.top})`,
          x1: pixel,
          x2: pixel,
          y1: 0,
          y2: track.height,
          'data-track-id': track.id,
        })
      }
    }
    for (const [id, entry] of this.lines)
      if (!active.has(id)) {
        entry.line.remove()
        entry.clip.remove()
        this.lines.delete(id)
      }
  }

  dispose() {
    this.lines.clear()
    this.root.remove()
  }
}
