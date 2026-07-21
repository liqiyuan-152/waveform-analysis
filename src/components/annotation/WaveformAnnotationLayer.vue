<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { RenderedAnnotation } from './types'
import { ANNOTATION_TEXT_FONT, ANNOTATION_TEXT_LINE_HEIGHT } from './markup'

interface Props {
  annotations: RenderedAnnotation[]
  visible: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (event: 'contextmenu', annotationId: string, mouseEvent: MouseEvent): void
  (event: 'drag-start'): void
  (event: 'move', annotationId: string, offsetX: number, offsetY: number): void
  (event: 'drag-end', cancelled?: boolean): void
}>()

interface DragState {
  annotationId: string
  pointerId: number
  startX: number
  startY: number
  deltaX: number
  deltaY: number
  initialOffsetX: number
  initialOffsetY: number
  moved: boolean
  target: SVGGElement
}

const dragOffsets = ref(new Map<string, { x: number; y: number }>())
const pendingCommittedOffset = ref<{
  annotationId: string
  x: number
  y: number
} | null>(null)
let dragState: DragState | null = null
let dragFrame: number | null = null
let lastDragEndTimestamp = 0 // 使用时间戳替代 suppressContextMenu 布尔标志

// 缓存 draggedBox 结果以避免在每次渲染时重复计算
const draggedBoxCache = computed(() => {
  const cache = new Map<string, RenderedAnnotation['box']>()
  props.annotations.forEach((rendered) => {
    const offset = dragOffsets.value.get(rendered.annotation.id)
    if (!offset) {
      cache.set(rendered.annotation.id, rendered.box)
    } else {
      cache.set(rendered.annotation.id, {
        ...rendered.box,
        x: rendered.box.x + offset.x,
        y: rendered.box.y + offset.y,
        lineEndX: rendered.box.lineEndX + offset.x,
        lineEndY: rendered.box.lineEndY + offset.y,
      })
    }
  })
  return cache
})

function draggedBox(rendered: RenderedAnnotation): RenderedAnnotation['box'] {
  return draggedBoxCache.value.get(rendered.annotation.id) ?? rendered.box
}

function flushDragFrame() {
  dragFrame = null
  if (!dragState) return
  dragOffsets.value = new Map(dragOffsets.value).set(dragState.annotationId, {
    x: dragState.deltaX,
    y: dragState.deltaY,
  })
}

function scheduleDragFrame() {
  if (dragFrame !== null) return
  dragFrame = requestAnimationFrame(flushDragFrame)
}

function handlePointerDown(rendered: RenderedAnnotation, event: PointerEvent) {
  if (event.button !== 0 || dragState) return
  event.preventDefault()
  event.stopPropagation()
  const target = event.currentTarget as SVGGElement | null
  if (!target || typeof target.setPointerCapture !== 'function') return
  target.setPointerCapture(event.pointerId)
  emit('drag-start')
  const currentDragOffset = dragOffsets.value.get(rendered.annotation.id)
  const initialOffsetX =
    (Number.isFinite(rendered.annotation.labelOffsetX) ? rendered.annotation.labelOffsetX! : 0) +
    (currentDragOffset?.x ?? 0)
  const initialOffsetY =
    (Number.isFinite(rendered.annotation.labelOffsetY) ? rendered.annotation.labelOffsetY! : 0) +
    (currentDragOffset?.y ?? 0)
  dragState = {
    annotationId: rendered.annotation.id,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    deltaX: 0,
    deltaY: 0,
    initialOffsetX,
    initialOffsetY,
    moved: false,
    target,
  }
}

function handlePointerMove(event: PointerEvent) {
  event.stopPropagation()
  if (!dragState || event.pointerId !== dragState.pointerId) return
  const deltaX = event.clientX - dragState.startX
  const deltaY = event.clientY - dragState.startY
  dragState.deltaX = deltaX
  dragState.deltaY = deltaY
  dragState.moved = dragState.moved || Math.hypot(deltaX, deltaY) >= 2
  if (dragState.moved) scheduleDragFrame()
}

function finishPointerDrag(event: PointerEvent) {
  event.preventDefault()
  event.stopPropagation()
  if (!dragState || event.pointerId !== dragState.pointerId) return
  const state = dragState
  const finalDeltaX = event.clientX - state.startX
  const finalDeltaY = event.clientY - state.startY
  state.deltaX = finalDeltaX
  state.deltaY = finalDeltaY
  // Recalculate moved based on final position to avoid spurious move events
  state.moved = Math.hypot(finalDeltaX, finalDeltaY) >= 2
  state.moved = state.moved || Math.hypot(finalDeltaX, finalDeltaY) >= 2
  if (dragFrame !== null) {
    cancelAnimationFrame(dragFrame)
    dragFrame = null
  }
  if (state.moved) {
    dragOffsets.value = new Map(dragOffsets.value).set(state.annotationId, {
      x: state.deltaX,
      y: state.deltaY,
    })
    const offsetX = state.initialOffsetX + state.deltaX
    const offsetY = state.initialOffsetY + state.deltaY
    pendingCommittedOffset.value = { annotationId: state.annotationId, x: offsetX, y: offsetY }
    dragState = null
    // 使用时间戳记录拖动结束，用于在 contextmenu 中检查
    lastDragEndTimestamp = event.timeStamp
    emit('move', state.annotationId, offsetX, offsetY)
  } else {
    dragState = null
  }
  if (state.target.hasPointerCapture(state.pointerId)) {
    state.target.releasePointerCapture(state.pointerId)
  }
  // Don't modify dragOffsets for non-moved drags to preserve persisted offsets
  emit('drag-end', false)
}

watch(
  () => props.annotations,
  (annotations) => {
    const pending = pendingCommittedOffset.value
    // 优化：仅在有待处理的提交偏移时才执行
    if (!pending) return
    const annotation = annotations.find((item) => item.annotation.id === pending.annotationId)
    if (!annotation) return
    const offsetX = Number.isFinite(annotation.annotation.labelOffsetX)
      ? annotation.annotation.labelOffsetX!
      : 0
    const offsetY = Number.isFinite(annotation.annotation.labelOffsetY)
      ? annotation.annotation.labelOffsetY!
      : 0
    if (offsetX === pending.x && offsetY === pending.y) {
      dragOffsets.value = new Map(dragOffsets.value).set(pending.annotationId, { x: 0, y: 0 })
      pendingCommittedOffset.value = null
    }
  },
)

function handlePointerCancel(event: PointerEvent) {
  event.preventDefault()
  event.stopPropagation()
  if (!dragState || event.pointerId !== dragState.pointerId) return
  const state = dragState
  dragState = null
  dragOffsets.value = new Map(dragOffsets.value).set(state.annotationId, { x: 0, y: 0 })
  if (dragFrame !== null) {
    cancelAnimationFrame(dragFrame)
    dragFrame = null
  }
  emit('drag-end', true)
}

function handleContextMenu(annotationId: string, event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  // 使用时间戳比较：如果 contextmenu 在拖动结束后 100ms 内触发，则抑制
  // 这比依赖事件顺序更可靠
  if (event.timeStamp - lastDragEndTimestamp < 100) return
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
      @pointerdown="handlePointerDown(rendered, $event)"
      @pointermove="handlePointerMove"
      @pointerup="finishPointerDrag"
      @pointercancel="handlePointerCancel"
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
        :x1="draggedBox(rendered).lineEndX"
        :y1="draggedBox(rendered).lineEndY"
        :x2="rendered.anchorX"
        :y2="rendered.anchorY"
        :stroke="rendered.style.borderColor"
        :marker-end="`url(#${markerId(rendered.annotation.id)})`"
      />
      <rect
        class="waveform-annotation__box"
        :x="draggedBox(rendered).x"
        :y="draggedBox(rendered).y"
        :width="draggedBox(rendered).width"
        :height="draggedBox(rendered).height"
        :fill="rendered.style.backgroundColor"
        :stroke="rendered.style.borderColor"
      />
      <text
        class="waveform-annotation__text"
        :x="draggedBox(rendered).x + draggedBox(rendered).width / 2"
        :y="
          draggedBox(rendered).y +
          draggedBox(rendered).height / 2 -
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
          :x="draggedBox(rendered).x + draggedBox(rendered).width / 2"
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
  cursor: grab;
  touch-action: none;
}

.waveform-annotation:active {
  cursor: grabbing;
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
