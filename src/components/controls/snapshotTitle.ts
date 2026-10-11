const NS = 'http://www.w3.org/2000/svg'
/** Recreate the HTML title in SVG, retaining wrapping, rotation and fitted scale. */
export function snapshotTitle(container: HTMLElement, titleHeight: number, width: number) {
  const title = container.querySelector<HTMLElement>('.waveform-chart__title-text')
  if (!title) return undefined
  const style = getComputedStyle(title)
  const rect = title.getBoundingClientRect()
  const origin = container.getBoundingClientRect()
  const ratio = origin.width ? width / origin.width : 1
  const group = document.createElementNS(NS, 'g')
  const matrix =
    typeof DOMMatrix !== 'undefined' && style.transform !== 'none' && style.transform
      ? new DOMMatrix(style.transform)
      : undefined
  const angle = matrix ? (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI : 0
  const scale = matrix ? Math.hypot(matrix.a, matrix.b) : 1
  group.setAttribute(
    'transform',
    `translate(${(rect.left - origin.left + rect.width / 2) * ratio},${titleHeight / 2}) rotate(${angle}) scale(${scale})`,
  )
  const text = document.createElementNS(NS, 'text')
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
    const span = document.createElementNS(NS, 'tspan')
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
