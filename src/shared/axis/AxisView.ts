import { axisBottom, axisLeft, axisRight, axisTop } from 'd3'
import type { ScaleLinear } from 'd3'
import { updateAxis, updateSvgAttribute } from './updateAxis'

export type AxisSide = 'top' | 'bottom' | 'left' | 'right'

/** Policies resolve domain/ticks before rendering; formatting never changes raw values. */
export interface AxisRenderPlan {
  scale: ScaleLinear<number, number>
  ticks: number[]
  side: AxisSide
  format: (value: number) => string
  tickSize: number
  tickPadding: number
  outerTickSize?: number
  line?: 'visible' | 'hidden' | 'none'
}

const generators = { top: axisTop, bottom: axisBottom, left: axisLeft, right: axisRight }

/** One numeric axis, independent of component, orientation, unit and layout policy. */
export class AxisView {
  private line?: AxisRenderPlan['line']

  constructor(readonly element: SVGGElement) {}

  render(plan: AxisRenderPlan) {
    const generator = generators[plan.side](plan.scale)
      .tickValues(plan.ticks)
      .tickFormat((value) => plan.format(Number(value)))
      .tickSize(plan.tickSize)
      .tickPadding(plan.tickPadding)
    if (plan.outerTickSize !== undefined) generator.tickSizeOuter(plan.outerTickSize)
    updateAxis(
      this.element,
      generator,
      plan.scale,
      plan.ticks,
      plan.side,
      plan.format,
      this.line === 'none' && plan.line !== 'none',
    )
    const domain = this.element.querySelector('path.domain')
    if (domain) {
      if (plan.line === 'none') domain.remove()
      else updateSvgAttribute(domain, 'display', plan.line === 'hidden' ? 'none' : null)
    }
    this.line = plan.line
  }
}
