import * as d3 from 'd3'
import type { RenderContext } from './context.js'

export function renderGrid(ctx: RenderContext) {
  const { plot, x, xTicks, yAxisById, primaryYAxis, innerWidth, innerHeight, options } = ctx
  if (!options.grid.visible) return
  const commonDash = options.grid.style === 'dashed' ? '3 3' : null

  if (options.grid.x.visible) {
    plot
      .append('g')
      .attr('class', 'waveform-grid waveform-grid-x')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(xTicks)
          .tickSize(-innerHeight)
          .tickFormat(() => ''),
      )
      .call((g) => g.select('.domain').remove())
      .call((g) =>
        g
          .selectAll('line')
          .attr('stroke', options.grid.x.color ?? options.grid.color)
          .attr('stroke-width', options.grid.x.width ?? options.grid.width)
          .attr('stroke-dasharray', options.grid.x.dash ?? commonDash),
      )
  }

  if (options.grid.y.visible) {
    const valueAxis = yAxisById.get(options.grid.y.axisId ?? '') ?? primaryYAxis
    const yTicks = valueAxis.ticks.majorValues
    plot
      .append('g')
      .attr('class', 'waveform-grid waveform-grid-y')
      .attr('data-axis-id', valueAxis.options.id)
      .call(
        d3
          .axisLeft(valueAxis.scale)
          .tickValues(yTicks)
          .tickSize(-innerWidth)
          .tickFormat(() => ''),
      )
      .call((g) => g.select('.domain').remove())
      .call((g) =>
        g
          .selectAll('line')
          .attr('stroke', options.grid.y.color ?? options.grid.color)
          .attr('stroke-width', options.grid.y.width ?? options.grid.width)
          .attr('stroke-dasharray', options.grid.y.dash ?? commonDash),
      )
  }
}
