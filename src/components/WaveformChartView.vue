<script setup lang="ts">
import { Pagination } from 'ant-design-vue'
import { toRefs } from 'vue'

import { WaveformAnnotationContextMenu, WaveformAnnotationLayer } from './annotation'
import WaveformAnnotationEditor from './annotation/WaveformAnnotationEditor.vue'
import type { WaveformChartController } from './core/useWaveformChartController'
import { WaveformHoverHost } from './interaction'
import { WaveformHoverLayer, WaveformLegend, WaveformTrack } from './rendering'

const props = defineProps<{ controller: WaveformChartController }>()
const {
  displayMode,
  activeInteractionMode,
  isCleanView,
  isPresentationMode,
  selection,
  containerStyle,
  overlayMode,
  resolvedChartLeftMargin,
  titleAreaHeight,
  resolvedPlotMargin,
  pointerInsideChart,
  handleNativeContextMenu,
  titleAreaReserved,
  titleAreaStyle,
  titleVisible,
  titleMeasureStyle,
  resolvedTitleText,
  titleVisualStyle,
  titleTextStyle,
  titleLayout,
  chartWidth,
  drawingHeight,
  hasWaveformData,
  requestViewportReset,
  trackLayouts,
  clipPathId,
  chartTopMargin,
  gridCells,
  hasVisibleWaveformData,
  zoomable,
  isZoomMode,
  innerWidth,
  innerHeight,
  handleSharedPointerMove,
  beginSharedViewportDrag,
  finishViewportDrag,
  cancelViewportDrag,
  handlePointerLeave,
  handleAnnotationClick,
  handleAnnotationContextMenu,
  resolveFrameNumber,
  frameStyle,
  axes,
  resolvedZeroLine,
  timeUnit,
  yLabel,
  handleIndependentPointerMove,
  beginViewportDrag,
  hoverState,
  showTooltip,
  selectionBox,
  renderedAnnotations,
  annotationsVisible,
  handleExistingAnnotationContextMenu,
  beginAnnotationDrag,
  handleAnnotationMove,
  endAnnotationDrag,
  resolveLegendPosition,
  resolveLegendOrientation,
  legendBackgroundColor,
  legendInteractive,
  resolvedHiddenSeriesIds,
  toggleSeriesVisibility,
  resolvedXLabel,
  xAxisTitleY,
  hasChartArea,
  gridOptions,
  pageCount,
  currentPage,
  getPageSize,
  pageableTracks,
  goToPage,
  annotationInteraction,
  editorDraft,
  contextMenu,
  editorSeries,
  editorSeriesOptions,
  timeError,
  confirmAnnotation,
  cancelAnnotation,
  changeDraftSeries,
  changeDraftTime,
  editContextAnnotation,
  deleteContextAnnotation,
  chartHeight,
  setContainer,
  setSvgElement,
  setTitleMeasureElement,
  setSharedOverlayElement,
} = toRefs(props.controller)

function handleChartPointerLeave() {
  pointerInsideChart.value = false
  handlePointerLeave.value()
}
</script>

<template>
  <div
    :ref="setContainer"
    class="waveform-chart"
    :class="[
      `waveform-chart--${displayMode}`,
      `waveform-chart--interaction-${activeInteractionMode}`,
      {
        'waveform-chart--clean': isCleanView,
        'waveform-chart--presentation': isPresentationMode,
        'waveform-chart--panning': selection?.kind === 'pan',
      },
    ]"
    :style="containerStyle"
    :data-display-mode="displayMode"
    :data-interaction-mode="activeInteractionMode"
    :data-presentation-mode="isPresentationMode"
    :data-overlay-mode="overlayMode"
    :data-chart-left-margin="resolvedChartLeftMargin"
    :data-plot-margin-top="resolvedPlotMargin.top"
    :data-plot-margin-bottom="resolvedPlotMargin.bottom"
    :data-title-area-height="titleAreaHeight"
    @pointerenter="pointerInsideChart = true"
    @pointerleave="handleChartPointerLeave"
    @contextmenu.capture="handleNativeContextMenu"
  >
    <div
      v-if="titleAreaReserved"
      class="waveform-chart__title-area"
      :style="titleAreaStyle"
      :role="titleVisible ? 'heading' : undefined"
      :aria-level="titleVisible ? 2 : undefined"
      :aria-hidden="isCleanView || undefined"
    >
      <span
        :ref="setTitleMeasureElement"
        class="waveform-chart__title-measure"
        :style="titleMeasureStyle"
        aria-hidden="true"
      >
        {{ resolvedTitleText }}
      </span>
      <span v-if="titleVisible" class="waveform-chart__title-visual" :style="titleVisualStyle">
        <span
          class="waveform-chart__title-text"
          :style="titleTextStyle"
          :data-title-scale="titleLayout.scale"
          :data-title-wrapped="titleLayout.wrapped || undefined"
        >
          {{ resolvedTitleText }}
        </span>
      </span>
    </div>

    <svg
      :ref="setSvgElement"
      class="waveform-chart__svg"
      :width="chartWidth"
      :height="drawingHeight"
      role="img"
      :aria-label="hasWaveformData ? '波形折线图' : '暂无波形数据'"
      @dblclick="requestViewportReset"
    >
      <defs>
        <clipPath
          v-for="track in trackLayouts"
          :id="`${clipPathId}-${track.index}`"
          :key="`${clipPathId}-${track.index}`"
          clipPathUnits="userSpaceOnUse"
        >
          <rect :width="track.width" :height="track.height" />
        </clipPath>
      </defs>

      <g :transform="`translate(${resolvedChartLeftMargin}, ${chartTopMargin})`">
        <g
          v-if="displayMode !== 'compact' && !isCleanView"
          class="waveform-chart__grid-slots"
          aria-hidden="true"
        >
          <g
            v-for="cell in gridCells"
            :key="`grid-slot-${cell.slotIndex}`"
            :transform="`translate(${cell.left}, ${cell.top})`"
          >
            <rect
              v-if="!cell.series"
              class="waveform-chart__grid-slot-placeholder"
              :width="cell.width"
              :height="cell.cellHeight"
            />
          </g>
        </g>
        <rect
          v-if="displayMode !== 'independent' && trackLayouts.length && hasVisibleWaveformData"
          :ref="setSharedOverlayElement"
          class="waveform-chart__overlay waveform-chart__overlay--shared"
          :class="{
            'is-zoomable': !isPresentationMode && zoomable && isZoomMode,
            'is-annotating': !isPresentationMode && activeInteractionMode === 'annotation',
          }"
          :width="innerWidth"
          :height="innerHeight"
          @pointermove="handleSharedPointerMove"
          @pointerdown="beginSharedViewportDrag"
          @pointerup="finishViewportDrag"
          @pointercancel="cancelViewportDrag"
          @pointerleave="handlePointerLeave"
          @click="handleAnnotationClick"
          @contextmenu="handleAnnotationContextMenu"
        />

        <!-- 轨道渲染 -->
        <WaveformTrack
          v-for="track in trackLayouts"
          :key="`${track.index}-${track.id}`"
          :track="track"
          :clip-path-id="clipPathId"
          :inner-width="innerWidth"
          :zoomable="zoomable"
          :interactive="!isPresentationMode"
          :display-mode="displayMode"
          :interaction-mode="activeInteractionMode"
          :frame-number="resolveFrameNumber(track.id)"
          :frame-style="frameStyle"
          :axes="axes"
          :clean-view="isCleanView"
          :zero-line="resolvedZeroLine"
          :time-unit="timeUnit"
          :y-label="yLabel"
          @pointer-move="handleIndependentPointerMove($event, track.index)"
          @pointer-down="beginViewportDrag($event, track.index, true)"
          @pointer-up="finishViewportDrag"
          @pointer-cancel="cancelViewportDrag"
          @pointer-leave="handlePointerLeave"
          @click="handleAnnotationClick($event, track.index)"
          @contextmenu="handleAnnotationContextMenu($event, track.index)"
        />

        <WaveformHoverLayer
          :state="hoverState"
          :tracks="trackLayouts"
          :clip-path-id="clipPathId"
          :visible="showTooltip && !isPresentationMode"
        />

        <rect
          v-if="selectionBox && selection?.kind === 'box'"
          class="waveform-chart__zoom-selection"
          :x="selectionBox.x"
          :y="selectionBox.y"
          :width="selectionBox.width"
          :height="selectionBox.height"
          aria-hidden="true"
        />

        <WaveformAnnotationLayer
          v-if="!isCleanView"
          :annotations="renderedAnnotations"
          :visible="annotationsVisible"
          :interactive="!isPresentationMode"
          @contextmenu="handleExistingAnnotationContextMenu"
          @drag-start="beginAnnotationDrag"
          @move="handleAnnotationMove"
          @drag-end="endAnnotationDrag"
        />

        <g v-if="!isCleanView" class="waveform-chart__legend-layer">
          <g
            v-for="track in trackLayouts"
            :key="`legend-${track.index}-${track.id}`"
            class="waveform-chart__legend-track"
            :data-legend-track-index="track.index"
            :data-legend-track-id="track.id"
            :transform="`translate(${track.left}, ${track.top})`"
          >
            <WaveformLegend
              v-if="!track.isEmpty && track.legendSeries.length > 1"
              :series="track.legendSeries"
              :position="resolveLegendPosition(track.id)"
              :orientation="resolveLegendOrientation(resolveLegendPosition(track.id))"
              :background-color="legendBackgroundColor"
              :interactive="legendInteractive"
              :hidden-series-ids="resolvedHiddenSeriesIds"
              :width="track.width ?? innerWidth"
              :height="track.height"
              @toggle="toggleSeriesVisibility"
            />
          </g>
        </g>
      </g>

      <text
        v-if="resolvedXLabel && !isCleanView"
        class="waveform-chart__label waveform-chart__x-label"
        :x="resolvedChartLeftMargin + innerWidth / 2"
        :y="xAxisTitleY"
        text-anchor="middle"
      >
        {{ resolvedXLabel }}
      </text>

      <text
        v-if="hasChartArea && !hasWaveformData"
        class="waveform-chart__empty"
        :x="chartWidth / 2"
        :y="drawingHeight / 2"
        text-anchor="middle"
      >
        暂无有效波形数据
      </text>
    </svg>

    <Pagination
      v-if="gridOptions.showPagination && pageCount > 1 && !isCleanView"
      class="waveform-chart__pagination"
      aria-label="波形分页"
      :current="currentPage"
      :page-size="getPageSize(gridOptions)"
      :total="pageableTracks.length"
      :show-size-changer="false"
      :show-quick-jumper="false"
      @change="goToPage"
    />

    <WaveformAnnotationEditor
      v-if="editorDraft && !isCleanView && !isPresentationMode"
      :annotation="editorDraft.annotation"
      :mode="editorDraft.mode"
      :series="editorSeries"
      :series-options="editorSeriesOptions"
      :time-unit="timeUnit"
      :time-error="timeError"
      @confirm="confirmAnnotation"
      @cancel="cancelAnnotation"
      @series-change="changeDraftSeries"
      @time-change="changeDraftTime"
    />

    <WaveformAnnotationContextMenu
      v-if="!isCleanView && !isPresentationMode"
      :visible="contextMenu !== null"
      :x="contextMenu?.x || 0"
      :y="contextMenu?.y || 0"
      :can-edit="Boolean(contextMenu?.annotationId)"
      @edit="editContextAnnotation"
      @delete="deleteContextAnnotation"
      @close="annotationInteraction.closeContextMenu"
    />

    <WaveformHoverHost
      :state="hoverState"
      :visible="showTooltip && !isPresentationMode"
      :time-unit="timeUnit"
      :container-width="chartWidth"
      :container-height="chartHeight"
    />
  </div>
</template>
