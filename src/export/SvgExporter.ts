import { svgNode } from '../rendering/SvgDom'
import { copySvgStyles } from './svgSnapshotStyles'
import { SvgLegendExporter } from './SvgLegendExporter'
import { SvgTitleExporter } from './SvgTitleExporter'

export interface SvgSnapshotContext {
  container: HTMLElement
  width: number
  height: number
  titleHeight: number
}

/** Builds a standalone document; never mutates the live chart or retains its cloned nodes. */
export class SvgExporter {
  private readonly legends = new SvgLegendExporter()
  private readonly title = new SvgTitleExporter()

  serialize(source: SVGSVGElement, background?: string, context?: SvgSnapshotContext) {
    const document = source.ownerDocument
    const window = document.defaultView!
    const width = context?.width ?? Number(source.getAttribute('width'))
    const height = context?.height ?? Number(source.getAttribute('height'))
    const root = svgNode(document, 'svg', { width, height, viewBox: `0 0 ${width} ${height}` })
    const color =
      background ?? (context ? window.getComputedStyle(context.container).backgroundColor : '')
    root.append(svgNode(document, 'rect', { width, height, fill: color || '#fff' }))
    const clone = source.cloneNode(true) as SVGSVGElement
    copySvgStyles(source, clone)
    this.legends.replace(source, clone)
    clone
      .querySelectorAll(
        '.waveform-chart__overlay, .waveform-chart__hover-layer, .waveform-chart__zoom-selection',
      )
      .forEach((node) => node.remove())
    clone.removeAttribute('role')
    clone.removeAttribute('aria-label')
    clone.setAttribute('y', String(context?.titleHeight ?? 0))
    root.append(clone)
    if (context) {
      const title = this.title.snapshot(context.container, context.titleHeight, width)
      if (title) root.append(title)
    }
    // All paint/font properties are inline; host selectors must not affect standalone rendering.
    root.querySelectorAll('*').forEach((node) => {
      for (const name of node.getAttributeNames()) {
        if (name.startsWith('on')) node.removeAttribute(name)
      }
      node.removeAttribute('tabindex')
      node.removeAttribute('role')
      node.removeAttribute('aria-haspopup')
    })
    return new window.XMLSerializer().serializeToString(root)
  }
}
