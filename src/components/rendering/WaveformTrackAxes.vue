<script setup lang="ts">
import { axisBottom, axisLeft, axisRight, select } from 'd3'
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'

import type { WaveformAxesOptions } from '../../types'
import { formatXAxisLabel } from '../../utils'
import { formatYAxisTickLabel } from '../core/layout'
import type { DisplaySeries, TrackLayout, WaveformYAxisLayout } from '../core/types'
import { scheduleMaximumTickVisibility } from './yAxisTickVisibility'
import { sameTick } from '../core/yAxisPadding'
import { resolveYAxisLabelBandWidth, resolveYAxisLabelFontSize } from '../core/yAxisLabelStyle'
import { formatChannelLabel } from './channelLabel'
import { updateAxis, updateSvgAttribute } from './updateAxis'

interface Props {
  track: TrackLayout
  innerWidth: number
  cleanView: boolean
  axes?: WaveformAxesOptions
  timeUnit: 's' | 'ms'
  yLabel?: string
  showUnits?: boolean
  showLabelUnits?: boolean
  hideYAxisTitles?: boolean
  hideOverlappingMaximumLabel?: boolean
}

const props = withDefaults(defineProps<Props>(), { showUnits: true })
const labelBandWidth = computed(() => resolveYAxisLabelBandWidth(props.axes?.y?.labelTextStyle))
const labelTextStyle = computed(() => {
  const style = props.axes?.y?.labelTextStyle
  return {
    fontSize: `${resolveYAxisLabelFontSize(style)}px`,
    fontWeight: style?.fontWeight ?? 600,
    fontFamily: style?.fontFamily,
    fontStyle: style?.fontStyle ?? 'normal',
  }
})
const xAxisElement = ref<SVGGElement>()
const yAxisElements = ref<SVGGElement[]>([])

function resolveYAxisLabel(series: DisplaySeries): string {
  const name = series.name.trim() || props.yLabel || ''
  return props.showLabelUnits ? formatChannelLabel(name, series.unit) : name
}

function hasYAxisTitle(axis: WaveformYAxisLayout): boolean {
  const series = axis.seriesList[0]
  return Boolean(series && resolveYAxisLabel(series))
}

function setYAxisElement(element: unknown, index: number) {
  if (element) yAxisElements.value[index] = element as SVGGElement
}

function renderAxes() {
  props.track.yAxes.forEach((axis, index) => {
    const element = yAxisElements.value[index]
    if (!element) return
    const unit = props.showUnits ? axis.seriesList[0]?.unit : undefined
    const highestTick = Math.max(...axis.tickValues)
    const lowestTick = Math.min(...axis.tickValues)
    const format = (value: number) =>
      formatYAxisTickLabel(
        value,
        axis.scale.domain() as [number, number],
        axis.tickValues,
        unit,
        axis.side,
      )
    const yAxis = (axis.side === 'left' ? axisLeft(axis.scale) : axisRight(axis.scale))
      .tickFormat((value) => format(Number(value)))
      .tickSize(-4)
      .tickPadding(7)
      .tickSizeOuter(0)
      .tickValues(axis.tickValues)

    const selection = select(element)
    updateAxis(element, yAxis, axis.scale, axis.tickValues, axis.side, format)
    updateSvgAttribute(element, 'data-label-domain-min', axis.scale.domain()[0])
    updateSvgAttribute(element, 'data-label-domain-max', axis.scale.domain()[1])
    updateSvgAttribute(element, 'data-label-unit', unit ?? null)
    selection.selectAll<SVGGElement, number>('.tick').each(function (value) {
      const text = this.querySelector('text')
      if (text) {
        updateSvgAttribute(text, 'y', null)
        updateSvgAttribute(text, 'dy', '0')
        updateSvgAttribute(text, 'dominant-baseline', 'central')
        updateSvgAttribute(
          text,
          'data-axis-maximum-label',
          props.hideOverlappingMaximumLabel && sameTick(value, highestTick) ? 'true' : null,
        )
        updateSvgAttribute(
          text,
          'data-axis-minimum-label',
          props.hideOverlappingMaximumLabel && sameTick(value, lowestTick) ? 'true' : null,
        )
      }
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
      updateSvgAttribute(this, 'data-tick-value', value)
      updateSvgAttribute(this, 'data-tick-y', axis.scale(value))
    })
    selection.selectAll<SVGPathElement, unknown>('path.domain').each(function () {
      updateSvgAttribute(this, 'display', props.axes?.y?.lineVisible === false ? 'none' : null)
    })
  })

  scheduleVisibility()
  if (!xAxisElement.value) return
  const selection = select(xAxisElement.value)
  const format = (value: number) =>
    formatXAxisLabel(
      value,
      props.track.xScale.domain() as [number, number],
      props.timeUnit,
      'tick',
      props.axes?.x?.labelFormatter ?? props.track.xAxisLabelFormatter,
    )
  updateAxis(
    xAxisElement.value,
    axisBottom(props.track.xScale)
      .tickValues(props.track.xAxisTickValues)
      .tickFormat((value) => format(Number(value)))
      .tickSize(-4)
      .tickPadding(7)
      .tickSizeOuter(0),
    props.track.xScale,
    props.track.xAxisTickValues,
    'bottom',
    format,
  )
  selection.selectAll<SVGPathElement, unknown>('path.domain').each(function () {
    updateSvgAttribute(this, 'display', props.axes?.x?.lineVisible === false ? 'none' : null)
  })
}

let disposed = false
function scheduleVisibility() {
  if (disposed) return
  const apply = () => {
    const svg = yAxisElements.value[0]?.ownerSVGElement
    if (svg) scheduleMaximumTickVisibility(svg)
  }
  apply()
}
onBeforeUnmount(() => {
  disposed = true
  document.fonts?.removeEventListener?.('loadingdone', scheduleVisibility)
})
onMounted(async () => {
  document.fonts?.addEventListener?.('loadingdone', scheduleVisibility)
  void document.fonts?.ready.then(() => {
    if (!disposed) scheduleVisibility()
  })
  await nextTick()
  renderAxes()
})

watch(
  [
    () => props.track.xScale,
    () => props.track.yAxes,
    () => props.track.xAxisTickValues,
    () => props.track.yAxisTickValues,
    () => props.timeUnit,
    () => props.showUnits,
    () => props.axes?.x?.labelFormatter,
    () => props.axes?.x?.lineVisible,
    () => props.axes?.y?.lineVisible,
    () => props.hideOverlappingMaximumLabel,
  ],
  async () => {
    await nextTick()
    renderAxes()
  },
  { flush: 'post' },
)
</script>

<template>
  <g
    v-if="track.showXAxis"
    ref="xAxisElement"
    class="waveform-track__axis waveform-track__axis--x waveform-chart__axis waveform-chart__axis--x"
    :class="{ 'waveform-track__axis--line-hidden': axes?.x?.lineVisible === false }"
    :transform="`translate(0, ${track.height})`"
  />
  <g
    v-if="track.showXAxis"
    class="waveform-track__axis-endpoints waveform-chart__axis-endpoints"
    :transform="`translate(0, ${track.height})`"
    font-family="sans-serif"
    font-size="10"
    aria-hidden="true"
  >
    <text
      class="waveform-track__axis-endpoint waveform-track__axis-endpoint--start waveform-chart__axis-endpoint waveform-chart__axis-endpoint--start"
      x="0"
      y="7"
      dy="0.71em"
      text-anchor="start"
    >
      {{ track.endpointLabels.start }}
    </text>
    <text
      class="waveform-track__axis-endpoint waveform-track__axis-endpoint--end waveform-chart__axis-endpoint waveform-chart__axis-endpoint--end"
      :x="track.width ?? innerWidth"
      y="7"
      dy="0.71em"
      text-anchor="end"
    >
      {{ track.endpointLabels.end }}
    </text>
  </g>
  <g
    v-for="axis in track.isEmpty ? [] : track.yAxes"
    :key="`y-axis-${track.index}-${axis.index}`"
    :ref="(element) => setYAxisElement(element, axis.index)"
    class="waveform-track__axis waveform-track__axis--y waveform-chart__axis waveform-chart__axis--y"
    :class="[
      `waveform-track__axis--${axis.side}`,
      { 'waveform-track__axis--line-hidden': axes?.y?.lineVisible === false },
    ]"
    :data-y-axis-index="axis.index"
    :data-y-axis-side="axis.side"
    :transform="`translate(${axis.x}, 0)`"
  />
  <g
    v-if="
      !cleanView &&
      !hideYAxisTitles &&
      !track.isEmpty &&
      track.hasVisibleSeries &&
      track.seriesList.length === 1 &&
      track.showYAxisLabel &&
      track.series &&
      resolveYAxisLabel(track.series)
    "
  >
    <rect
      class="waveform-track__y-axis-label-bg waveform-chart__y-axis-label-bg"
      :x="track.yAxes[0].labelX - labelBandWidth / 2"
      :y="track.height / 2 - 40"
      :width="labelBandWidth"
      height="80"
      rx="2"
    />
    <text
      class="waveform-track__y-axis-label waveform-chart__y-axis-label"
      :fill="axes?.y?.labelTextStyle?.color || track.series?.color"
      :style="labelTextStyle"
      :transform="`translate(${track.yAxes[0].labelX}, ${track.height / 2}) rotate(-90)`"
      text-anchor="middle"
      dominant-baseline="central"
    >
      {{ track.series ? resolveYAxisLabel(track.series) : '' }}
    </text>
  </g>

  <g
    v-for="axis in !cleanView && !hideYAxisTitles && track.yAxes.length > 1
      ? track.yAxes.filter(hasYAxisTitle)
      : []"
    :key="`y-axis-title-${track.index}-${axis.index}`"
    class="waveform-track__multi-axis-title"
    :data-y-axis-title-index="axis.index"
  >
    <rect
      class="waveform-track__y-axis-label-bg waveform-chart__y-axis-label-bg"
      :x="axis.labelX - labelBandWidth / 2"
      :y="track.height / 2 - 40"
      :width="labelBandWidth"
      height="80"
      rx="2"
    />
    <text
      class="waveform-track__y-axis-label waveform-chart__y-axis-label"
      :fill="axes?.y?.labelTextStyle?.color || axis.seriesList[0].color"
      :style="labelTextStyle"
      :transform="`translate(${axis.labelX}, ${track.height / 2}) rotate(-90)`"
      text-anchor="middle"
      dominant-baseline="central"
    >
      {{ resolveYAxisLabel(axis.seriesList[0]) }}
    </text>
  </g>
</template>
