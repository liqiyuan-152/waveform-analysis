import { svgNode } from '../rendering/SvgDom'
import { copySvgStyles } from './svgSnapshotStyles'

export class SvgLegendExporter {
  replace(source: SVGSVGElement, clone: SVGSVGElement) {
    const document = source.ownerDocument
    const window = document.defaultView!
    const originals = source.querySelectorAll('foreignObject')
    clone.querySelectorAll('foreignObject').forEach((foreign, index) => {
      const original = originals[index]!
      const origin = original.getBoundingClientRect()
      const group = svgNode(document, 'g', {
        class: 'waveform-export-legend',
        transform: `translate(${Number(original.getAttribute('x')) || 0},${Number(original.getAttribute('y')) || 0})`,
      })
      const width = Number(original.getAttribute('width')) || origin.width
      const ratio = origin.width > 0 ? width / origin.width : 1
      const panel = original.querySelector('.waveform-legend__panel')
      if (panel) {
        const rect = panel.getBoundingClientRect()
        group.appendChild(
          svgNode(document, 'rect', {
            x: (rect.left - origin.left) * ratio,
            y: (rect.top - origin.top) * ratio,
            width: rect.width * ratio,
            height: rect.height * ratio,
            rx: 4,
            fill: window.getComputedStyle(panel).backgroundColor,
            stroke: '#d0d5dd',
          }),
        )
      }
      original.querySelectorAll('.waveform-legend__item').forEach((item) => {
        const rect = item.getBoundingClientRect()
        const row = svgNode(document, 'g', {
          transform: `translate(${(rect.left - origin.left) * ratio},${(rect.top - origin.top) * ratio})`,
          opacity: window.getComputedStyle(item).opacity,
        })
        const swatch = item.querySelector('svg')
        if (swatch) {
          const copy = swatch.cloneNode(true) as SVGSVGElement
          copySvgStyles(swatch, copy)
          copy.setAttribute('width', '26')
          copy.setAttribute('height', '16')
          row.appendChild(copy)
        }
        const label = item.querySelector('.waveform-legend__label')
        if (label) {
          const text = svgNode(document, 'text', {
            x: 32,
            y: 12,
            fill: window.getComputedStyle(label).color,
            'font-size': 12,
            'font-family': 'sans-serif',
            'text-decoration': window.getComputedStyle(label).textDecorationLine,
          })
          text.textContent = label.textContent
          row.appendChild(text)
        }
        group.appendChild(row)
      })
      foreign.replaceWith(group)
    })
  }
}
