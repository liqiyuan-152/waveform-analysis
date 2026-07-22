<script setup lang="ts">
import { computed } from 'vue'

import type { WaveformLegendPosition } from '../../types'
import type { DisplaySeries } from '../core/types'
import {
  waveformLegendErrorBarPath,
  waveformLegendLinePath,
  waveformLineDasharray,
  waveformPointSymbolPath,
} from './seriesStyle'

interface Props {
  series: DisplaySeries[]
  position: WaveformLegendPosition
  orientation: 'horizontal' | 'vertical'
  backgroundColor: string
  width: number
  height: number
  interactive?: boolean
  hiddenSeriesIds?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  interactive: false,
  hiddenSeriesIds: () => [],
})
const emit = defineEmits<{
  toggle: [seriesId: string]
}>()
const hiddenSeriesIdSet = computed(() => new Set(props.hiddenSeriesIds))

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
              stroke-width="1.5"
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
          <span class="waveform-legend__label" :title="item.name">{{ item.name }}</span>
        </button>
      </div>
    </div>
  </foreignObject>
</template>

<style scoped>
.waveform-legend {
  overflow: hidden;
  pointer-events: none;
}

.waveform-legend__viewport {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  height: 100%;
  padding: 8px;
  overflow: hidden;
}

.waveform-legend__viewport--top-left {
  align-items: flex-start;
  justify-content: flex-start;
}

.waveform-legend__viewport--top {
  align-items: flex-start;
  justify-content: center;
}

.waveform-legend__viewport--top-right {
  align-items: flex-start;
  justify-content: flex-end;
}

.waveform-legend__viewport--right {
  align-items: center;
  justify-content: flex-end;
}

.waveform-legend__viewport--bottom-right {
  align-items: flex-end;
  justify-content: flex-end;
}

.waveform-legend__viewport--bottom {
  align-items: flex-end;
  justify-content: center;
}

.waveform-legend__viewport--bottom-left {
  align-items: flex-end;
  justify-content: flex-start;
}

.waveform-legend__viewport--left {
  align-items: center;
  justify-content: flex-start;
}

.waveform-legend__panel {
  display: flex;
  flex: 0 1 auto;
  gap: 5px 12px;
  max-width: 100%;
  max-height: 100%;
  padding: 5px 7px;
  overflow: hidden;
  color: #344054;
  font: 12px/1.35 sans-serif;
  border: 1px solid rgb(208 213 221 / 90%);
  border-radius: 4px;
}

.waveform-legend__panel--interactive {
  pointer-events: auto;
}

.waveform-legend__panel--horizontal {
  flex-flow: row wrap;
  align-items: center;
}

.waveform-legend__panel--vertical {
  flex-flow: column nowrap;
  align-items: stretch;
}

.waveform-legend__item {
  display: flex;
  min-width: 0;
  max-width: 160px;
  align-items: center;
  gap: 6px;
  padding: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  white-space: nowrap;
  appearance: none;
  background: none;
  border: 0;
}

.waveform-legend__item:disabled {
  opacity: 1;
}

.waveform-legend__panel--interactive .waveform-legend__item {
  cursor: pointer;
}

.waveform-legend__panel--interactive .waveform-legend__item:focus-visible {
  outline: 2px solid #1677ff;
  outline-offset: 2px;
}

.waveform-legend__item.is-hidden {
  opacity: 0.45;
}

.waveform-legend__item.is-hidden .waveform-legend__label {
  text-decoration: line-through;
}

.waveform-legend__swatch {
  flex: 0 0 26px;
  width: 26px;
  height: 16px;
  overflow: visible;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.waveform-legend__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
