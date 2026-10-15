import { axisBottom, axisLeft, axisRight, select } from 'd3'
import type { DisplaySeries, TrackLayout, WaveformYAxisLayout } from '../components/core/types'
import { formatYAxisTickLabel } from '../components/core/layout'
import { sameTick } from '../components/core/yAxisPadding'
import {
  resolveYAxisLabelBandWidth,
  resolveYAxisLabelFontSize,
} from '../components/core/yAxisLabelStyle'
import { updateAxis, updateSvgAttribute } from '../components/rendering/updateAxis'
import { formatChannelLabel } from '../components/rendering/channelLabel'
import { formatXAxisLabel } from '../utils/formatters'
import type { ResolvedWaveformChartProps } from '../types/options'
import { setSvgAttributes, svgNode } from '../rendering/SvgDom'

export class AxisView {
  private readonly root: SVGGElement
  private readonly x: SVGGElement
  private readonly y = new Map<number, SVGGElement>()
  private readonly titles = new Map<number, SVGGElement>()
  private readonly endpoints: SVGGElement
  private readonly start: SVGTextElement
  private readonly end: SVGTextElement

  constructor(parent: SVGGElement) {
    const document = parent.ownerDocument
    this.root = svgNode(document, 'g', { class: 'waveform-chart__axes' })
    this.x = svgNode(document, 'g', {
      class:
        'waveform-track__axis waveform-track__axis--x waveform-chart__axis waveform-chart__axis--x',
    })
    this.endpoints = svgNode(document, 'g', {
      class: 'waveform-track__axis-endpoints waveform-chart__axis-endpoints',
      'font-family': 'sans-serif',
      'font-size': 10,
      'aria-hidden': 'true',
    })
    this.start = svgNode(document, 'text', {
      class:
        'waveform-track__axis-endpoint waveform-chart__axis-endpoint waveform-chart__axis-endpoint--start',
      x: 0,
      y: 7,
      dy: '0.71em',
      'text-anchor': 'start',
    })
    this.end = svgNode(document, 'text', {
      class:
        'waveform-track__axis-endpoint waveform-chart__axis-endpoint waveform-chart__axis-endpoint--end',
      y: 7,
      dy: '0.71em',
      'text-anchor': 'end',
    })
    this.endpoints.append(this.start, this.end)
    this.root.append(this.x, this.endpoints)
    parent.append(this.root)
  }

  render(track: TrackLayout, options: ResolvedWaveformChartProps, hideTitles: boolean) {
    // Clean view keeps ticks and frame; it suppresses decorative labels and layers.
    this.x.style.display = track.showXAxis ? '' : 'none'
    this.x.classList.toggle(
      'waveform-track__axis--line-hidden',
      options.axes?.x?.lineVisible === false,
    )
    this.endpoints.style.display = track.showXAxis ? '' : 'none'
    this.x.setAttribute('transform', `translate(0,${track.height})`)
    this.endpoints.setAttribute('transform', `translate(0,${track.height})`)
    if (track.showXAxis) {
      const format = (value: number) =>
        formatXAxisLabel(
          value,
          track.xScale.domain() as [number, number],
          options.timeUnit,
          'tick',
          options.axes?.x?.labelFormatter ?? track.xAxisLabelFormatter,
        )
      updateAxis(
        this.x,
        axisBottom(track.xScale)
          .tickValues(track.xAxisTickValues)
          .tickFormat((value) => format(Number(value)))
          .tickSize(-4)
          .tickPadding(7)
          .tickSizeOuter(0),
        track.xScale,
        track.xAxisTickValues,
        'bottom',
        format,
      )
      updateSvgAttribute(
        this.x.querySelector('path.domain')!,
        'display',
        options.axes?.x?.lineVisible === false ? 'none' : null,
      )
    }
    this.start.textContent = track.endpointLabels.start
    this.end.textContent = track.endpointLabels.end
    this.end.setAttribute('x', String(track.width))

    const axes = track.isEmpty ? [] : track.yAxes
    const active = new Set(axes.map((axis) => axis.index))
    for (const [index, node] of this.y)
      if (!active.has(index)) {
        node.remove()
        this.y.delete(index)
      }
    for (const axis of axes) this.renderYAxis(axis, options)

    const titleAxes =
      options.cleanView || hideTitles || track.isEmpty
        ? []
        : track.yAxes.length > 1
          ? axes
          : track.hasVisibleSeries && track.seriesList.length === 1 && track.showYAxisLabel
            ? axes
            : []
    const titleIds = new Set<number>()
    for (const axis of titleAxes) {
      const series = axis.seriesList[0]
      if (!series) continue
      const label = this.label(series, options)
      if (!label) continue
      titleIds.add(axis.index)
      this.renderTitle(axis, track.height, series, label, options)
      this.titles
        .get(axis.index)
        ?.classList.toggle('waveform-track__multi-axis-title', track.yAxes.length > 1)
    }
    for (const [index, title] of this.titles)
      if (!titleIds.has(index)) {
        title.remove()
        this.titles.delete(index)
      }
  }

  private renderYAxis(axis: WaveformYAxisLayout, options: ResolvedWaveformChartProps) {
    let node = this.y.get(axis.index)
    if (!node) {
      node = svgNode(this.root.ownerDocument, 'g')
      this.y.set(axis.index, node)
      this.root.append(node)
    }
    setSvgAttributes(node, {
      class: `waveform-track__axis waveform-track__axis--y waveform-chart__axis waveform-chart__axis--y waveform-track__axis--${axis.side}`,
      transform: `translate(${axis.x},0)`,
      'data-y-axis-index': axis.index,
      'data-y-axis-side': axis.side,
    })
    node.classList.toggle(
      'waveform-track__axis--line-hidden',
      options.axes?.y?.lineVisible === false,
    )
    const unit = options.unitDisplayMode === 'axis' ? axis.seriesList[0]?.unit : undefined
    const format = (value: number) =>
      formatYAxisTickLabel(
        value,
        axis.scale.domain() as [number, number],
        axis.tickValues,
        unit,
        axis.side,
      )
    const generator = (axis.side === 'left' ? axisLeft(axis.scale) : axisRight(axis.scale))
      .tickValues(axis.tickValues)
      .tickFormat((value) => format(Number(value)))
      .tickSize(-4)
      .tickPadding(7)
      .tickSizeOuter(0)
    updateAxis(node, generator, axis.scale, axis.tickValues, axis.side, format)
    updateSvgAttribute(node, 'data-label-domain-min', axis.scale.domain()[0])
    updateSvgAttribute(node, 'data-label-domain-max', axis.scale.domain()[1])
    updateSvgAttribute(node, 'data-label-unit', unit ?? null)
    const compact = options.displayMode === 'compact'
    select(node)
      .selectAll<SVGGElement, number>('.tick')
      .each(function (value) {
        const text = this.querySelector('text')!
        updateSvgAttribute(text, 'y', null)
        setSvgAttributes(text, { dy: 0, 'dominant-baseline': 'central' })
        updateSvgAttribute(
          text,
          'data-axis-maximum-label',
          compact && sameTick(value, Math.max(...axis.tickValues)) ? 'true' : null,
        )
        updateSvgAttribute(
          text,
          'data-axis-minimum-label',
          compact && sameTick(value, Math.min(...axis.tickValues)) ? 'true' : null,
        )
        updateSvgAttribute(
          this,
          'data-maximum-tick',
          axis.maximumTick !== undefined && sameTick(value, axis.maximumTick) ? 'true' : null,
        )
        updateSvgAttribute(
          this,
          'data-minimum-tick',
          axis.minimumTick !== undefined && sameTick(value, axis.minimumTick) ? 'true' : null,
        )
        setSvgAttributes(this, { 'data-tick-value': value, 'data-tick-y': axis.scale(value) })
      })
    updateSvgAttribute(
      node.querySelector('path.domain')!,
      'display',
      options.axes?.y?.lineVisible === false ? 'none' : null,
    )
  }

  private label(series: DisplaySeries, options: ResolvedWaveformChartProps) {
    const name = series.name.trim() || options.yLabel || ''
    return options.unitDisplayMode === 'channel-label' ||
      options.unitDisplayMode === 'channel-label-or-legend'
      ? formatChannelLabel(name, series.unit)
      : name
  }

  private renderTitle(
    axis: WaveformYAxisLayout,
    height: number,
    series: DisplaySeries,
    label: string,
    options: ResolvedWaveformChartProps,
  ) {
    let title = this.titles.get(axis.index)
    if (!title) {
      title = svgNode(this.root.ownerDocument, 'g', { 'data-y-axis-title-index': axis.index })
      title.append(
        svgNode(this.root.ownerDocument, 'rect', {
          class: 'waveform-track__y-axis-label-bg waveform-chart__y-axis-label-bg',
          height: 80,
          rx: 2,
        }),
        svgNode(this.root.ownerDocument, 'text', {
          class: 'waveform-track__y-axis-label waveform-chart__y-axis-label',
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
        }),
      )
      this.titles.set(axis.index, title)
      this.root.append(title)
    }
    const style = options.axes?.y?.labelTextStyle
    const band = resolveYAxisLabelBandWidth(style)
    setSvgAttributes(title.firstElementChild!, {
      x: axis.labelX - band / 2,
      y: height / 2 - 40,
      width: band,
    })
    const text = title.lastElementChild as SVGTextElement
    text.textContent = label
    setSvgAttributes(text, {
      fill: style?.color || series.color,
      transform: `translate(${axis.labelX},${height / 2}) rotate(-90)`,
    })
    Object.assign(text.style, {
      fontSize: `${resolveYAxisLabelFontSize(style)}px`,
      fontWeight: String(style?.fontWeight ?? 600),
      fontFamily: style?.fontFamily ?? '',
      fontStyle: style?.fontStyle ?? 'normal',
    })
  }

  dispose() {
    this.root.remove()
    this.y.clear()
    this.titles.clear()
  }
}
