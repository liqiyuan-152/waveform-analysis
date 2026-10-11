import { sameTick } from '../core/yAxisPadding'

interface Box {
  left: number
  right: number
  top: number
  bottom: number
}

function textBox(text: SVGTextElement): Box {
  const rect = text.getBoundingClientRect()
  if (rect.width && rect.height) return rect
  const height = Number.parseFloat(getComputedStyle(text).fontSize) || 11
  const width = (text.textContent?.length ?? 0) * height * 0.65
  let x = Number(text.getAttribute('x')) || 0
  let y = Number(text.getAttribute('y')) || 0
  for (let parent: Element | null = text.parentElement; parent; parent = parent.parentElement) {
    const match = parent
      .getAttribute('transform')
      ?.match(/translate\(([-\d.e+]+)[ ,]+([-\d.e+]+)\)/)
    if (match) {
      x += Number(match[1])
      y += Number(match[2])
    }
  }
  return { left: x - width, right: x, top: y - height / 2, bottom: y + height / 2 }
}

export function labelsOverlap(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom + 4 && b.top < a.bottom + 4
}

export function linesOverlap(a: number, b: number, widthA = 1, widthB = 1): boolean {
  return Math.abs(a - b) < (widthA + widthB) / 2 + 1
}

function hide(element: Element) {
  element.setAttribute('display', 'none')
  element.setAttribute('data-maximum-hidden', 'true')
}

function strokeWidth(element: Element): number {
  return Number.parseFloat(getComputedStyle(element).strokeWidth) || 1
}

/** Apply after axes and grid are in the DOM; never feed the filtered set back into layout. */
export function updateMaximumTickVisibility(svg: SVGSVGElement) {
  svg.querySelectorAll('[data-maximum-hidden]').forEach((el) => {
    el.removeAttribute('display')
    el.removeAttribute('data-maximum-hidden')
  })
  const maximumTicks = [...svg.querySelectorAll<SVGGElement>('.tick[data-maximum-tick]')]
  const labels = [...svg.querySelectorAll<SVGTextElement>('.waveform-track__axis--y .tick text')]
  maximumTicks.forEach((tick) => {
    const text = tick.querySelector('text')
    const line = tick.querySelector('line')
    if (!text || !line) return
    const box = textBox(text)
    labels.forEach((other) => {
      if (other.parentElement?.hasAttribute('data-maximum-tick')) return
      if (labelsOverlap(box, textBox(other))) hide(other)
    })
    const axis = tick.parentElement!
    const value = Number(tick.getAttribute('data-tick-value'))
    const position = Number(tick.getAttribute('data-tick-y'))
    axis.querySelectorAll<SVGGElement>('.tick:not([data-maximum-tick])').forEach((other) => {
      const otherLine = other.querySelector('line')
      if (
        otherLine &&
        linesOverlap(
          position,
          Number(other.getAttribute('data-tick-y')),
          strokeWidth(line),
          strokeWidth(otherLine),
        )
      )
        hide(otherLine)
    })
    // Only the primary Y axis owns the existing horizontal grid.
    if (axis.getAttribute('data-y-axis-index') !== '0') return
    const track = axis.closest('.waveform-track')!
    track.querySelectorAll('[data-grid-direction="horizontal"]').forEach((gridLine) => {
      const gridY = Number(gridLine.getAttribute('y1'))
      if (linesOverlap(position, gridY, strokeWidth(line), strokeWidth(gridLine))) hide(gridLine)
    })
    const frame = track.querySelector('.waveform-track__plot-frame')
    const height = Number(track.getAttribute('data-track-height'))
    if (
      frame &&
      Number(frame.getAttribute('stroke-width')) > 0 &&
      (sameTick(position, 0) || sameTick(position, height))
    )
      hide(line)
    tick.setAttribute('data-maximum-value', String(value))
  })
}
