import { updateSvgAttribute } from './updateAxis'
import type { ScaleLinear } from 'd3'

const nodes = new WeakMap<SVGGElement, Map<number, SVGLineElement>>()

/** Keep each grid line independently discoverable by the axis collision pass. */
export function updateGrid(
  group: SVGGElement,
  ticks: readonly number[],
  scale: ScaleLinear<number, number>,
  direction: 'vertical' | 'horizontal',
  extent: number,
  color: string | undefined,
) {
  let lines = nodes.get(group)
  if (!lines) nodes.set(group, (lines = new Map()))
  const current = new Set(ticks)
  for (const [tick, line] of lines) {
    if (!current.has(tick)) {
      line.remove()
      lines.delete(tick)
    }
  }
  let previous: SVGLineElement | undefined
  for (const tick of ticks) {
    let line = lines.get(tick)
    if (!line) {
      line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      line.setAttribute('data-grid-direction', direction)
      lines.set(tick, line)
    }
    const next = previous ? previous.nextSibling : group.firstChild
    if (next !== line) group.insertBefore(line, next)
    const position = scale(tick)
    updateSvgAttribute(line, 'stroke', color ?? null)
    updateSvgAttribute(line, 'x1', direction === 'vertical' ? position : 0)
    updateSvgAttribute(line, 'x2', direction === 'vertical' ? position : extent)
    updateSvgAttribute(line, 'y1', direction === 'horizontal' ? position : 0)
    updateSvgAttribute(line, 'y2', direction === 'horizontal' ? position : extent)
    previous = line
  }
}
