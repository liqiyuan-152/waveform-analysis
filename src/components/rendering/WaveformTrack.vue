<script setup lang="ts">
import { computed } from 'vue'

import type { WaveformAxesOptions, WaveformFrameStyle, WaveformZeroLineOptions } from '../../types'
import type { TrackLayout } from '../core/types'
import type { WaveformDisplayMode, WaveformInteractionMode } from '../data/types'
import WaveformSeriesLayer from './WaveformSeriesLayer.vue'
import WaveformTrackAxes from './WaveformTrackAxes.vue'
import WaveformTrackBackdrop from './WaveformTrackBackdrop.vue'

interface Props {
  track: TrackLayout
  clipPathId: string
  innerWidth: number
  zoomable: boolean
  interactive?: boolean
  displayMode: WaveformDisplayMode
  interactionMode?: WaveformInteractionMode
  frameNumber?: string | number
  frameStyle?: WaveformFrameStyle
  axes?: WaveformAxesOptions
  timeUnit: 's' | 'ms'
  yLabel?: string
  cleanView?: boolean
  zeroLine?: Required<Pick<WaveformZeroLineOptions, 'color' | 'width' | 'dash'>> & {
    visible: boolean
  }
}

interface Emits {
  (event: 'pointer-move', pointerEvent: PointerEvent): void
  (event: 'pointer-down', pointerEvent: PointerEvent): void
  (event: 'pointer-up', pointerEvent: PointerEvent): void
  (event: 'pointer-cancel', pointerEvent: PointerEvent): void
  (event: 'pointer-leave'): void
  (event: 'click', mouseEvent: MouseEvent): void
  (event: 'contextmenu', mouseEvent: MouseEvent): void
}

const props = withDefaults(defineProps<Props>(), {
  interactionMode: 'zoom',
  interactive: true,
  cleanView: false,
  zeroLine: () => ({ visible: false, color: '#98a2b3', width: 1, dash: '6 4' }),
})
const emit = defineEmits<Emits>()

const resolvedFrameStyle = computed(() => {
  const borderWidth = props.frameStyle?.borderWidth
  return {
    borderColor: props.frameStyle?.borderColor || '#1f2937',
    borderWidth:
      typeof borderWidth === 'number' && Number.isFinite(borderWidth) && borderWidth >= 0
        ? borderWidth
        : 1,
    borderStyle:
      props.frameStyle?.borderStyle === 'dashed' || props.frameStyle?.borderStyle === 'dotted'
        ? props.frameStyle.borderStyle
        : 'solid',
    backgroundColor: props.frameStyle?.backgroundColor || 'transparent',
  }
})
</script>

<template>
  <g
    class="waveform-track waveform-chart__track"
    :class="{ 'waveform-track--empty waveform-chart__track--empty': track.isEmpty }"
    :data-track-index="track.index"
    :data-track-empty="track.isEmpty || undefined"
    :data-track-left="track.left"
    :data-track-width="track.width"
    :data-y-axis-label-x="track.yAxisLabelX"
    :data-track-top="track.top"
    :data-track-height="track.height"
    :transform="`translate(${track.left ?? 0}, ${track.top})`"
  >
    <WaveformTrackBackdrop
      :track="track"
      :clip-path-id="clipPathId"
      :inner-width="innerWidth"
      :clean-view="cleanView"
      :frame-number="frameNumber"
      :frame-style="resolvedFrameStyle"
      :zero-line="zeroLine"
    />
    <WaveformTrackAxes
      :track="track"
      :inner-width="innerWidth"
      :clean-view="cleanView"
      :axes="axes"
      :time-unit="timeUnit"
      :y-label="yLabel"
    />

    <rect
      v-if="!track.isEmpty"
      class="waveform-track__plot-frame waveform-chart__plot-frame"
      :width="track.width ?? innerWidth"
      :height="track.height"
      fill="none"
      :stroke="resolvedFrameStyle.borderColor"
      :stroke-width="resolvedFrameStyle.borderWidth"
      :stroke-dasharray="
        resolvedFrameStyle.borderStyle === 'dashed'
          ? '6 4'
          : resolvedFrameStyle.borderStyle === 'dotted'
            ? '1 3'
            : undefined
      "
      :stroke-linecap="resolvedFrameStyle.borderStyle === 'dotted' ? 'round' : undefined"
      aria-hidden="true"
    />

    <WaveformSeriesLayer :track="track" :clip-path-id="clipPathId" />

    <rect
      v-if="!track.isEmpty && track.hasVisibleSeries && displayMode === 'independent'"
      class="waveform-track__overlay waveform-track__overlay--independent waveform-chart__overlay waveform-chart__overlay--independent"
      :class="{
        'is-zoomable': interactive && zoomable && interactionMode === 'zoom',
        'is-annotating': interactive && interactionMode === 'annotation',
        'is-presentation': !interactive,
      }"
      :data-interactive="interactive"
      :data-independent-overlay-index="track.index"
      :width="track.width ?? innerWidth"
      :height="track.height"
      @pointermove="emit('pointer-move', $event)"
      @pointerdown="emit('pointer-down', $event)"
      @pointerup="emit('pointer-up', $event)"
      @pointercancel="emit('pointer-cancel', $event)"
      @pointerleave="emit('pointer-leave')"
      @click="emit('click', $event)"
      @contextmenu="emit('contextmenu', $event)"
    />

    <text
      v-if="!track.isEmpty && !track.hasVisibleSeries && !cleanView"
      class="waveform-track__no-visible-series"
      :x="(track.width ?? innerWidth) / 2"
      :y="track.height / 2"
      text-anchor="middle"
      dominant-baseline="central"
    >
      暂无可见曲线
    </text>
  </g>
</template>

<style src="./WaveformTrack.css"></style>
