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
  'clip-path',
  'mask',
  'filter',
  'marker-start',
  'marker-mid',
  'marker-end',
]
export function copySvgStyles(source: Element, clone: Element) {
  const originals = [source, ...source.querySelectorAll('*')]
  const copies = [clone, ...clone.querySelectorAll('*')]
  originals.forEach((node, i) => {
    const target = copies[i] as SVGElement
    const style = source.ownerDocument.defaultView!.getComputedStyle(node)
    styleKeys.forEach((key) => {
      const value = style.getPropertyValue(key)
      if (value) target.style.setProperty(key, value)
    })
    for (const key of styleKeys) {
      const value = target.style.getPropertyValue(key)
      if (value)
        target.style.setProperty(
          key,
          value.replace(/url\(["']?[^)#]*#([^)'"]+)["']?\)/g, 'url(#$1)'),
        )
    }
    // Make fragment references independent of the host URL.
    for (const attr of [
      'clip-path',
      'mask',
      'filter',
      'marker-start',
      'marker-mid',
      'marker-end',
      'fill',
      'stroke',
    ]) {
      const value = target.getAttribute(attr)
      if (value?.includes('url(') && value.includes('#'))
        target.setAttribute(attr, `url(#${value.split('#')[1]!.replace(/[)'"].*$/, '')})`)
    }
  })
}
