import { formatYAxisTickLayoutLabel } from './layout'
import type { TrackLayout, WaveformYAxisLayout } from './types'
import {
  Y_AXIS_CHARACTER_WIDTH,
  Y_AXIS_LABEL_BAND_WIDTH,
  Y_AXIS_TICK_PADDING,
} from './yAxisConstants'

// Match the 12px channel names and 11px ticks in WaveformTrack.css.
const TITLE_FONT_SIZE = 12
const TICK_FONT_SIZE = 11
const TEXT_GAP = 2

interface TitleLayoutOptions {
  showUnits?: boolean
  compact?: boolean
  measureTextWidth?: (text: string) => number
}

function estimateTitleWidth(title: string): number {
  return Array.from(title).reduce((width, character) => {
    // Latin labels average well below one em; full-width characters occupy one em.
    const em = /[\u2e80-\u9fff\uf900-\ufaff\uff01-\uff60]/u.test(character)
      ? 1
      : /[MW@%]/u.test(character)
        ? 0.95
        : /[ilI1., :;|'!]/u.test(character)
          ? 0.4
          : 0.65
    return width + em * TITLE_FONT_SIZE
  }, 0)
}

type TitleTrack = Pick<TrackLayout, 'height' | 'column' | 'yAxes'>

function titleDistance(
  track: TitleTrack,
  axis: WaveformYAxisLayout,
  yLabel: string | undefined,
  options: TitleLayoutOptions,
): number {
  const series = axis.seriesList[0]
  const title = series?.name.trim() || yLabel || ''
  const halfTitleHeight = estimateTitleWidth(title) / 2
  const titleTop = track.height / 2 - halfTitleHeight - TEXT_GAP
  const titleBottom = track.height / 2 + halfTitleHeight + TEXT_GAP
  const lowestTick = Math.min(...axis.tickValues)
  const highestTick = Math.max(...axis.tickValues)
  const tickWidths = axis.tickValues.flatMap((value) => {
    // D3 places ticks at scale(value) + 0.5. The lowest label is bottom-aligned;
    // all other labels are vertically centered using dy="0.32em".
    const y = axis.scale(value) + 0.5
    const isTopAligned = options.compact && value === highestTick
    const top = y - (value === lowestTick ? TICK_FONT_SIZE : isTopAligned ? 0 : TICK_FONT_SIZE / 2)
    const bottom =
      value === lowestTick ? y : y + (isTopAligned ? TICK_FONT_SIZE : TICK_FONT_SIZE / 2)
    if (bottom < titleTop || top > titleBottom) return []
    const text = formatYAxisTickLayoutLabel(
      value,
      axis.scale.domain() as [number, number],
      axis.tickValues,
      options.showUnits === false ? undefined : series?.unit,
    )
    return [options.measureTextWidth?.(text) ?? text.length * Y_AXIS_CHARACTER_WIDTH]
  })
  // The 20px title band leaves 4px beside a 12px glyph.
  return (
    Math.max(Y_AXIS_CHARACTER_WIDTH, ...tickWidths) +
    Y_AXIS_TICK_PADDING +
    Y_AXIS_LABEL_BAND_WIDTH / 2
  )
}

export function alignLeftYAxisTitles(
  layouts: TitleTrack[],
  yLabel?: string,
  options: TitleLayoutOptions = {},
): void {
  const distances = new Map<string, number>()
  for (const track of layouts) {
    let leftIndex = 0
    for (const axis of track.yAxes) {
      if (axis.side !== 'left') continue
      const key = `${track.column}:${leftIndex++}`
      const distance = titleDistance(track, axis, yLabel, options)
      // Compact slots already reserve every tick. Only move names inward, so
      // alignment can never push them beyond the space reserved at the chart edge.
      const boundedDistance = options.compact ? Math.min(axis.x - axis.labelX, distance) : distance
      distances.set(key, Math.max(distances.get(key) ?? 0, boundedDistance))
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
