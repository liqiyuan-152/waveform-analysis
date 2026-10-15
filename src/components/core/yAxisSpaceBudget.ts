import type { WaveformYAxisLabelTextStyle } from '../../types'
import { Y_AXIS_OUTER_PADDING, Y_AXIS_TICK_PADDING } from './yAxisConstants'
import { resolveYAxisLabelBandWidth } from './yAxisLabelStyle'
import { measureYAxisTextWidth } from './yAxisTextWidth'

interface YAxisSpaceBudgetOptions {
  unit?: string
  labelTextStyle?: WaveformYAxisLabelTextStyle
  measureTextWidth?: (text: string) => number
}

interface YAxisSpaceBudget {
  tickWidth: number
  titleTickWidth: number
  titleWidth: number
  titleGap: number
  tickClearance: number
  titleDistance: number
  clearance: number
}

// Five significant digits and at most four decimal places bound ordinary
// labels. Rounding a value below 1000 can still produce a grouped "1,000".
const numberSamples = Array.from({ length: 10 }, (_, index) => {
  const digit = String(index)
  return [
    `-${digit.repeat(3)}.${digit.repeat(2)}`,
    `-${digit.repeat(2)}.${digit.repeat(3)}`,
    `-${digit}.${digit.repeat(4)}`,
    `-0.${digit.repeat(4)}`,
    `-${digit},${digit.repeat(3)}`,
  ]
}).flat()

// A finite JavaScript number needs at most three exponent digits. Include
// either metadata placement, since right axes append their exponent.
const scientificSamples = Array.from({ length: 10 }, (_, index) => {
  const digit = String(index)
  const number = `-${digit}.${digit.repeat(4)}`
  return ['+', '-'].flatMap((sign) => {
    const exponent = `E${sign}${digit.repeat(3)}`
    return [`${exponent} ${number}`, `${number} ${exponent}`]
  })
}).flat()

const MAX_CACHED_UNIT_COUNT = 128
type TickWidths = Pick<YAxisSpaceBudget, 'tickWidth' | 'titleTickWidth'>
const defaultTickWidthCache = new Map<string, TickWidths>()

function resolveTickWidths(options: YAxisSpaceBudgetOptions): TickWidths {
  const unit = options.unit?.trim() ?? ''
  const cachedWidth = options.measureTextWidth ? undefined : defaultTickWidthCache.get(unit)
  if (cachedWidth !== undefined) return cachedWidth
  const measureTextWidth = options.measureTextWidth ?? measureYAxisTextWidth
  const ordinarySamples = unit
    ? numberSamples.flatMap((number) => [`(${unit}) ${number}`, `${number} (${unit})`])
    : numberSamples
  const titleTickWidth = Math.ceil(Math.max(...ordinarySamples.map(measureTextWidth)))
  const tickWidth = Math.max(
    titleTickWidth,
    Math.ceil(Math.max(...scientificSamples.map(measureTextWidth))),
  )
  const widths = { tickWidth, titleTickWidth }
  // Axis text has one fixed font. Reuse its measurements through viewport
  // updates, but never reuse measurements supplied by a caller.
  if (!options.measureTextWidth) {
    if (defaultTickWidthCache.size >= MAX_CACHED_UNIT_COUNT) defaultTickWidthCache.clear()
    defaultTickWidthCache.set(unit, widths)
  }
  return widths
}

function createBudget(
  { tickWidth, titleTickWidth }: TickWidths,
  titleWidth: number,
): YAxisSpaceBudget {
  const titleGap = 2
  const tickClearance = tickWidth + Y_AXIS_TICK_PADDING + Y_AXIS_OUTER_PADDING
  const numericWidth = titleTickWidth + Y_AXIS_TICK_PADDING
  const clearance = Math.max(
    tickClearance,
    numericWidth + titleWidth + titleGap + Math.max(6, Y_AXIS_OUTER_PADDING),
  )
  const titleDistance = numericWidth + titleGap + titleWidth / 2
  return {
    tickWidth,
    titleTickWidth,
    titleWidth,
    titleGap,
    tickClearance,
    titleDistance,
    clearance,
  }
}

/** Names clear the numeric labels; exponents may share the name band's horizontal space. */
export function resolveYAxisSpaceBudget(options: YAxisSpaceBudgetOptions = {}): YAxisSpaceBudget {
  return createBudget(
    resolveTickWidths(options),
    resolveYAxisLabelBandWidth(options.labelTextStyle),
  )
}

/** Equal outer widths can still need different name positions within the same slot. */
export function mergeYAxisSpaceBudgets(a: YAxisSpaceBudget, b: YAxisSpaceBudget): YAxisSpaceBudget {
  return createBudget(
    {
      tickWidth: Math.max(a.tickWidth, b.tickWidth),
      titleTickWidth: Math.max(a.titleTickWidth, b.titleTickWidth),
    },
    Math.max(a.titleWidth, b.titleWidth),
  )
}
