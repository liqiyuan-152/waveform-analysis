import { svgNode } from '../rendering/SvgDom'
/** Recreate the HTML title in SVG, retaining wrapping, rotation and fitted scale. */
export class SvgTitleExporter {
  snapshot(container: HTMLElement, titleHeight: number, width: number) {
    const document = container.ownerDocument
    const window = document.defaultView!
    const title = container.querySelector<HTMLElement>('.waveform-chart__title-text')
    if (!title || titleHeight <= 0) return undefined
    for (
      let node: HTMLElement | null = title;
      node && node !== container;
      node = node.parentElement
    ) {
      const display = window.getComputedStyle(node)
      if (display.display === 'none' || display.visibility === 'hidden') return undefined
    }
    const style = window.getComputedStyle(title)
    const rect = title.getBoundingClientRect()
    const origin = container.getBoundingClientRect()
    const svg = container.querySelector('svg')
    const svgRect = svg?.getBoundingClientRect()
    const ratio = origin.width && container.offsetWidth ? container.offsetWidth / origin.width : 1
    const centerX =
      svgRect && svgRect.width > 0
        ? ((rect.left - svgRect.left + rect.width / 2) *
            (Number(svg?.getAttribute('width')) || width)) /
          svgRect.width
        : (rect.left - origin.left + rect.width / 2) * ratio -
          container.clientLeft +
          container.scrollLeft
    const group = svgNode(document, 'g')
    const matrix =
      typeof window.DOMMatrix !== 'undefined' && style.transform !== 'none' && style.transform
        ? new window.DOMMatrix(style.transform)
        : undefined
    const angle = matrix ? (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI : 0
    const scale = matrix ? Math.hypot(matrix.a, matrix.b) : 1
    group.setAttribute(
      'transform',
      `translate(${centerX},${titleHeight / 2}) rotate(${angle}) scale(${scale})`,
    )
    const text = svgNode(document, 'text')
    text.setAttribute('fill', style.color)
    for (const key of [
      'font-family',
      'font-size',
      'font-weight',
      'font-style',
      'text-decoration',
      'letter-spacing',
    ])
      text.style.setProperty(key, style.getPropertyValue(key))
    const fontSize = parseFloat(style.fontSize) || 14
    const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.4
    const logicalWidth = title.clientWidth || parseFloat(style.width) || rect.width || width
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px ${style.fontFamily}`
    const lines: string[] = []
    let line = ''
    for (const char of title.textContent ?? '') {
      if (char === '\n') {
        lines.push(line)
        line = ''
        continue
      }
      const measured = ctx?.measureText(line + char).width ?? (line.length + 1) * fontSize
      if (style.whiteSpace !== 'nowrap' && line && measured > logicalWidth) {
        lines.push(line)
        line = char
      } else line += char
    }
    lines.push(line)
    const align = style.textAlign
    text.setAttribute(
      'text-anchor',
      align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle',
    )
    lines.forEach((value, index) => {
      const span = svgNode(document, 'tspan')
      span.setAttribute(
        'x',
        String(align === 'left' ? -logicalWidth / 2 : align === 'right' ? logicalWidth / 2 : 0),
      )
      span.setAttribute('y', String((index - (lines.length - 1) / 2) * lineHeight))
      span.setAttribute('dominant-baseline', 'middle')
      span.textContent = value
      text.appendChild(span)
    })
    canvas.width = 0
    canvas.height = 0
    group.appendChild(text)
    return group
  }
}
