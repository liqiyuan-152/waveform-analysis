import { nextTick, watch, onMounted, onBeforeUnmount } from 'vue'
import type { LifecycleContext } from './useWaveformChartLifecycle'

export function useWaveformMeasurements(
  context: Pick<
    LifecycleContext,
    | 'container'
    | 'titleMeasureElement'
    | 'resizeObserver'
    | 'observedWidth'
    | 'observedHeight'
    | 'measuredTitleWidth'
    | 'measuredTitleHeight'
    | 'resolvedTitleText'
    | 'titleAreaReserved'
    | 'titleMeasureStyle'
  >,
) {
  const {
    container,
    titleMeasureElement,
    resizeObserver,
    observedWidth,
    observedHeight,
    measuredTitleWidth,
    measuredTitleHeight,
    resolvedTitleText,
    titleAreaReserved,
    titleMeasureStyle,
  } = context
  function measureTitle() {
    if (!titleAreaReserved.value || !titleMeasureElement.value) {
      measuredTitleWidth.value = 0
      measuredTitleHeight.value = 0
      return
    }
    const bounds = titleMeasureElement.value.getBoundingClientRect()
    measuredTitleWidth.value = titleMeasureElement.value.scrollWidth || bounds.width
    measuredTitleHeight.value = titleMeasureElement.value.scrollHeight || bounds.height
  }

  watch(
    [resolvedTitleText, titleAreaReserved, titleMeasureStyle],
    async () => {
      measuredTitleWidth.value = 0
      measuredTitleHeight.value = 0
      await nextTick()
      measureTitle()
    },
    { immediate: true },
  )

  onMounted(() => {
    if (!container.value) return
    resizeObserver.value = new ResizeObserver(([entry]) => {
      observedWidth.value = Math.max(0, entry?.contentRect.width ?? 0)
      observedHeight.value = Math.max(0, entry?.contentRect.height ?? 0)
      void nextTick(measureTitle)
    })
    resizeObserver.value.observe(container.value)
  })
  onBeforeUnmount(() => resizeObserver.value?.disconnect())
}
