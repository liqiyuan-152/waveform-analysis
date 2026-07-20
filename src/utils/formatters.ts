/**
 * 时间单位类型
 */
export type TimeUnit = 'ms' | 's'

export interface ScientificAxisLabelOptions {
  precision?: number
  axisMin?: number
  axisMax?: number
}

/** @deprecated Use ScientificAxisLabelOptions. */
export type ScientificYAxisLabelOptions = ScientificAxisLabelOptions & {
  topTickValue?: number
}

const DEFAULT_Y_AXIS_PRECISION = 2
const SCIENTIFIC_MIN_ABSOLUTE_VALUE = 0.01
const SCIENTIFIC_MAX_PLAIN_ABSOLUTE_VALUE = 100
const TOOLTIP_NUMBER_FORMATTER = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 4,
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

  const maxAbsoluteValue = Math.max(Math.abs(axisMin), Math.abs(axisMax))
  return shouldUseScientificAxisLabel(maxAbsoluteValue)
    ? Math.floor(Math.log10(maxAbsoluteValue))
    : null
}

function formatExponent(exponent: number): string {
  const sign = exponent >= 0 ? '+' : '-'
  return `E${sign}${Math.abs(exponent).toString().padStart(2, '0')}`
}

/** Format a Y-axis tick, sharing one exponent derived from the complete axis domain. */
export function formatScientificAxisLabel(
  value: number,
  options: ScientificAxisLabelOptions = {},
): string {
  if (!Number.isFinite(value)) return String(value)

  const precision = options.precision ?? DEFAULT_Y_AXIS_PRECISION
  const exponent = resolveScientificAxisExponent(options.axisMin, options.axisMax)
  const scaledValue = exponent === null ? value : value / 10 ** exponent
  return formatFixedNumber(scaledValue, precision)
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
 * 按完整 X 轴显示域格式化端点时间
 * @param value 时间值（秒）
 * @param domain 数据域
 * @param timeUnit 时间单位
 * @returns 格式化的时间字符串
 */
export function formatEndpointTime(
  value: number,
  domain: [number, number],
  timeUnit: TimeUnit,
): string {
  const [axisMin, axisMax] = domain.map((domainValue) => displayTime(domainValue, timeUnit)) as [
    number,
    number,
  ]
  return formatScientificAxisLabel(displayTime(value, timeUnit), {
    axisMin,
    axisMax,
  })
}

/**
 * 按完整 X 轴显示域格式化时间刻度
 * @param value 时间值（秒）
 * @param timeUnit 时间单位
 * @returns 格式化的时间字符串
 */
export function formatAxisTime(
  value: number,
  timeUnit: TimeUnit,
  domain?: [number, number],
): string {
  const displayValue = displayTime(value, timeUnit)
  const displayDomain = domain?.map((domainValue) => displayTime(domainValue, timeUnit)) as
    [number, number] | undefined
  return formatScientificAxisLabel(displayValue, {
    axisMin: displayDomain?.[0],
    axisMax: displayDomain?.[1],
  })
}

/** Return the shared multiplier for an X-axis domain in its selected display unit. */
export function formatAxisTimeExponent(
  domain: [number, number],
  timeUnit: TimeUnit,
): string | null {
  const [axisMin, axisMax] = domain.map((value) => displayTime(value, timeUnit)) as [number, number]
  return formatScientificAxisExponent(axisMin, axisMax)
}

/**
 * 格式化悬浮提示时间（4 位小数，本地化格式）
 * @param value 时间值（秒）
 * @param timeUnit 时间单位
 * @returns 格式化的时间字符串
 */
export function formatTooltipTime(value: number, timeUnit: TimeUnit): string {
  const displayValue = displayTime(value, timeUnit)
  return displayValue.toLocaleString('zh-CN', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  })
}

/** Format an annotation X coordinate in the selected display time unit. */
export function formatAnnotationTime(value: number, timeUnit: TimeUnit): string {
  if (!Number.isFinite(value)) return String(value)
  return formatFixedNumber(displayTime(value, timeUnit), 3)
}
