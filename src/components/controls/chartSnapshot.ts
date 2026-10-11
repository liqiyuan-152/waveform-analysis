import { snapshotTitle } from './snapshotTitle'
const NS = 'http://www.w3.org/2000/svg'
function svgNode(name: string, attributes: Record<string, string | number> = {}) {
  const node = document.createElementNS(NS, name)
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)))
  return node
}
const styleKeys = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-decoration',
  'letter-spacing',
  'text-anchor',
  'dominant-baseline',
  'visibility',
  'display',
]
export function copySvgStyles(source: Element, clone: Element) {
  const originals = [source, ...source.querySelectorAll('*')]
  const copies = [clone, ...clone.querySelectorAll('*')]
  originals.forEach((node, i) => {
    const target = copies[i] as SVGElement
    const style = getComputedStyle(node)
    styleKeys.forEach((key) => {
      const value = style.getPropertyValue(key)
      if (value) target.style.setProperty(key, value)
    })
    // Make fragment references independent of the host URL.
    for (const attr of ['clip-path', 'mask', 'filter']) {
      const value = target.getAttribute(attr)
      if (value?.includes('#'))
        target.setAttribute(attr, `url(#${value.split('#')[1]!.replace(/[)'"].*$/, '')})`)
    }
  })
}
function replaceLegends(source: SVGSVGElement, clone: SVGSVGElement) {
  const originals = source.querySelectorAll('foreignObject')
  clone.querySelectorAll('foreignObject').forEach((foreign, index) => {
    const original = originals[index]!
    const origin = original.getBoundingClientRect()
    const group = svgNode('g', { class: 'waveform-export-legend' })
    const width = Number(original.getAttribute('width')) || origin.width
    const ratio = origin.width > 0 ? width / origin.width : 1
    const panel = original.querySelector('.waveform-legend__panel')
    if (panel) {
      const rect = panel.getBoundingClientRect()
      group.appendChild(
        svgNode('rect', {
          x: (rect.left - origin.left) * ratio,
          y: (rect.top - origin.top) * ratio,
          width: rect.width * ratio,
          height: rect.height * ratio,
          rx: 4,
          fill: getComputedStyle(panel).backgroundColor,
          stroke: '#d0d5dd',
        }),
      )
    }
    original.querySelectorAll('.waveform-legend__item').forEach((item) => {
      const rect = item.getBoundingClientRect()
      const row = svgNode('g', {
        transform: `translate(${(rect.left - origin.left) * ratio},${(rect.top - origin.top) * ratio})`,
        opacity: getComputedStyle(item).opacity,
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
        const text = svgNode('text', {
          x: 32,
          y: 12,
          fill: getComputedStyle(label).color,
          'font-size': 12,
          'font-family': 'sans-serif',
          'text-decoration': getComputedStyle(label).textDecorationLine,
        })
        text.textContent = label.textContent
        row.appendChild(text)
      }
      group.appendChild(row)
    })
    foreign.replaceWith(group)
  })
}
export function createChartSnapshot(
  container: HTMLElement,
  source: SVGSVGElement,
  width: number,
  height: number,
  titleHeight: number,
  background?: string,
) {
  const root = svgNode('svg', {
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
  }) as SVGSVGElement
  const color = background ?? getComputedStyle(container).backgroundColor
  root.appendChild(svgNode('rect', { width, height, fill: color || '#fff' }))
  const clone = source.cloneNode(true) as SVGSVGElement
  copySvgStyles(source, clone)
  replaceLegends(source, clone)
  clone
    .querySelectorAll(
      '.waveform-chart__overlay, .waveform-chart__hover-layer, .waveform-chart__zoom-selection',
    )
    .forEach((n) => n.remove())
  clone.setAttribute('y', String(titleHeight))
  clone.removeAttribute('role')
  clone.removeAttribute('aria-label')
  root.appendChild(clone)
  const title = snapshotTitle(container, titleHeight, width)
  if (title) root.appendChild(title)
  return new XMLSerializer().serializeToString(root)
}
