<script setup lang="ts">
import { axisBottom, axisLeft, axisRight, select } from 'd3'
import { nextTick, onMounted, ref, watch } from 'vue'

import type { WaveformAxesOptions } from '../../types'
import { formatAxisTime, formatScientificAxisLabel } from '../../utils'
import type { DisplaySeries, TrackLayout, WaveformYAxisLayout } from '../core/types'

interface Props {
  track: TrackLayout
  innerWidth: number
  cleanView: boolean
  axes?: WaveformAxesOptions
  timeUnit: 's' | 'ms'
  yLabel?: string
}

const props = defineProps<Props>()
const xAxisElement = ref<SVGGElement>()
const yAxisElements = ref<SVGGElement[]>([])

function resolveYAxisLabel(series: DisplaySeries): string {
  return series.name.trim() || props.yLabel || ''
}

function hasYAxisTitle(axis: WaveformYAxisLayout): boolean {
  const series = axis.seriesList[0]
  return Boolean(series && resolveYAxisLabel(series))
}

function setYAxisElement(element: unknown, index: number) {
  if (element) yAxisElements.value[index] = element as SVGGElement
}

function shouldShowYAxisLabel(trackHeight: number, trackIndex: number): boolean {
  const minimumHeightForLabel = 80
  if (trackHeight >= minimumHeightForLabel) return true
  return trackIndex % Math.ceil(minimumHeightForLabel / trackHeight) === 0
}

function renderAxes() {
  props.track.yAxes.forEach((axis, index) => {
    const element = yAxisElements.value[index]
    if (!element) return
    const [axisMin, axisMax] = axis.scale.domain()
    const yAxis = (axis.side === 'left' ? axisLeft(axis.scale) : axisRight(axis.scale))
      .tickFormat((value) => formatScientificAxisLabel(Number(value), { axisMin, axisMax }))
      .tickSize(-4)
      .tickPadding(7)
      .tickSizeOuter(0)
      .tickValues(axis.tickValues)

    const selection = select(element)
    selection.call(yAxis)
    selection
      .selectAll('path.domain')
      .attr('display', props.axes?.y?.lineVisible === false ? 'none' : null)
  })

  if (!xAxisElement.value) return
  const selection = select(xAxisElement.value)
  selection.call(
    axisBottom(props.track.xScale)
      .tickValues(props.track.xAxisTickValues)
      .tickFormat((value) =>
        formatAxisTime(
          Number(value),
          props.timeUnit,
          props.track.xScale.domain() as [number, number],
        ),
      )
      .tickSize(-4)
      .tickPadding(7)
      .tickSizeOuter(0),
  )
  selection
    .selectAll('path.domain')
    .attr('display', props.axes?.x?.lineVisible === false ? 'none' : null)
}

onMounted(async () => {
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
    () => props.axes?.x?.lineVisible,
    () => props.axes?.y?.lineVisible,
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
  <text
    v-if="track.showXAxis && track.xAxisExponent"
    class="waveform-track__axis-exponent waveform-track__axis-exponent--x waveform-chart__axis-exponent waveform-chart__axis-exponent--x"
    :x="track.width ?? innerWidth"
    :y="track.height + 27"
    text-anchor="end"
    aria-hidden="true"
  >
    {{ track.xAxisExponent }}
  </text>

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
  <text
    v-for="axis in track.isEmpty ? [] : track.yAxes.filter((item) => item.exponentLabel)"
    :key="`y-axis-exponent-${track.index}-${axis.index}`"
    class="waveform-track__axis-exponent waveform-track__axis-exponent--y waveform-chart__axis-exponent waveform-chart__axis-exponent--y"
    :data-y-axis-index="axis.index"
    :x="axis.exponentX"
    y="0"
    dy="0.32em"
    :text-anchor="axis.side === 'left' ? 'end' : 'start'"
    aria-hidden="true"
  >
    {{ axis.exponentLabel }}
  </text>

  <g
    v-if="
      !cleanView &&
      !track.isEmpty &&
      track.hasVisibleSeries &&
      track.seriesList.length === 1 &&
      track.showYAxisLabel &&
      resolveYAxisLabel(track.series) &&
      shouldShowYAxisLabel(track.height, track.index)
    "
  >
    <rect
      class="waveform-track__y-axis-label-bg waveform-chart__y-axis-label-bg"
      :x="track.yAxisLabelX - 12"
      :y="track.height / 2 - 40"
      width="24"
      height="80"
      rx="2"
    />
    <text
      class="waveform-track__y-axis-label waveform-chart__y-axis-label"
      :fill="track.series.color"
      :transform="`translate(${track.yAxisLabelX}, ${track.height / 2}) rotate(-90)`"
      text-anchor="middle"
      dominant-baseline="central"
    >
      {{ resolveYAxisLabel(track.series) }}
    </text>
  </g>

  <g
    v-for="axis in !cleanView && track.yAxes.length > 1 ? track.yAxes.filter(hasYAxisTitle) : []"
    :key="`y-axis-title-${track.index}-${axis.index}`"
    class="waveform-track__multi-axis-title"
    :data-y-axis-title-index="axis.index"
  >
    <rect
      class="waveform-track__y-axis-label-bg waveform-chart__y-axis-label-bg"
      :x="axis.labelX - 12"
      :y="track.height / 2 - 40"
      width="24"
      height="80"
      rx="2"
    />
    <text
      class="waveform-track__y-axis-label waveform-chart__y-axis-label"
      :fill="axis.seriesList[0].color"
      :transform="`translate(${axis.labelX}, ${track.height / 2}) rotate(-90)`"
      text-anchor="middle"
      dominant-baseline="central"
    >
      {{ resolveYAxisLabel(axis.seriesList[0]) }}
    </text>
  </g>
</template>
