import { onBeforeUnmount, onMounted, shallowRef, type Ref } from 'vue'
import { Waveform, type WaveformData, type WaveformOptions } from 'waveform-analysis/display'

/** The adapter owns only the instance it successfully creates. */
export function useWaveform(
  container: Ref<HTMLElement | null>,
  initial: () => { data: WaveformData; options: WaveformOptions },
  report: (error: Error) => void,
) {
  const chart = shallowRef<Waveform | null>(null)
  onMounted(() => {
    try {
      const target = container.value
      if (!target) throw new Error('预览容器尚未挂载')
      if (Waveform.getInstanceByDom(target)) throw new Error('预览容器已被其他图表占用')
      const value = initial()
      chart.value = new Waveform(target, value.data, value.options)
    } catch (error) {
      report(error instanceof Error ? error : new Error(String(error)))
    }
  })
  onBeforeUnmount(() => {
    chart.value?.destroy()
    chart.value = null
  })
  return chart
}
