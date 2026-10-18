import { svgNode } from '../../shared/dom/svg'
import { ViewRegistry } from './views/ViewRegistry.js'
import type { RenderContext } from './context.js'
import { select } from 'd3'

/** Owns exactly one root; host content is never queried or cleared. */
export class SvgRenderer {
  readonly root: SVGSVGElement
  private readonly views = new ViewRegistry()
  private plotNode?: SVGGElement
  private clipRect?: SVGRectElement

  constructor(container: HTMLElement) {
    this.root = svgNode(container.ownerDocument, 'svg')
    container.append(this.root)
  }

  prepare(width: number, height: number, displayWidth: string | number = '100%') {
    if (!this.plotNode) this.root.replaceChildren()
    return select(this.root)
      .attr('width', displayWidth)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('xmlns', 'http://www.w3.org/2000/svg')
  }

  plot(clipId: string, width: number, height: number, left: number, top: number) {
    if (!this.plotNode) {
      const svg = select(this.root)
      this.clipRect = svg
        .append('defs')
        .append('clipPath')
        .attr('id', clipId)
        .append('rect')
        .node()!
      this.plotNode = svg.append('g').node()!
    }
    select(this.clipRect!).attr('width', width).attr('height', height)
    return select(this.plotNode).attr('transform', `translate(${left},${top})`)
  }

  draw(context: RenderContext) {
    try {
      this.views.update(context)
    } catch (error) {
      this.clear()
      throw error
    }
  }

  clear() {
    this.views.destroy()
    this.root.replaceChildren()
    this.plotNode = undefined
    this.clipRect = undefined
  }

  serialize(): string {
    const realm = this.root.ownerDocument.defaultView as Window & typeof globalThis
    return new realm.XMLSerializer().serializeToString(this.root)
  }

  destroy() {
    this.clear()
    this.root.remove()
  }
}
