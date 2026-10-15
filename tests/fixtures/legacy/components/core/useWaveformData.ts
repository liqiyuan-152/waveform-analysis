import { shallowRef, watch } from 'vue'

import type { WaveformData } from '@/types/index'
import { prepareWaveformSeries, type PreparedWaveformSeries } from '@/core/preparedWaveformSeries'

export { prepareWaveformSeries, type PreparedWaveformSeries } from '@/core/preparedWaveformSeries'

export function usePreparedWaveformSeries(
  data: () => WaveformData,
  onBeforeDataChange: () => void,
  onDataChange: () => void,
  retainEmpty: () => boolean = () => false,
) {
  const preparedSeries = shallowRef<PreparedWaveformSeries[]>(
    prepareWaveformSeries(data(), retainEmpty()),
  )
  watch([data, retainEmpty], ([nextData, preserveEmpty]) => {
    onBeforeDataChange()
    preparedSeries.value = prepareWaveformSeries(nextData, preserveEmpty)
    onDataChange()
  })
  return preparedSeries
}
