/**
 * 时间单位类型
 */
export type TimeUnit = 'ms' | 's'

export interface ScientificAxisLabelOptions {
  /** @deprecated Y-axis labels always use five significant digits before localization. */
  precision?: number
  axisMin?: number
  axisMax?: number
  topTickValue?: number
}

/** @deprecated Use ScientificAxisLabelOptions. */
export type ScientificYAxisLabelOptions = ScientificAxisLabelOptions

const SCIENTIFIC_MIN_ABSOLUTE_VALUE = 0.001
const SCIENTIFIC_MAX_PLAIN_ABSOLUTE_VALUE = 1000
const Y_AXIS_NUMBER_FORMATTER = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 4,
})
const TOOLTIP_NUMBER_FORMATTER = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 4,
})
const X_AXIS_TIME_FORMATTER = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 0,
  useGrouping: false,
})

function formatFixedNumber(value: number, precision: number): string {
  const formatted = value.toFixed(Math.max(0, precision))
  return /^-0(?:\.0+)?$/.test(formatted) ? formatted.slice(1) : formatted
}

/** Whether an axis magnitude should use one shared scientific exponent. */
export function shouldUseScientificAxisLabel(maxAbsoluteValue: number): boolean {
  return (
    Number.isFinite(maxAbsoluteValue) &&
    (maxAbsoluteValue >= SCIENTIFIC_MAX_PLAIN_ABSOLUTE_VALUE ||
      (maxAbsoluteValue > 0 && maxAbsoluteValue < SCIENTIFIC_MIN_ABSOLUTE_VALUE))
  )
}

export function resolveScientificAxisExponent(axisMin?: number, axisMax?: number): number | null {
  if (typeof axisMin !== 'number' || typeof axisMax !== 'number') return null

  const maxValue = Math.max(axisMin, axisMax)
  const absoluteMaxValue = Math.abs(maxValue)
  return shouldUseScientificAxisLabel(absoluteMaxValue)
    ? Math.floor(Math.log10(absoluteMaxValue))
    : null
}

function formatExponent(exponent: number): string {
  const sign = exponent >= 0 ? '+' : '-'
  return `E${sign}${Math.abs(exponent).toString().padStart(2, '0')}`
}

function formatYAxisNumber(value: number): string {
  if (Object.is(value, -0)) return '0'
  const roundedValue = value === 0 ? 0 : Number(value.toPrecision(5))
  const formatted = Y_AXIS_NUMBER_FORMATTER.format(roundedValue)
  return formatted === '-0' ? '0' : formatted
}

/** Format a Y-axis tick, sharing one exponent derived from the complete axis domain. */
export function formatScientificAxisLabel(
  value: number,
  options: ScientificAxisLabelOptions = {},
): string {
  if (!Number.isFinite(value)) return String(value)

  const exponent = resolveScientificAxisExponent(options.axisMin, options.axisMax)
  const scaledValue = exponent === null ? value : value / 10 ** exponent
  const formattedValue = formatYAxisNumber(scaledValue)
  const topTickValue = options.topTickValue ?? options.axisMax
  return exponent !== null && value === topTickValue
    ? `${formatExponent(exponent)} ${formattedValue}`
    : formattedValue
}

/** Return the shared E-style multiplier for an axis, or null for a plain axis. */
export function formatScientificAxisExponent(axisMin?: number, axisMax?: number): string | null {
  const exponent = resolveScientificAxisExponent(axisMin, axisMax)
  return exponent === null ? null : formatExponent(exponent)
}

/** @deprecated Use shouldUseScientificAxisLabel. */
export const shouldUseScientificYAxisLabel = shouldUseScientificAxisLabel

/** @deprecated Use formatScientificAxisLabel. */
export function formatScientificYAxisLabel(
  value: number,
  options: ScientificYAxisLabelOptions = {},
): string {
  return formatScientificAxisLabel(value, options)
}

/** Format tooltip values as localized plain numbers with at most four decimal places. */
export function formatTooltipNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  if (Object.is(value, -0)) return '0'
  return TOOLTIP_NUMBER_FORMATTER.format(value)
}

/** Format an X-axis time value as a plain integer without grouping separators. */
function formatAxisTimeValue(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  const formatted = X_AXIS_TIME_FORMATTER.format(value)
  return formatted === '-0' ? '0' : formatted
}

/** Convert a number to complete plain decimal text without forcing exponential notation. */
export function formatPlainNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  if (Object.is(value, -0)) return '0'

  const [mantissaPart, exponentPart] = value.toExponential().split('e')
  const exponent = Number(exponentPart)
  const isNegative = mantissaPart.startsWith('-')
  const digits = mantissaPart.replace('-', '').replace('.', '')
  const decimalIndex = exponent + 1
  let plainText: string

  if (decimalIndex <= 0) {
    plainText = `0.${'0'.repeat(Math.abs(decimalIndex))}${digits}`
  } else if (decimalIndex >= digits.length) {
    plainText = `${digits}${'0'.repeat(decimalIndex - digits.length)}`
  } else {
    plainText = `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`
  }

  return `${isNegative ? '-' : ''}${plainText}`
}

/**
 * 根据时间单位转换显示值
 * @param value 原始时间值（秒）
 * @param timeUnit 时间单位
 * @returns 转换后的显示值
 */
export function displayTime(value: number, timeUnit: TimeUnit): number {
  return timeUnit === 'ms' ? value * 1000 : value
}

/**
 * 计算端点标签的小数位数
 * @param domain 数据域 [最小值, 最大值]
 * @param timeUnit 时间单位
 * @returns 小数位数
 */
export function endpointFractionDigits(domain: [number, number], timeUnit: TimeUnit): number {
  const displayedSpan = Math.abs(
    displayTime(domain[1], timeUnit) - displayTime(domain[0], timeUnit),
  )
  if (!Number.isFinite(displayedSpan) || displayedSpan <= 0) return 0
  return Math.min(4, Math.max(0, Math.ceil(-Math.log10(displayedSpan / 100))))
}

/**
 * 将 X 轴端点时间格式化为当前显示单位下的普通整数
 * @param value 时间值（秒）
 * @param _domain 数据域（为保持现有调用签名而保留）
 * @param timeUnit 时间单位
 * @returns 格式化的时间字符串
 */
export function formatEndpointTime(
  value: number,
  _domain: [number, number],
  timeUnit: TimeUnit,
): string {
  return formatAxisTimeValue(displayTime(value, timeUnit))
}

/**
 * 将 X 轴时间刻度格式化为当前显示单位下的普通整数
 * @param value 时间值（秒）
 * @param timeUnit 时间单位
 * @param _domain 数据域（为保持现有调用签名而保留）
 * @returns 格式化的时间字符串
 */
export function formatAxisTime(
  value: number,
  timeUnit: TimeUnit,
  _domain?: [number, number],
): string {
  void _domain
  return formatAxisTimeValue(displayTime(value, timeUnit))
}

/**
 * 格式化悬浮提示时间（4 位小数，本地化格式）
 * @param value 时间值（秒）
 * @param timeUnit 时间单位
 * @returns 格式化的时间字符串
 */
export function formatTooltipTime(value: number, timeUnit: TimeUnit): string {
  return formatTooltipNumber(displayTime(value, timeUnit))
}

/** Format an annotation X coordinate in the selected display time unit. */
export function formatAnnotationTime(value: number, timeUnit: TimeUnit): string {
  if (!Number.isFinite(value)) return String(value)
  return formatFixedNumber(displayTime(value, timeUnit), 3)
}
