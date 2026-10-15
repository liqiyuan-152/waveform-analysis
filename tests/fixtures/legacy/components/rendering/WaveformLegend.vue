<script setup lang="ts">
import { computed } from 'vue'

import type { WaveformLegendPosition } from '@/types/index'
import type { DisplaySeries } from '@/components/core/types'
import { formatChannelLabel } from '@/components/rendering/channelLabel'
import {
  waveformLegendErrorBarPath,
  waveformLegendLinePath,
  waveformLineDasharray,
  waveformPointSymbolPath,
} from '@/components/rendering/seriesStyle'

interface Props {
  series: DisplaySeries[]
  position: WaveformLegendPosition
  orientation: 'horizontal' | 'vertical'
  backgroundColor: string
  width: number
  height: number
  interactive?: boolean
  showUnits?: boolean
  hiddenSeriesIds?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  interactive: false,
  showUnits: false,
  hiddenSeriesIds: () => [],
})
const emit = defineEmits<{
  toggle: [seriesId: string]
}>()
const hiddenSeriesIdSet = computed(() => new Set(props.hiddenSeriesIds))

function legendLabel(series: DisplaySeries): string {
  return props.showUnits ? formatChannelLabel(series.name, series.unit, ' ') : series.name
}

function isHidden(seriesId: string): boolean {
  return hiddenSeriesIdSet.value.has(seriesId)
}

function toggleSeries(seriesId: string) {
  if (props.interactive) emit('toggle', seriesId)
}
</script>

<template>
  <foreignObject
    class="waveform-legend waveform-chart__legend"
    x="0"
    y="0"
    :width="width"
    :height="height"
    :data-position="position"
    :data-orientation="orientation"
    aria-label="曲线图例"
  >
    <div
      xmlns="http://www.w3.org/1999/xhtml"
      class="waveform-legend__viewport"
      :class="`waveform-legend__viewport--${position}`"
    >
      <div
        class="waveform-legend__panel"
        :class="[
          `waveform-legend__panel--${orientation}`,
          { 'waveform-legend__panel--interactive': interactive },
        ]"
        :style="{ backgroundColor }"
        role="list"
      >
        <button
          v-for="item in series"
          :key="item.id"
          class="waveform-legend__item waveform-chart__legend-item"
          :class="{ 'is-hidden': isHidden(item.id) }"
          type="button"
          role="listitem"
          :disabled="!interactive"
          :aria-pressed="interactive ? !isHidden(item.id) : undefined"
          :aria-label="
            interactive ? `${isHidden(item.id) ? '显示' : '隐藏'}曲线 ${item.name}` : undefined
          "
          @click.stop="toggleSeries(item.id)"
        >
          <svg
            class="waveform-legend__swatch"
            viewBox="0 0 26 16"
            aria-hidden="true"
            :data-line-type="item.lineType"
            :data-line-style="item.lineStyle"
            :data-point-type="item.pointType"
            :data-error-bar-visible="item.errorBar.visible || undefined"
          >
            <path
              v-if="waveformLegendLinePath(item.lineType)"
              class="waveform-legend__line"
              :d="waveformLegendLinePath(item.lineType) ?? undefined"
              :stroke="item.color"
              :stroke-dasharray="waveformLineDasharray(item.lineStyle)"
              stroke-width="1"
              fill="none"
            />
            <path
              v-if="item.errorBar.visible"
              class="waveform-legend__error-bar"
              :d="waveformLegendErrorBarPath(item.errorBar.capWidth)"
              :stroke="item.errorBar.color || item.color"
              :stroke-width="item.errorBar.width"
              stroke-linecap="butt"
              fill="none"
            />
            <path
              v-if="item.pointType !== 'none'"
              class="waveform-legend__point"
              :d="waveformPointSymbolPath(item.pointType, 30) ?? undefined"
              :fill="item.color"
              transform="translate(13 8)"
            />
          </svg>
          <span class="waveform-legend__label" :title="legendLabel(item)">{{
            legendLabel(item)
          }}</span>
        </button>
      </div>
    </div>
  </foreignObject>
</template>

<style src="../../../../../src/styles/legend.css"></style>
