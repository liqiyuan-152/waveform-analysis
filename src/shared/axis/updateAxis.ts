import { select } from 'd3'
import type { Axis, NumberValue, ScaleLinear } from 'd3'

const previous = new WeakMap<
  SVGGElement,
  { ticks: number[]; range: number[]; orientation: string; geometry: number[] }
>()

/** Avoid invalidating native SVG layout when an attribute already has the required value. */
export function updateSvgAttribute(element: Element, name: string, value: string | number | null) {
  const next = value === null ? null : String(value)
  if (element.getAttribute(name) === next) return
  if (next === null) element.removeAttribute(name)
  else element.setAttribute(name, next)
}

/** Domain animation moves existing ticks; unchanged labels keep their native text nodes. */
export function updateAxis(
  element: SVGGElement,
  axis: Axis<NumberValue>,
  scale: ScaleLinear<number, number>,
  ticks: number[],
  orientation: 'top' | 'bottom' | 'left' | 'right',
  format: (value: number) => string,
  force = false,
) {
  const range = scale.range()
  const geometry = [axis.tickSizeInner(), axis.tickSizeOuter(), axis.tickPadding(), axis.offset()]
  const cached = previous.get(element)
  const selection = select(element)
  if (
    force ||
    !cached ||
    cached.ticks !== ticks ||
    cached.orientation !== orientation ||
    geometry.some((value, index) => value !== cached.geometry[index]) ||
    range.some((value, index) => value !== cached.range[index])
  ) {
    if (cached && cached.orientation !== orientation) {
      selection.selectAll('.tick').remove()
      updateSvgAttribute(
        element,
        'text-anchor',
        orientation === 'left' ? 'end' : orientation === 'right' ? 'start' : 'middle',
      )
    }
    selection.call(axis)
    previous.set(element, { ticks, range, orientation, geometry })
  } else {
    const horizontal = orientation === 'bottom' || orientation === 'top'
    const offset = axis.offset()
    selection
      .selectAll<SVGGElement, number>('.tick')
      .each(function (value) {
        updateSvgAttribute(
          this,
          'transform',
          horizontal
            ? `translate(${scale(value) + offset},0)`
            : `translate(0,${scale(value) + offset})`,
        )
      })
      .select<SVGTextElement>('text')
      .each(function (value) {
        const label = format(value)
        if (this.textContent !== label) this.textContent = label
      })
  }
}
