import { sameTick } from '../core/yAxisPadding'
import { formatYAxisTickLabel } from '../core/layout'

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
  const startAligned = text.getAttribute('text-anchor') === 'start'
  return {
    left: startAligned ? x : x - width,
    right: startAligned ? x + width : x,
    top: y - height / 2,
    bottom: y + height / 2,
  }
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

function formatCompactLabels(svg: SVGSVGElement) {
  svg.querySelectorAll<SVGTextElement>('text[data-axis-maximum-label]').forEach((maximum) => {
    const axis = maximum.parentElement!.parentElement!
    const labels = [...axis.querySelectorAll<SVGTextElement>('.tick text')]
    const value = (text: SVGTextElement) =>
      Number(text.parentElement!.getAttribute('data-tick-value'))
    const visibleValues = labels
      .filter((text) => text.getAttribute('display') !== 'none')
      .map(value)
    const domain: [number, number] = [
      Number(axis.getAttribute('data-label-domain-min')),
      Number(axis.getAttribute('data-label-domain-max')),
    ]
    labels.forEach((text) => {
      text.textContent = formatYAxisTickLabel(
        value(text),
        domain,
        visibleValues,
        axis.getAttribute('data-label-unit') ?? undefined,
        axis.getAttribute('data-y-axis-side') === 'right' ? 'right' : 'left',
      )
    })
  })
}

/** Apply after axes and grid are in the DOM; never feed the filtered set back into layout. */
export function updateMaximumTickVisibility(svg: SVGSVGElement) {
  svg.querySelectorAll('[data-maximum-hidden]').forEach((el) => {
    el.removeAttribute('display')
    el.removeAttribute('data-maximum-hidden')
  })
  svg.querySelectorAll('.waveform-track__axis--y .tick text').forEach((text) => {
    text.removeAttribute('display')
  })
  formatCompactLabels(svg)
  const minimumLabels = [...svg.querySelectorAll<SVGTextElement>('text[data-axis-minimum-label]')]
  svg.querySelectorAll<SVGTextElement>('text[data-axis-maximum-label]').forEach((maximum) => {
    const box = textBox(maximum)
    if (minimumLabels.some((minimum) => labelsOverlap(box, textBox(minimum)))) hide(maximum)
  })
  svg.querySelectorAll<SVGGElement>('.waveform-track__axis--y .tick').forEach((tick) => {
    const position = Number(tick.getAttribute('data-tick-y'))
    const height = Number(tick.closest('.waveform-track')?.getAttribute('data-track-height'))
    const line = tick.querySelector('line')
    if (sameTick(position, 0) || sameTick(position, height)) line?.setAttribute('display', 'none')
    else line?.removeAttribute('display')
  })
  const minimumTicks = [...svg.querySelectorAll<SVGGElement>('.tick[data-minimum-tick]')]
  const maximumTicks = [...svg.querySelectorAll<SVGGElement>('.tick[data-maximum-tick]')]
  const labels = [...svg.querySelectorAll<SVGTextElement>('.waveform-track__axis--y .tick text')]
  minimumTicks.forEach((tick) => {
    const text = tick.querySelector('text')
    if (!text) return
    maximumTicks.forEach((maximum) => {
      const other = maximum.querySelector('text')
      if (other && other !== text && labelsOverlap(textBox(text), textBox(other))) hide(other)
    })
  })
  const extremeTicks = [...new Set([...minimumTicks, ...maximumTicks])]
  extremeTicks.forEach((tick) => {
    const text = tick.querySelector('text')
    const line = tick.querySelector('line')
    if (!text || !line) return
    const box = textBox(text)
    labels.forEach((other) => {
      if (text.getAttribute('display') === 'none') return
      if (other.getAttribute('display') === 'none') return
      if (other.parentElement?.matches('[data-minimum-tick], [data-maximum-tick]')) return
      if (!tick.hasAttribute('data-minimum-tick') && other.hasAttribute('data-axis-minimum-label'))
        return
      if (labelsOverlap(box, textBox(other))) hide(other)
    })
    const axis = tick.parentElement!
    const value = Number(tick.getAttribute('data-tick-value'))
    const position = Number(tick.getAttribute('data-tick-y'))
    axis
      .querySelectorAll<SVGGElement>('.tick:not([data-maximum-tick]):not([data-minimum-tick])')
      .forEach((other) => {
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
    if (tick.hasAttribute('data-maximum-tick'))
      tick.setAttribute('data-maximum-value', String(value))
    if (tick.hasAttribute('data-minimum-tick'))
      tick.setAttribute('data-minimum-value', String(value))
  })
  formatCompactLabels(svg)
}
