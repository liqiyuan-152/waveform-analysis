import { computed, ref } from 'vue'

import type { WaveformXAxisLabelFormatter } from '../types'

export type DemoXAxisLabelFormat = 'number' | 'datetime'
export type DemoXAxisLabelTimeZone = 'local' | 'Asia/Shanghai' | 'UTC'

const formatOptions = [
  { label: '数值', value: 'number' as const },
  { label: '固定时间', value: 'datetime' as const },
]
const timeZoneOptions = [
  { label: '中国标准时间', value: 'Asia/Shanghai' as const },
  { label: '本地时区', value: 'local' as const },
  { label: 'UTC', value: 'UTC' as const },
]

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}

export function formatDemoTimestamp(
  value: number,
  timeZone: DemoXAxisLabelTimeZone,
  showMilliseconds: boolean,
): string {
  const offset = timeZone === 'Asia/Shanghai' ? 8 * 60 * 60 * 1000 : 0
  const date = new Date(value + offset)
  if (!Number.isFinite(date.getTime())) return String(value)

  const useUtcFields = timeZone !== 'local'
  const year = useUtcFields ? date.getUTCFullYear() : date.getFullYear()
  const month = (useUtcFields ? date.getUTCMonth() : date.getMonth()) + 1
  const day = useUtcFields ? date.getUTCDate() : date.getDate()
  const hours = useUtcFields ? date.getUTCHours() : date.getHours()
  const minutes = useUtcFields ? date.getUTCMinutes() : date.getMinutes()
  const seconds = useUtcFields ? date.getUTCSeconds() : date.getSeconds()
  const milliseconds = useUtcFields ? date.getUTCMilliseconds() : date.getMilliseconds()
  const suffix = showMilliseconds ? `.${pad(milliseconds, 3)}` : ''
  return `${year}-${pad(month)}-${pad(day)} ${pad(hours)}:${pad(minutes)}:${pad(seconds)}${suffix}`
}

export function useDemoXAxisLabelControls() {
  const xAxisLabelFormatterEnabled = ref(false)
  const xAxisLabelFormat = ref<DemoXAxisLabelFormat>('number')
  const xAxisLabelMultiplier = ref(1)
  const xAxisLabelFractionDigits = ref(3)
  const xAxisLabelTimeZone = ref<DemoXAxisLabelTimeZone>('Asia/Shanghai')
  const xAxisLabelShowMilliseconds = ref(false)
  const xAxisLabelFormatter = computed<WaveformXAxisLabelFormatter | undefined>(() => {
    if (!xAxisLabelFormatterEnabled.value) return undefined
    if (xAxisLabelFormat.value === 'datetime') {
      return (value) =>
        formatDemoTimestamp(value, xAxisLabelTimeZone.value, xAxisLabelShowMilliseconds.value)
    }

    const multiplier = Number.isFinite(xAxisLabelMultiplier.value) ? xAxisLabelMultiplier.value : 1
    const fractionDigits = Number.isFinite(xAxisLabelFractionDigits.value)
      ? Math.min(12, Math.max(0, Math.trunc(xAxisLabelFractionDigits.value)))
      : 0
    return (value) => (value * multiplier).toFixed(fractionDigits)
  })

  return {
    controlModel: {
      xAxisLabelFormatterEnabled,
      xAxisLabelFormat,
      xAxisLabelFormatOptions: formatOptions,
      xAxisLabelMultiplier,
      xAxisLabelFractionDigits,
      xAxisLabelTimeZone,
      xAxisLabelTimeZoneOptions: timeZoneOptions,
      xAxisLabelShowMilliseconds,
    },
    xAxisLabelFormatter,
  }
}
