<script setup lang="ts">
import type { WaveformLegendPosition } from '../../types'
import type { DisplaySeries } from '../core/types'

interface Props {
  series: DisplaySeries[]
  position: WaveformLegendPosition
  orientation: 'horizontal' | 'vertical'
  backgroundColor: string
  width: number
  height: number
}

defineProps<Props>()
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
        :class="`waveform-legend__panel--${orientation}`"
        :style="{ backgroundColor }"
        role="list"
      >
        <div
          v-for="item in series"
          :key="item.id"
          class="waveform-legend__item waveform-chart__legend-item"
          role="listitem"
        >
          <i class="waveform-legend__swatch" :style="{ backgroundColor: item.color }" />
          <span class="waveform-legend__label" :title="item.name">{{ item.name }}</span>
        </div>
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
  white-space: nowrap;
}

.waveform-legend__swatch {
  flex: 0 0 18px;
  width: 18px;
  height: 2px;
}

.waveform-legend__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
