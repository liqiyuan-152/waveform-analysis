import { pointSymbol as symbolType } from '../../shared/rendering/styles'
import * as d3 from 'd3'
import { curveFor, dashFor } from './helpers.js'
import type { WaveformPoint } from '../types/data.js'
import type { RenderContext } from './context.js'

export function renderSeries(ctx: RenderContext) {
  const { plot, series, x, yAxisById, primaryYAxis, options, clipId } = ctx
  const layer = plot.append('g').attr('clip-path', `url(#${clipId})`)

  series.forEach((s, index) => {
    const effect = ctx.seriesEffects?.[index]
    const seriesLayer = effect ? layer.append('g').attr('opacity', effect.opacity ?? 1) : layer
    if (effect?.clip) {
      const id = `${clipId}-entry-${index}`
      seriesLayer
        .append('defs')
        .append('clipPath')
        .attr('id', id)
        .append('rect')
        .attr('x', effect.clip.x)
        .attr('width', effect.clip.width)
        .attr('height', ctx.innerHeight)
      seriesLayer.attr('clip-path', `url(#${id})`)
    }
    const yScale = yAxisById.get(s.yAxis ?? '')?.scale ?? primaryYAxis.scale
    const lineStyle = {
      color: s.style?.color ?? options.line.color,
      lineWidth: s.style?.lineWidth ?? options.line.width,
      lineType: s.style?.lineType ?? options.line.type,
      lineStyle: s.style?.lineStyle ?? options.line.style,
      opacity: s.style?.opacity ?? options.line.opacity,
    }

    if (options.line.visible) {
      const line = d3
        .line<WaveformPoint>()
        .defined((d) => Number.isFinite(d.x) && Number.isFinite(d.y))
        .x((d) => x(d.x))
        .y((d) => yScale(d.y))
        .curve(curveFor(lineStyle.lineType))

      seriesLayer
        .append('path')
        .datum(s.data)
        .attr('d', line)
        .attr('fill', 'none')
        .attr('stroke', lineStyle.color)
        .attr('stroke-width', lineStyle.lineWidth)
        .attr('stroke-opacity', lineStyle.opacity)
        .attr('stroke-dasharray', dashFor(lineStyle.lineStyle))
        .attr('vector-effect', 'non-scaling-stroke')
    }

    const pointStyle = {
      visible: s.style?.point?.visible ?? options.point.visible,
      type: s.style?.point?.type ?? options.point.type,
      size: s.style?.point?.size ?? options.point.size,
      color: s.style?.point?.color ?? options.point.color,
      borderColor: s.style?.point?.borderColor ?? options.point.borderColor,
      borderWidth: s.style?.point?.borderWidth ?? options.point.borderWidth,
    }
    if (pointStyle.visible) {
      const symbol = d3
        .symbol()
        .type(symbolType(pointStyle.type))
        .size(pointStyle.size * pointStyle.size * 4)
      seriesLayer
        .append('g')
        .selectAll('path')
        .data(s.data.filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y)))
        .join('path')
        .attr('transform', (d) => `translate(${x(d.x)},${yScale(d.y)})`)
        .attr('d', symbol)
        .attr('fill', pointStyle.color || lineStyle.color)
        .attr('stroke', pointStyle.borderColor)
        .attr('stroke-width', pointStyle.borderWidth)
    }
  })
}
