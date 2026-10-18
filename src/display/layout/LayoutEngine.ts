import * as d3 from 'd3'
import type { resolveOptions, ResolvedValueAxisOptions } from '../config/resolve.js'
import type { WaveformModel } from '../model/WaveformModel.js'
import type { WaveformSeries } from '../types/data.js'
import type { HorizontalPadding, PaddingOptions, WaveformOptions } from '../types/options.js'
import { applyXDomainStrategy } from './domain/domain.js'
import { resolveDataDomain } from './domain/DataDomainStrategy.js'
import { formatYAxisHeader } from '../renderer/axes.js'
import { xMetadataWidth } from '../renderer/xMetadata.js'
import { resolveXTicks, resolveYTicks } from './ticks/resolve.js'
import type { ResolvedValueAxis } from '../renderer/context.js'
import type { AxisLayout, LayoutMeasurements } from './AxisLayout.js'

export class LayoutEngine {
  constructor(
    private readonly rawOptions: WaveformOptions,
    private readonly measurements: LayoutMeasurements,
  ) {}

  private resolveHorizontalPadding(value: number | undefined): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
  }

  private applyHorizontalPadding(
    padding: Required<PaddingOptions>,
    horizontalPadding?: HorizontalPadding,
  ): Required<PaddingOptions> {
    const left = this.resolveHorizontalPadding(horizontalPadding?.left)
    const right = this.resolveHorizontalPadding(horizontalPadding?.right)
    return {
      ...padding,
      left: left === undefined ? padding.left : Math.max(padding.left, left),
      right: right === undefined ? padding.right : Math.max(padding.right, right),
    }
  }

  private resolvePadding(
    options: ReturnType<typeof resolveOptions>,
    valueAxes: Array<{ options: ResolvedValueAxisOptions; offset: number; footprint: number }>,
  ): Required<PaddingOptions> {
    const p = { ...options.padding }
    if (!options.layout.autoPadding) return p

    // Keep the automatic bottom minimum at 30px.
    p.bottom = Math.max(p.bottom, 30)
    const leftExtent = Math.max(
      0,
      ...valueAxes
        .filter((axis) => axis.options.visible && axis.options.position === 'left')
        .map((axis) => axis.offset + axis.footprint),
    )
    const rightExtent = Math.max(
      0,
      ...valueAxes
        .filter((axis) => axis.options.visible && axis.options.position === 'right')
        .map((axis) => axis.offset + axis.footprint),
    )
    if (leftExtent) p.left = Math.max(p.left, Math.ceil(leftExtent + 5))
    if (rightExtent) p.right = Math.max(p.right, Math.ceil(rightExtent + 2))
    const rightLegendExtent =
      options.legend.visible &&
      options.legend.orientation === 'vertical' &&
      options.legend.position.includes('right')
        ? 96
        : 0
    const metadataWidth = xMetadataWidth(options)
    if (metadataWidth) {
      const rightContentExtent = Math.max(rightExtent, rightLegendExtent)
      p.right = Math.max(
        p.right,
        Math.ceil(rightContentExtent + options.xAxis.title.offset + metadataWidth + 2),
      )
    }
    if (options.legend.visible && options.legend.orientation === 'vertical') {
      if (options.legend.position.includes('right')) p.right = Math.max(p.right, 96)
      else p.left = Math.max(p.left, 96)
    }

    // Reclaim up to ten pixels, but never move visible exterior content out of the SVG.
    const requiredRight =
      Math.max(rightExtent, rightLegendExtent) +
      (metadataWidth ? options.xAxis.title.offset + metadataWidth : 0)
    p.right = Math.max(options.padding.right, Math.ceil(requiredRight), p.right - 10)

    return p
  }

  private hasExplicitYAxisTitleVisibility(axisId: string): boolean {
    if (this.rawOptions.yAxes !== undefined) {
      return (
        this.rawOptions.yAxes.find((axis) => axis.id?.trim() === axisId)?.title?.visible !==
        undefined
      )
    }

    const axis = axisId === 'right' ? this.rawOptions.secondaryYAxis : this.rawOptions.yAxis
    return axis?.title?.visible !== undefined
  }

  private resolveValueAxes(
    series: WaveformSeries[],
    options: ReturnType<typeof resolveOptions>,
  ): AxisLayout[] {
    const primaryId = options.yAxes[0].id
    const axisIds = new Set(options.yAxes.map((axis) => axis.id))
    const valuesByAxis = new Map(options.yAxes.map((axis) => [axis.id, [] as number[]]))

    for (const item of series) {
      const axisId = item.yAxis && axisIds.has(item.yAxis) ? item.yAxis : primaryId
      valuesByAxis.get(axisId)!.push(...item.data.map((point) => point.y))
    }

    const offsets = { left: 0, right: 0 }
    return options.yAxes.map((axis) => {
      const ticks = resolveYTicks(
        resolveDataDomain(valuesByAxis.get(axis.id) ?? [], axis.min, axis.max),
        axis,
      )
      const domain = ticks.domain
      const measurement = this.measurements.measureAxis(axis, domain, ticks)
      const { footprint } = measurement
      const offset = axis.visible ? offsets[axis.position] : 0
      if (axis.visible) offsets[axis.position] += footprint
      return { options: axis, domain, ticks, offset, ...measurement }
    })
  }

  calculate(
    model: WaveformModel,
    options: ReturnType<typeof resolveOptions>,
    width: number,
    height: number,
  ) {
    const series = model.series
    const keyedSeries = model.keyedSeries
    const visibleSeries = keyedSeries
      .filter((item) => !model.hiddenKeys.has(item.key))
      .map((item) => item.series)

    const primaryAxisId = options.yAxes[0].id
    const axisById = new Map(options.yAxes.map((axis) => [axis.id, axis]))
    const seriesAxisId = (item: WaveformSeries) =>
      item.yAxis && axisById.has(item.yAxis) ? item.yAxis : primaryAxisId
    const visibleAxisIds = new Set(visibleSeries.map(seriesAxisId))
    const displayedAxisByPosition = new Map<'left' | 'right', string>()
    for (const axis of options.yAxes) {
      if (
        !axis.visible ||
        !visibleAxisIds.has(axis.id) ||
        displayedAxisByPosition.has(axis.position)
      )
        continue
      displayedAxisByPosition.set(axis.position, axis.id)
    }
    const axisAliases = new Map<string, string>()
    for (const axis of options.yAxes) {
      if (!axis.visible || !visibleAxisIds.has(axis.id)) continue
      const displayedAxisId = displayedAxisByPosition.get(axis.position)
      if (displayedAxisId) axisAliases.set(axis.id, displayedAxisId)
    }
    const plottedSeries = visibleSeries.map((item) => {
      const displayedAxisId = axisAliases.get(seriesAxisId(item))
      return displayedAxisId && displayedAxisId !== item.yAxis
        ? { ...item, yAxis: displayedAxisId }
        : item
    })
    const displayedAxisIds = new Set(displayedAxisByPosition.values())
    const singleChannel = series.length === 1
    const effectiveOptions = {
      ...options,
      yAxes: options.yAxes.map((axis) => ({
        ...axis,
        visible: displayedAxisIds.has(axis.id),
        title: singleChannel
          ? { ...axis.title, visible: false }
          : (() => {
              const plottedIndex = plottedSeries.findIndex((item) => seriesAxisId(item) === axis.id)
              const matchingSeries = plottedSeries[plottedIndex]
              const seriesIndex =
                plottedIndex >= 0 ? series.indexOf(visibleSeries[plottedIndex]) : -1
              const derivedText = matchingSeries
                ? matchingSeries.name?.trim() || `Series ${seriesIndex + 1}`
                : ''
              const text = axis.title.text?.trim() || derivedText
              const visible = this.hasExplicitYAxisTitleVisibility(axis.id)
                ? axis.title.visible
                : Boolean(text)
              return { ...axis.title, text, visible }
            })(),
      })),
      legend: { ...options.legend, visible: options.legend.visible && series.length > 1 },
    }
    const valueAxisLayouts = this.resolveValueAxes(plottedSeries, effectiveOptions)
    const naturalPadding = this.resolvePadding(effectiveOptions, valueAxisLayouts)
    const p = this.applyHorizontalPadding(naturalPadding, effectiveOptions.layout.horizontalPadding)
    const headers = valueAxisLayouts.filter(
      (axis) => axis.options.visible && formatYAxisHeader(axis.options, axis.domain),
    )
    if (options.layout.autoPadding && headers.length) {
      const headerHeight = Math.max(...headers.map((axis) => axis.headerHeight))
      p.top = Math.max(p.top, Math.ceil(headerHeight + 8))
    }
    const innerWidth = Math.max(1, width - p.left - p.right)
    const innerHeight = Math.max(1, height - p.top - p.bottom)
    const points = visibleSeries.flatMap((s) => s.data)
    const rawXDomain = resolveDataDomain(
      points.map((d) => d.x),
      options.xAxis.min,
      options.xAxis.max,
    )
    const hasExplicitXDomain =
      Number.isFinite(options.xAxis.min) || Number.isFinite(options.xAxis.max)
    const xDomain = applyXDomainStrategy(rawXDomain, options.xDomainStrategy, hasExplicitXDomain)

    const x = d3.scaleLinear().domain(xDomain).range([0, innerWidth])
    const xTickLayout = resolveXTicks(xDomain, effectiveOptions.xAxis, innerWidth)
    const xTicks = xTickLayout.majorValues
    const yAxes: ResolvedValueAxis[] = valueAxisLayouts.map((axis) => ({
      ...axis,
      scale: d3.scaleLinear().domain(axis.domain).range([innerHeight, 0]),
    }))
    const yAxisById = new Map(yAxes.map((axis) => [axis.options.id, axis]))
    for (const [axisId, displayedAxisId] of axisAliases) {
      const displayedAxis = yAxisById.get(displayedAxisId)
      if (displayedAxis) yAxisById.set(axisId, displayedAxis)
    }
    const primaryYAxis = yAxes.find((axis) => axis.options.visible) ?? yAxes[0]
    return {
      plottedSeries,
      singleChannel,
      effectiveOptions,
      naturalPadding,
      p,
      innerWidth,
      innerHeight,
      xDomain,
      x,
      xTicks,
      xTickLayout,
      yAxes,
      yAxisById,
      primaryYAxis,
    }
  }
}
