import { formatYAxisTickLayoutLabel } from './layout'
import type { TrackLayout, WaveformYAxisLayout } from './types'
import type { WaveformYAxisLabelTextStyle } from '../../types'
import { resolveYAxisLabelBandWidth } from './yAxisLabelStyle'
import { Y_AXIS_CHARACTER_WIDTH, Y_AXIS_TICK_PADDING } from './yAxisConstants'

interface TitleLayoutOptions {
  labelTextStyle?: WaveformYAxisLabelTextStyle
  showUnits?: boolean
  compact?: boolean
  measureTextWidth?: (text: string) => number
}

type TitleTrack = Pick<TrackLayout, 'height' | 'column' | 'yAxes'>

function titleDistance(axis: WaveformYAxisLayout, options: TitleLayoutOptions): number {
  const series = axis.seriesList[0]
  // Reserve the widest tick, including extrema, regardless of the frame height.
  // The layout formatter excludes scientific multipliers but retains the numeric label.
  const tickWidths = axis.tickValues.map((value) => {
    const text = formatYAxisTickLayoutLabel(
      value,
      axis.scale.domain() as [number, number],
      axis.tickValues,
      options.showUnits === false ? undefined : series?.unit,
    )
    return options.measureTextWidth?.(text) ?? text.length * Y_AXIS_CHARACTER_WIDTH
  })
  // The title band leaves 4px beside each glyph.
  return (
    Math.max(Y_AXIS_CHARACTER_WIDTH, ...tickWidths) +
    Y_AXIS_TICK_PADDING +
    resolveYAxisLabelBandWidth(options.labelTextStyle) / 2
  )
}

export function alignLeftYAxisTitles(
  layouts: TitleTrack[],
  _yLabel?: string,
  options: TitleLayoutOptions = {},
): void {
  const distances = new Map<string, number>()
  for (const track of layouts) {
    let leftIndex = 0
    for (const axis of track.yAxes) {
      if (axis.side !== 'left') continue
      const key = `${track.column}:${leftIndex++}`
      const distance = titleDistance(axis, options)
      distances.set(key, Math.max(distances.get(key) ?? 0, distance))
    }
  }
  for (const track of layouts) {
    let leftIndex = 0
    for (const axis of track.yAxes) {
      if (axis.side !== 'left') continue
      axis.labelX = axis.x - distances.get(`${track.column}:${leftIndex++}`)!
    }
  }
}
