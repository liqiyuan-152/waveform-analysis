import { AxisView as SharedAxisView } from '../../shared/axis/AxisView'
import { layoutNiceXLabels, layoutNiceYLabels } from './niceLabels.js'
import * as d3 from 'd3'
import type { AxisOptions } from '../types/options.js'
import type { RenderContext } from './context.js'
import { formatScientificAxisHeader, formatScientificAxisTick } from './formatters.js'
import { createTextMeasurer } from './legend.js'
import { yAxisTickValues } from './helpers.js'
import { formatXAxisTick } from './xTicks.js'

function formatTick(axis: AxisOptions, value: d3.NumberValue): string {
  const number = Number(value)
  if (typeof axis.tickFormat === 'function') return axis.tickFormat(number)
  if (axis.tickFormat) return d3.format(axis.tickFormat)(number)
  return `${number}${axis.unit ? ` ${axis.unit}` : ''}`
}

function isDomainEndpoint(value: number, domain: [number, number]): boolean {
  const tolerance = Math.max(1, Math.abs(domain[1] - domain[0])) * Number.EPSILON * 8
  return Math.abs(value - domain[0]) <= tolerance || Math.abs(value - domain[1]) <= tolerance
}

function estimateYAxisLabelWidth(label: string, fontSize: number): number {
  return Math.max(...label.split('\n').map((line) => line.length * fontSize * 0.5))
}

function renderMultilineTickLabels(axisGroup: d3.Selection<SVGGElement, unknown, null, undefined>) {
  axisGroup.selectAll<SVGTextElement, unknown>('.tick text').each(function () {
    const lines = (this.textContent ?? '').split('\n')
    if (lines.length < 2) return

    const text = d3.select(this)
    const x = text.attr('x') ?? '0'
    text.text(null)
    lines.forEach((line, index) => {
      text
        .append('tspan')
        .attr('x', x)
        .attr('dy', index === 0 ? '0em' : '1em')
        .text(line)
    })
  })
}

export function formatYAxisTick(
  axis: AxisOptions,
  value: number,
  domain: [number, number],
): string {
  return axis.tickFormat ? formatTick(axis, value) : formatScientificAxisTick(value, domain)
}

export function formatYAxisHeader(axis: AxisOptions, domain: [number, number]): string {
  return axis.tickFormat
    ? ''
    : formatScientificAxisHeader(domain, axis.unit, axis.position !== 'right')
}

export function measureYAxis(
  axis: AxisOptions,
  domain: [number, number],
  svg?: RenderContext['svg'],
  tickValues?: number[],
) {
  const fontSize = axis.fontSize ?? 11
  const measurer = svg
    ? createTextMeasurer(svg, fontSize, axis.fontFamily, axis.fontWeight)
    : undefined
  const measure = (label: string) =>
    Math.max(
      ...label
        .split('\n')
        .map((line) => measurer?.measure(line) ?? estimateYAxisLabelWidth(line, fontSize)),
    )
  try {
    const labelWidth = Math.max(
      0,
      ...(tickValues ?? yAxisTickValues(domain, axis.tickCount ?? 6)).map((value) =>
        measure(formatYAxisTick(axis, value, domain)),
      ),
    )
    // Ticks point into the plot, so only tick padding consumes exterior space.
    const tickFootprint = (axis.tickPadding ?? 6) + labelWidth
    const titleOffset = axis.title?.offset ?? tickFootprint + 12 + (axis.title?.fontSize ?? 12) / 2
    const titleFootprint =
      axis.title?.visible && (axis.title.text || axis.label)
        ? titleOffset + (axis.title.fontSize ?? 12) / 2
        : 0
    const header = formatYAxisHeader(axis, domain)
    const headerWidth = measure(header)
    const headerHeight = measurer?.height(header) ?? (header ? fontSize : 0)
    return {
      footprint: Math.max(tickFootprint, titleFootprint),
      titleOffset,
      headerWidth,
      headerHeight,
      tickFootprint,
    }
  } finally {
    measurer?.destroy()
  }
}

export function estimateYAxisFootprint(axis: AxisOptions, domain: [number, number]): number {
  return measureYAxis(axis, domain).footprint
}

function renderYAxis(ctx: RenderContext, valueAxis: RenderContext['yAxes'][number]) {
  const { plot, svg, innerWidth, innerHeight, options } = ctx
  const { options: axisOptions, scale, domain, offset } = valueAxis
  const titleOffset = valueAxis.titleOffset ?? measureYAxis(axisOptions, domain).titleOffset
  const position = axisOptions.position
  const tickValues = valueAxis.ticks.majorValues
  const endTickValue = domain[1]

  const axisX = position === 'right' ? innerWidth + offset : -offset

  const axisGroup = plot
    .append('g')
    .attr('class', `waveform-axis waveform-axis-y waveform-axis-y--${position}`)
    .attr('data-axis-id', axisOptions.id)
    .attr('transform', axisX === 0 ? null : `translate(${axisX},0)`)
    .call((g) =>
      new SharedAxisView(g.node()!).render({
        scale,
        ticks: tickValues,
        side: position === 'right' ? 'right' : 'left',
        format: (value) => formatYAxisTick(axisOptions, value, valueAxis.formatDomain ?? domain),
        tickSize: -(axisOptions.tickSize ?? 6),
        tickPadding: axisOptions.tickPadding ?? 6,
        line: 'none',
      }),
    )
    .call((g) =>
      g
        .selectAll('path,line')
        .attr('stroke', axisOptions.color ?? '#000000')
        .attr('stroke-width', axisOptions.width ?? 1.3),
    )
    .call((g) =>
      g
        .selectAll('text')
        .attr('fill', axisOptions.fontColor ?? '#475569')
        .attr('font-size', axisOptions.fontSize ?? 11)
        .attr('font-family', axisOptions.fontFamily ?? null)
        .attr('font-weight', axisOptions.fontWeight ?? null),
    )

  renderMultilineTickLabels(axisGroup)

  axisGroup
    .selectAll<SVGGElement, number>('.tick')
    .filter((value) => value === endTickValue)
    .select('text')
    .classed('waveform-axis-y-end-value', true)

  axisGroup
    .selectAll<SVGGElement, number>('.tick')
    .filter((value) => value === domain[0])
    .select('text')
    .attr('dy', '0')

  const header = formatYAxisHeader(axisOptions, valueAxis.formatDomain ?? domain)
  if (header) {
    const text = axisGroup
      .append('text')
      .attr('class', 'waveform-axis-y-header')
      .attr('data-axis-id', axisOptions.id)
      .attr(
        'x',
        (position === 'right' ? 1 : -1) *
          (valueAxis.tickFootprint ?? measureYAxis(axisOptions, domain, svg).tickFootprint),
      )
      .attr('y', -8)
      .attr('text-anchor', position === 'right' ? 'end' : 'start')
      .attr('fill', axisOptions.fontColor ?? '#475569')
      .attr('font-size', axisOptions.fontSize ?? 11)
      .attr('font-family', axisOptions.fontFamily ?? null)
      .attr('font-weight', axisOptions.fontWeight ?? null)
      .text(header)
    // Align the actual glyph bottom, including descenders, eight pixels above the plot.
    const node = text.node()
    valueAxis.headerRight =
      Number(text.attr('x')) + (position === 'left' ? (valueAxis.headerWidth ?? 0) : 0)
    valueAxis.headerLeft = valueAxis.headerRight - (valueAxis.headerWidth ?? 0)
    if (node && typeof node.getBBox === 'function') {
      try {
        const bounds = node.getBBox()
        if (Number.isFinite(bounds.x) && Number.isFinite(bounds.width) && bounds.width > 0) {
          const ticks = axisGroup.selectAll<SVGTextElement, unknown>('.tick text').nodes()
          const leftEdges = ticks.map((tick) => {
            const box = tick.getBBox()
            const group = tick.parentNode as SVGGElement
            const translateX = group.transform?.baseVal.consolidate()?.matrix.e ?? 0
            return box.width > 0 && Number.isFinite(box.x) && Number.isFinite(box.width)
              ? box.x + translateX + (position === 'right' ? box.width : 0)
              : Number.NaN
          })
          if (leftEdges.length && leftEdges.every(Number.isFinite)) {
            const left =
              position === 'left' ? Math.min(...leftEdges) : Math.max(...leftEdges) - bounds.width
            text.attr('x', Number(text.attr('x')) + left - bounds.x)
            valueAxis.headerRight = left + bounds.width
            valueAxis.headerLeft = left
          }
        }
        const bottom = bounds.y + bounds.height
        if (Number.isFinite(bottom)) text.attr('y', -16 - bottom)
      } catch {
        // Hidden SVGs and partial DOM implementations may not provide a bounding box.
      }
    }
  }

  const titleText = axisOptions.title?.text || axisOptions.label
  if (axisOptions.title?.visible && titleText) {
    const text = `${titleText}${axisOptions.title.unit ? ` (${axisOptions.title.unit})` : ''}`
    const requestedSize = axisOptions.title.fontSize ?? 12
    const measurer = createTextMeasurer(
      svg,
      requestedSize,
      undefined,
      axisOptions.title.fontWeight ?? 500,
    )
    let fontSize = requestedSize
    try {
      const length = measurer.measure(text)
      const available = Math.max(0, innerHeight - 4)
      // Round down to a browser subpixel so font quantization cannot overshoot the lane.
      if (length > available)
        fontSize = Math.floor(((requestedSize * available) / length) * 64) / 64
    } finally {
      measurer.destroy()
    }
    const xPos =
      position === 'right'
        ? options.padding.left + innerWidth + offset + titleOffset
        : options.padding.left -
          offset -
          titleOffset +
          (axisOptions.title.offset === undefined ? 10 : 0)
    svg
      .append('text')
      .attr('class', 'waveform-axis-y-title')
      .attr('data-axis-id', axisOptions.id)
      .attr('transform', `translate(${xPos},${options.padding.top + innerHeight / 2}) rotate(-90)`)
      .attr('text-anchor', 'middle')
      .attr('fill', axisOptions.title.color ?? '#334155')
      .attr('font-size', fontSize)
      .attr('font-weight', axisOptions.title.fontWeight ?? 500)
      .text(text)
  }
}

export function renderAxes(ctx: RenderContext) {
  const { plot, x, xTicks, yAxes, innerHeight, innerWidth, options } = ctx

  if (options.xAxis.visible) {
    const domain = x.domain() as [number, number]
    const endpointLabels = {
      start: formatXAxisTick(options.xAxis, domain[0]),
      end: formatXAxisTick(options.xAxis, domain[1]),
    }
    const fontSize = options.xAxis.fontSize ?? 11
    const labelGap = options.xAxis.tickPadding ?? 6
    const measurer =
      options.xAxis.tickStrategy === 'nice'
        ? undefined
        : createTextMeasurer(ctx.svg, fontSize, options.xAxis.fontFamily, options.xAxis.fontWeight)
    let visibleXTicks: number[]
    try {
      const leftHalfWidth = (measurer?.measure(endpointLabels.start) ?? 0) / 2
      const rightHalfWidth = (measurer?.measure(endpointLabels.end) ?? 0) / 2
      visibleXTicks =
        options.xAxis.tickStrategy === 'nice'
          ? xTicks
          : xTicks.filter((tick) => {
              if (options.xAxis.hideEndTicks && isDomainEndpoint(tick, domain)) return false
              if (!options.xAxis.showEndValues) return true
              const position = x(tick)
              const tickHalfWidth = measurer!.measure(formatXAxisTick(options.xAxis, tick)) / 2
              return (
                position >= leftHalfWidth + tickHalfWidth + 2 &&
                innerWidth - position >= rightHalfWidth + tickHalfWidth + 2
              )
            })
    } finally {
      measurer?.destroy()
    }

    plot
      .append('g')
      .attr('class', 'waveform-axis waveform-axis-x')
      .attr('transform', `translate(0,${innerHeight})`)
      .call((g) =>
        new SharedAxisView(g.node()!).render({
          scale: x,
          ticks: visibleXTicks,
          side: 'bottom',
          format: (value) => formatXAxisTick(options.xAxis, value),
          tickSize: -(options.xAxis.tickSize ?? 6),
          tickPadding: options.xAxis.tickPadding ?? 6,
          line: 'none',
        }),
      )
      .call((g) =>
        g
          .selectAll('path,line')
          .attr('stroke', options.xAxis.color ?? '#000000')
          .attr('stroke-width', options.xAxis.width ?? 1.3),
      )
      .call((g) =>
        g
          .selectAll('text')
          .attr('fill', options.xAxis.fontColor ?? '#475569')
          .attr('font-size', options.xAxis.fontSize ?? 11),
      )

    if (options.xAxis.showEndValues) {
      const endpointGroup = plot
        .append('g')
        .attr('class', 'waveform-axis-x-endpoints')
        .attr('transform', `translate(0,${innerHeight})`)
        .attr('font-family', 'sans-serif')
        .attr('font-size', fontSize)
        .attr('fill', options.xAxis.fontColor ?? '#475569')

      endpointGroup
        .append('text')
        .attr('class', 'waveform-axis-x-endpoint waveform-axis-x-endpoint--start')
        .attr('x', 0)
        .attr('y', labelGap)
        .attr('dy', '0.71em')
        .attr('text-anchor', 'middle')
        .text(endpointLabels.start)

      endpointGroup
        .append('text')
        .attr('class', 'waveform-axis-x-endpoint waveform-axis-x-endpoint--end')
        .attr('x', innerWidth)
        .attr('y', labelGap)
        .attr('dy', '0.71em')
        .attr('text-anchor', 'middle')
        .text(endpointLabels.end)
    }
  }

  if (options.xAxis.visible && options.xAxis.tickStrategy === 'nice') layoutNiceXLabels(ctx)
  yAxes
    .filter((axis) => axis.options.visible)
    .forEach((axis) => {
      renderYAxis(ctx, axis)
      if (axis.options.tickStrategy === 'nice')
        layoutNiceYLabels(ctx, axis, (value) =>
          formatYAxisTick(axis.options, value, axis.formatDomain ?? axis.domain),
        )
    })
}
