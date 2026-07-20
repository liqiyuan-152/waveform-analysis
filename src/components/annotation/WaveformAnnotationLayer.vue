<script setup lang="ts">
import type { RenderedAnnotation } from './types'
import { ANNOTATION_TEXT_FONT, ANNOTATION_TEXT_LINE_HEIGHT } from './markup'

interface Props {
  annotations: RenderedAnnotation[]
  visible: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (event: 'contextmenu', annotationId: string, mouseEvent: MouseEvent): void
}>()

function handleContextMenu(annotationId: string, event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  emit('contextmenu', annotationId, event)
}

function markerId(annotationId: string) {
  return `waveform-annotation-arrow-${annotationId.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}
</script>

<template>
  <g v-if="props.visible" class="waveform-annotation-layer">
    <g
      v-for="rendered in props.annotations"
      :key="rendered.annotation.id"
      class="waveform-annotation"
      :data-annotation-id="rendered.annotation.id"
      :data-placement="rendered.placement"
      @contextmenu="handleContextMenu(rendered.annotation.id, $event)"
    >
      <defs>
        <marker
          :id="markerId(rendered.annotation.id)"
          markerWidth="8"
          markerHeight="8"
          refX="8"
          refY="4"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,0 L8,4 L0,8 Z" :fill="rendered.style.borderColor" />
        </marker>
      </defs>
      <line
        class="waveform-annotation__arrow"
        :x1="rendered.box.lineEndX"
        :y1="rendered.box.lineEndY"
        :x2="rendered.anchorX"
        :y2="rendered.anchorY"
        :stroke="rendered.style.borderColor"
        :marker-end="`url(#${markerId(rendered.annotation.id)})`"
      />
      <rect
        class="waveform-annotation__box"
        :x="rendered.box.x"
        :y="rendered.box.y"
        :width="rendered.box.width"
        :height="rendered.box.height"
        :fill="rendered.style.backgroundColor"
        :stroke="rendered.style.borderColor"
      />
      <text
        class="waveform-annotation__text"
        :x="rendered.box.x + rendered.box.width / 2"
        :y="
          rendered.box.y +
          rendered.box.height / 2 -
          ((rendered.lines.length - 1) * ANNOTATION_TEXT_LINE_HEIGHT) / 2
        "
        :fill="rendered.style.textColor"
        :style="{ font: ANNOTATION_TEXT_FONT }"
        text-anchor="middle"
        dominant-baseline="central"
      >
        <tspan
          v-for="(line, index) in rendered.lines"
          :key="`${rendered.annotation.id}-${index}`"
          :x="rendered.box.x + rendered.box.width / 2"
          :dy="index === 0 ? 0 : ANNOTATION_TEXT_LINE_HEIGHT"
        >
          {{ line }}
        </tspan>
      </text>
    </g>
  </g>
</template>

<style scoped>
.waveform-annotation-layer {
  pointer-events: none;
}

.waveform-annotation {
  pointer-events: auto;
  cursor: context-menu;
}

.waveform-annotation__arrow {
  stroke-width: 2;
  stroke-linecap: round;
  pointer-events: none;
}

.waveform-annotation__box {
  stroke-width: 1;
  rx: 3;
  pointer-events: auto;
}

.waveform-annotation__text {
  pointer-events: none;
  user-select: none;
}
</style>
