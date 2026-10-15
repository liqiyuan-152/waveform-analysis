import { computed, onBeforeUnmount, onMounted, ref, watchPostEffect, type Ref } from 'vue'
import type { WaveformChartController } from '../core/useWaveformChartController'
import type { resolveToolbar } from './toolbarRegistry'

export function useToolbarPosition(
  element: Ref<HTMLElement | undefined>,
  controller: () => WaveformChartController,
  config: Ref<ReturnType<typeof resolveToolbar>>,
  menuElement: Ref<HTMLElement | undefined>,
) {
  const width = ref(0)
  const height = ref(0)
  const paginationHeight = ref(32)
  const menuWidth = ref(0)
  const menuHeight = ref(0)
  let observer: ResizeObserver | undefined
  const measure = () => {
    width.value = element.value?.offsetWidth ?? 0
    height.value = element.value?.offsetHeight ?? 0
    menuWidth.value = menuElement.value?.offsetWidth ?? 0
    menuHeight.value = menuElement.value?.offsetHeight ?? 0
    const pagination = element.value?.parentElement?.querySelector<HTMLElement>(
      '.waveform-chart__pagination',
    )
    paginationHeight.value = pagination?.offsetHeight || 32
  }
  onMounted(() => {
    observer = new ResizeObserver(measure)
    if (element.value) observer.observe(element.value)
  })
  watchPostEffect(() => {
    // Rebind after visibility changes and pagination mounts/unmounts.
    const node = element.value
    const menu = menuElement.value
    void controller().paginationVisible
    void controller().chartWidth
    void controller().chartHeight
    observer?.disconnect()
    if (node) {
      observer?.observe(node)
      if (menu) observer?.observe(menu)
      const pagination = node.parentElement?.querySelector('.waveform-chart__pagination')
      if (pagination) observer?.observe(pagination)
    }
    measure()
  })
  onBeforeUnmount(() => observer?.disconnect())
  return computed(() => {
    const c = controller()
    const options = config.value
    const top = c.titleAreaHeight + 2
    const bottom = c.paginationVisible ? paginationHeight.value + 8 : 2
    const availableHeight = Math.max(0, c.chartHeight - top - bottom)
    const atBottom = options.position.startsWith('bottom')
    const atLeft = options.position.endsWith('left')
    const x = Math.max(
      0,
      2 +
        Math.min(
          atLeft ? options.offsetX : -options.offsetX,
          Math.max(0, c.chartWidth - Math.max(width.value, menuWidth.value) - 4),
        ),
    )
    const y = Math.min(
      atBottom ? -options.offsetY : options.offsetY,
      Math.max(0, availableHeight - height.value - menuHeight.value),
    )
    return {
      left: atLeft ? `${x}px` : 'auto',
      right: atLeft ? 'auto' : `${x}px`,
      top: atBottom ? 'auto' : `${Math.max(0, top + y)}px`,
      bottom: atBottom ? `${Math.max(0, bottom + y)}px` : 'auto',
      maxHeight: `${availableHeight}px`,
    }
  })
}
