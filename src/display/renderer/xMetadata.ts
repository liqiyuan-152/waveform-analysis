import type { ReturnTypeOfResolveOptions } from '../types/internal.js'
import type { RenderContext } from './context.js'
import { createTextMeasurer } from './legend.js'

const EDGE_INSET = 2
const MIDDLE_GAP = 12
const LEGEND_RIGHT_EXTENT = 96

function xTitleText(options: ReturnTypeOfResolveOptions): string {
  const text = options.xAxis.title.text || options.xAxis.label
  if (!options.xAxis.title.visible || !text) return ''
  return `${text}${options.xAxis.title.unit ? ` (${options.xAxis.title.unit})` : ''}`
}

function shotText(options: ReturnTypeOfResolveOptions): string {
  return options.shot.visible ? options.shot.text : ''
}

function fittedFontSize(
  ctx: RenderContext,
  text: string,
  fontSize: number,
  availableLength: number,
  fontWeight: number | string,
): number {
  const measurer = createTextMeasurer(ctx.svg, fontSize, undefined, fontWeight)
  try {
    const length = measurer.measure(text)
    if (length <= availableLength) return fontSize
    return Math.floor(((fontSize * availableLength) / length) * 64) / 64
  } finally {
    measurer.destroy()
  }
}

function rightContentExtent(ctx: RenderContext): number {
  const axisExtent = Math.max(
    0,
    ...ctx.yAxes
      .filter((axis) => axis.options.visible && axis.options.position === 'right')
      .map((axis) => axis.offset + axis.footprint),
  )
  const legendExtent =
    ctx.options.legend.visible &&
    ctx.options.legend.orientation === 'vertical' &&
    ctx.options.legend.position.includes('right')
      ? LEGEND_RIGHT_EXTENT
      : 0
  return Math.max(axisExtent, legendExtent)
}

export function xMetadataWidth(options: ReturnTypeOfResolveOptions): number {
  const title = xTitleText(options)
  const shot = shotText(options)
  return Math.max(title ? options.xAxis.title.fontSize : 0, shot ? options.shot.fontSize : 0)
}

export function renderXMetadata(ctx: RenderContext) {
  const { svg, options, innerHeight } = ctx
  const title = xTitleText(options)
  const shot = shotText(options)
  if (!title && !shot) return

  const laneWidth = xMetadataWidth(options)
  const preferredX =
    options.padding.left +
    ctx.innerWidth +
    rightContentExtent(ctx) +
    options.xAxis.title.offset +
    laneWidth / 2 -
    10
  const rightTickExtent = Math.max(
    0,
    ...ctx.yAxes
      .filter((axis) => axis.options.visible && axis.options.position === 'right')
      .map((axis) => axis.offset + (axis.tickFootprint ?? axis.footprint)),
  )
  // The frame is also an obstacle when no right value axis is displayed.
  const x = Math.max(
    preferredX,
    options.padding.left + ctx.innerWidth + rightTickExtent + laneWidth / 2 + 4,
  )
  const availableLength = Math.max(
    0,
    (innerHeight - EDGE_INSET * 2 - (title && shot ? MIDDLE_GAP : 0)) / (title && shot ? 2 : 1),
  )

  if (shot) {
    const y = options.padding.top + EDGE_INSET
    svg
      .append('text')
      .attr('class', 'waveform-shot')
      .attr('x', x)
      .attr('y', y)
      .attr('transform', `rotate(-90 ${x} ${y})`)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', options.shot.color)
      .attr(
        'font-size',
        fittedFontSize(ctx, shot, options.shot.fontSize, availableLength, options.shot.fontWeight),
      )
      .attr('font-weight', options.shot.fontWeight)
      .attr('aria-label', `Shot ${shot}`)
      .text(shot)
  }

  if (title) {
    const y = options.padding.top + innerHeight - EDGE_INSET
    svg
      .append('text')
      .attr('class', 'waveform-axis-x-title')
      .attr('x', x)
      .attr('y', y)
      .attr('transform', `rotate(-90 ${x} ${y})`)
      .attr('text-anchor', 'start')
      .attr('dominant-baseline', 'middle')
      .attr('fill', options.xAxis.title.color ?? '#334155')
      .attr(
        'font-size',
        fittedFontSize(
          ctx,
          title,
          options.xAxis.title.fontSize ?? 12,
          availableLength,
          options.xAxis.title.fontWeight ?? 500,
        ),
      )
      .attr('font-weight', options.xAxis.title.fontWeight ?? 500)
      .text(title)
  }
}
