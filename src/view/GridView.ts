import type { TrackLayout } from '../components/core/types'
import { updateGrid } from '../components/rendering/updateGrid'
import { svgNode } from '../rendering/SvgDom'

export class GridView {
  readonly root: SVGGElement
  private readonly minorVertical: SVGGElement
  private readonly minorHorizontal: SVGGElement
  private readonly majorVertical: SVGGElement
  private readonly majorHorizontal: SVGGElement

  constructor(parent: SVGGElement, clipId: string) {
    const document = parent.ownerDocument
    this.root = svgNode(document, 'g', {
      'clip-path': `url(#${clipId})`,
      'aria-hidden': 'true',
    })
    const minor = svgNode(document, 'g', {
      class:
        'waveform-track__grid waveform-track__grid--minor waveform-chart__grid waveform-chart__grid--minor',
    })
    const major = svgNode(document, 'g', {
      class:
        'waveform-track__grid waveform-track__grid--major waveform-chart__grid waveform-chart__grid--major',
    })
    this.minorVertical = svgNode(document, 'g')
    this.minorHorizontal = svgNode(document, 'g')
    this.majorVertical = svgNode(document, 'g')
    this.majorHorizontal = svgNode(document, 'g')
    minor.append(this.minorVertical, this.minorHorizontal)
    major.append(this.majorVertical, this.majorHorizontal)
    this.root.append(minor, major)
    parent.append(this.root)
  }

  render(track: TrackLayout, clean: boolean) {
    this.root.style.display = clean ? 'none' : ''
    for (const [element, direction, ticks] of [
      [this.minorVertical, 'vertical', track.xMinorTicks],
      [this.minorHorizontal, 'horizontal', track.yMinorTicks],
      [this.majorVertical, 'vertical', track.xMajorTicks],
      [this.majorHorizontal, 'horizontal', track.yMajorTicks],
    ] as const) {
      updateGrid(
        element,
        track.gridLines[direction] ? ticks : [],
        direction === 'vertical' ? track.xScale : track.yScale,
        direction,
        direction === 'vertical' ? track.height : track.width,
        direction === 'vertical' ? track.gridLines.verticalColor : track.gridLines.horizontalColor,
      )
    }
  }

  dispose() {
    this.root.remove()
  }
}
