import type { TrackLayout, WaveformYAxisLayout } from './types'
import type { WaveformYAxisLabelTextStyle } from '../../types'
import { resolveYAxisSpaceBudget } from './yAxisSpaceBudget'

interface TitleLayoutOptions {
  labelTextStyle?: WaveformYAxisLabelTextStyle
  showUnits?: boolean
  compact?: boolean
  measureTextWidth?: (text: string) => number
}

type TitleTrack = Pick<TrackLayout, 'height' | 'column' | 'yAxes'>

function titleDistance(axis: WaveformYAxisLayout, options: TitleLayoutOptions): number {
  const series = axis.seriesList[0]
  return resolveYAxisSpaceBudget({
    unit: options.showUnits === false ? undefined : series?.unit,
    labelTextStyle: options.labelTextStyle,
    measureTextWidth: options.measureTextWidth,
  }).titleDistance
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
