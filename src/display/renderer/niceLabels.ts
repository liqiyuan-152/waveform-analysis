import { select } from 'd3'
import { estimateLabelWidth, visibleTickLabels } from '../layout/ticks/labels.js'
import type { RenderContext } from './context.js'
import { formatXAxisTick } from './xTicks.js'

export function layoutNiceXLabels(ctx: RenderContext) {
  const axis = ctx.options.xAxis
  const domain = ctx.xDomain
  const fontSize = axis.fontSize ?? 11
  const group = ctx.plot.select<SVGGElement>('.waveform-axis-x')
  const entries: Array<{
    node: SVGTextElement
    text: string
    start: number
    end: number
    priority: boolean
    fits?: boolean
  }> = []
  group.selectAll<SVGTextElement, number>('.tick text').each(function (value) {
    const text = formatXAxisTick(axis, value)
    const half = estimateLabelWidth(text, fontSize) / 2
    const endpoint = domain.includes(value)
    entries.push({
      node: this,
      text,
      start: ctx.x(value) - half,
      end: ctx.x(value) + half,
      priority: endpoint,
      fits: !(axis.hideEndTicks && endpoint) && !(axis.showEndValues && endpoint),
    })
  })
  ctx.plot.selectAll<SVGTextElement, unknown>('.waveform-axis-x-endpoint').each(function () {
    const node = select(this)
    const first = node.classed('waveform-axis-x-endpoint--start')
    const width = estimateLabelWidth(this.textContent ?? '', fontSize)
    node.attr('text-anchor', first ? 'start' : 'end')
    entries.push({
      node: this,
      text: this.textContent ?? '',
      start: first ? 0 : ctx.innerWidth - width,
      end: first ? width : ctx.innerWidth,
      priority: true,
    })
  })
  const visible = visibleTickLabels(entries, 0, ctx.innerWidth)
  entries.forEach((entry, index) =>
    select(entry.node).attr('visibility', visible.has(index) ? null : 'hidden'),
  )
}

export function layoutNiceYLabels(
  ctx: RenderContext,
  valueAxis: RenderContext['yAxes'][number],
  format: (value: number) => string,
) {
  const axis = valueAxis.options
  const group = ctx.plot.select<SVGGElement>(
    `.waveform-axis-y[data-axis-id="${axis.id.replace(/["\\]/g, '\\$&')}"]`,
  )
  const fontSize = axis.fontSize ?? 11
  const position = axis.position === 'right' ? 1 : -1
  const axisX =
    ctx.options.padding.left +
    (position > 0 ? ctx.innerWidth + valueAxis.offset : -valueAxis.offset)
  const entries: Array<{
    node: SVGTextElement
    text: string
    start: number
    end: number
    priority: boolean
    fits: boolean
  }> = []
  const collect = (node: SVGTextElement, value: number, priority: boolean) => {
    const text = format(value)
    const measuredWidth =
      valueAxis.tickFootprint !== undefined
        ? Math.max(0, valueAxis.tickFootprint - (axis.tickPadding ?? 6))
        : estimateLabelWidth(text, fontSize)
    const width = valueAxis.formatDomain
      ? Math.max(measuredWidth, estimateLabelWidth(text, fontSize))
      : measuredWidth
    const x = axisX + position * (axis.tickPadding ?? 6)
    const y = ctx.options.padding.top + valueAxis.scale(value)
    entries.push({
      node,
      text,
      start: y - fontSize / 2,
      end: y + (fontSize * Math.max(1, text.split('\n').length)) / 2,
      priority,
      fits: position > 0 ? x + width <= ctx.width : x - width >= 0,
    })
  }
  group.selectAll<SVGTextElement, number>('.tick text').each(function (value) {
    collect(this, value, valueAxis.domain.includes(value))
  })
  for (const value of valueAxis.ticks.boundaryValues) {
    if (valueAxis.ticks.majorValues.includes(value) || axis.showEndValues === false) continue
    const node = group
      .append('text')
      .attr('class', 'waveform-axis-y-boundary')
      .attr('x', position * (axis.tickPadding ?? 6))
      .attr('y', valueAxis.scale(value))
      .attr('dy', '0.32em')
      .attr('text-anchor', position > 0 ? 'start' : 'end')
      .attr('fill', axis.fontColor ?? '#475569')
      .attr('font-size', fontSize)
      .text(format(value))
      .node()!
    collect(node, value, true)
  }
  const visible = visibleTickLabels(entries, 0, ctx.height)
  entries.forEach((entry, index) =>
    select(entry.node).attr('visibility', visible.has(index) ? null : 'hidden'),
  )
}
