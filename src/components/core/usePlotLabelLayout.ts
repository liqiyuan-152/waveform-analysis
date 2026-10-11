import { computed, type CSSProperties, type ComputedRef } from 'vue'
import type { ResolvedWaveformChartProps } from './waveformChartTypes'

export function usePlotLabelLayout(
  props: ResolvedWaveformChartProps,
  plotLeft: ComputedRef<number>,
  plotWidth: ComputedRef<number>,
  titleAreaStyle: ComputedRef<CSSProperties>,
) {
  const plotCenterX = computed(() => plotLeft.value + plotWidth.value / 2)
  const plotTitleAreaStyle = computed<CSSProperties>(() =>
    !props.title?.align || props.title.align === 'center' || props.title.align === 'left'
      ? {
          ...titleAreaStyle.value,
          boxSizing: 'border-box',
          marginLeft: `${plotLeft.value}px`,
          width: `${plotWidth.value}px`,
          ...(props.title?.align === 'left' ? { paddingLeft: '0px', paddingRight: '0px' } : {}),
        }
      : titleAreaStyle.value,
  )
  return { plotCenterX, plotTitleAreaStyle }
}
