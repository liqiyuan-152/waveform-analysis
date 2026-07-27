import { computed, type CSSProperties, type Ref } from 'vue'

import type { WaveformLegendOrientation, WaveformLegendPosition } from '../data/types'
import {
  margin,
  minimumHeight,
  TITLE_CHAR_WIDTH_RATIO,
  TITLE_DEFAULT_FONT_SIZE,
  TITLE_LINE_HEIGHT,
  ZERO_LINE_DEFAULTS,
} from './constants'
import { calculateRotatedTitleLayout, TITLE_AREA_HORIZONTAL_PADDING } from './title'
import type { ResolvedWaveformChartProps } from './waveformChartTypes'

interface PresentationContext {
  props: ResolvedWaveformChartProps
  observedWidth: Ref<number>
  observedHeight: Ref<number>
  measuredTitleWidth: Ref<number>
  measuredTitleHeight: Ref<number>
  internalHiddenSeriesIds: Ref<Set<string>>
  paginationBandHeight: Ref<number>
}

export function useWaveformPresentation(context: PresentationContext) {
  const {
    props,
    observedWidth,
    observedHeight,
    measuredTitleWidth,
    measuredTitleHeight,
    internalHiddenSeriesIds,
    paginationBandHeight,
  } = context
  const fixedWidth = computed(() =>
    Number.isFinite(props.width) ? Math.max(0, props.width ?? 0) : undefined,
  )
  const fixedHeight = computed(() =>
    Number.isFinite(props.height) ? Math.max(minimumHeight, props.height ?? 0) : undefined,
  )
  const chartWidth = computed(() =>
    observedWidth.value > 0 ? observedWidth.value : (fixedWidth.value ?? 0),
  )
  const chartHeight = computed(() =>
    observedHeight.value > 0 ? observedHeight.value : (fixedHeight.value ?? minimumHeight),
  )
  const containerStyle = computed(() => ({
    width: fixedWidth.value === undefined ? '100%' : `${fixedWidth.value}px`,
    height: fixedHeight.value === undefined ? '100%' : `${fixedHeight.value}px`,
  }))
  const isCleanView = computed(() => props.cleanView === true)
  const resolvedZeroLine = computed(() => {
    const width = props.zeroLine.width
    return {
      visible: props.zeroLine.visible === true,
      color: props.zeroLine.color || ZERO_LINE_DEFAULTS.COLOR,
      width:
        typeof width === 'number' && Number.isFinite(width) && width > 0
          ? width
          : ZERO_LINE_DEFAULTS.WIDTH,
      dash: props.zeroLine.dash ?? ZERO_LINE_DEFAULTS.DASH,
    }
  })
  const legendBackgroundColor = computed(
    () => props.legend.backgroundColor || 'rgba(255, 255, 255, 0.7)',
  )
  const legendInteractive = computed(() => props.legend.interactive === true)
  const hiddenSeriesIdSet = computed(() =>
    props.hiddenSeriesIds === undefined
      ? internalHiddenSeriesIds.value
      : new Set(props.hiddenSeriesIds),
  )
  const resolvedHiddenSeriesIds = computed(() => Array.from(hiddenSeriesIdSet.value))
  const resolveLegendPosition = (trackId: string): WaveformLegendPosition =>
    props.legend.trackPositions?.[trackId] ?? props.legend.position ?? 'top-right'
  const resolveLegendOrientation = (
    position: WaveformLegendPosition,
  ): Exclude<WaveformLegendOrientation, 'auto'> => {
    const orientation = props.legend.orientation ?? 'auto'
    if (orientation !== 'auto') return orientation
    return position === 'top' || position === 'bottom' ? 'horizontal' : 'vertical'
  }

  const resolvedTitleText = computed(() => props.title?.text.trim() ?? '')
  const titleAreaReserved = computed(
    () =>
      Boolean(props.title) && props.title?.visible !== false && resolvedTitleText.value.length > 0,
  )
  const titleVisible = computed(() => titleAreaReserved.value && !isCleanView.value)
  const titleFontSize = computed(() => {
    const fontSize = props.title?.textStyle?.fontSize
    return Number.isFinite(fontSize) && (fontSize ?? 0) > 0
      ? (fontSize as number)
      : TITLE_DEFAULT_FONT_SIZE
  })
  const titleRotation = computed(() => {
    const rotation = props.title?.textStyle?.rotation
    return Number.isFinite(rotation) ? (rotation as number) : 0
  })
  const titleIsRotated = computed(() => {
    const normalizedRotation = ((titleRotation.value % 360) + 360) % 360
    return normalizedRotation > 1e-6 && Math.abs(normalizedRotation - 360) > 1e-6
  })
  const titlePresentationStyle = computed<CSSProperties>(() => ({
    color: props.title?.textStyle?.color ?? '#1f2937',
    fontSize: `${titleFontSize.value}px`,
    fontFamily: props.title?.textStyle?.fontFamily || '"Microsoft YaHei", "微软雅黑", sans-serif',
    fontWeight: props.title?.textStyle?.fontWeight ?? 400,
    fontStyle: props.title?.textStyle?.fontStyle ?? 'normal',
    textDecoration: props.title?.textStyle?.textDecoration ?? 'none',
    letterSpacing: props.title?.textStyle?.letterSpacing ?? 'normal',
    lineHeight: String(TITLE_LINE_HEIGHT),
  }))
  const estimatedTitleWidth = computed(() => {
    const letterSpacing = Number.parseFloat(props.title?.textStyle?.letterSpacing ?? '')
    const spacingWidth = Number.isFinite(letterSpacing)
      ? Math.max(0, resolvedTitleText.value.length - 1) * letterSpacing
      : 0
    return Math.max(
      1,
      resolvedTitleText.value.length * titleFontSize.value * TITLE_CHAR_WIDTH_RATIO + spacingWidth,
    )
  })
  const titleAvailableWidth = computed(() => {
    const availableWidth = chartWidth.value - TITLE_AREA_HORIZONTAL_PADDING * 2
    return availableWidth > 0 ? availableWidth : estimatedTitleWidth.value
  })
  const titleMeasureStyle = computed<CSSProperties>(() => ({
    ...titlePresentationStyle.value,
    width: 'max-content',
    maxWidth: titleIsRotated.value ? 'none' : `${titleAvailableWidth.value}px`,
    whiteSpace: titleIsRotated.value ? 'nowrap' : 'normal',
    overflowWrap: titleIsRotated.value ? 'normal' : 'anywhere',
  }))
  const titleLayout = computed(() =>
    calculateRotatedTitleLayout({
      naturalWidth: measuredTitleWidth.value || estimatedTitleWidth.value,
      naturalHeight: measuredTitleHeight.value || titleFontSize.value * TITLE_LINE_HEIGHT,
      availableWidth: titleAvailableWidth.value,
      rotation: titleRotation.value,
    }),
  )
  const titleAreaHeight = computed(() =>
    titleAreaReserved.value ? titleLayout.value.areaHeight : 0,
  )
  const chartTopMargin = computed(() => margin.top)
  const drawingHeight = computed(() =>
    Math.max(0, chartHeight.value - titleAreaHeight.value - paginationBandHeight.value),
  )
  const innerHeight = computed(() => Math.max(0, drawingHeight.value - margin.top - margin.bottom))
  const titleAreaStyle = computed<CSSProperties>(() => ({
    height: `${titleAreaHeight.value}px`,
    justifyContent:
      props.title?.align === 'left'
        ? 'flex-start'
        : props.title?.align === 'right'
          ? 'flex-end'
          : 'center',
  }))
  const titleVisualStyle = computed<CSSProperties>(() => ({
    width: `${titleLayout.value.visualWidth}px`,
    height: `${titleLayout.value.visualHeight}px`,
  }))
  const titleTextStyle = computed<CSSProperties>(() => ({
    ...titlePresentationStyle.value,
    width: `${titleLayout.value.textWidth}px`,
    minHeight: `${titleLayout.value.textHeight}px`,
    textAlign: props.title?.align ?? 'center',
    whiteSpace: titleIsRotated.value ? 'nowrap' : 'normal',
    overflowWrap: titleIsRotated.value ? 'normal' : 'anywhere',
    transform: `translate(-50%, -50%) rotate(${titleRotation.value}deg) scale(${titleLayout.value.scale})`,
  }))

  return {
    fixedWidth,
    fixedHeight,
    chartWidth,
    chartHeight,
    containerStyle,
    isCleanView,
    resolvedZeroLine,
    legendBackgroundColor,
    legendInteractive,
    hiddenSeriesIdSet,
    resolvedHiddenSeriesIds,
    resolveLegendPosition,
    resolveLegendOrientation,
    resolvedTitleText,
    titleAreaReserved,
    titleVisible,
    titleMeasureStyle,
    titleLayout,
    titleAreaHeight,
    chartTopMargin,
    drawingHeight,
    innerHeight,
    titleAreaStyle,
    titleVisualStyle,
    titleTextStyle,
  }
}
