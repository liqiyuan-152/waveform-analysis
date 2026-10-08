import { formatYAxisTickLabel } from './layout'
import type { TrackLayout, WaveformYAxisLayout } from './types'
import {
  Y_AXIS_CHARACTER_WIDTH,
  Y_AXIS_LABEL_BAND_WIDTH,
  Y_AXIS_TICK_PADDING,
} from './yAxisConstants'

// Match the existing 14px channel names and 11px ticks in WaveformTrack.css.
const TITLE_FONT_SIZE = 14
const TICK_FONT_SIZE = 11
const TEXT_GAP = 2

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

function titleDistance(track: TitleTrack, axis: WaveformYAxisLayout, yLabel?: string): number {
  const series = axis.seriesList[0]
  const title = series?.name.trim() || yLabel || ''
  const halfTitleHeight = estimateTitleWidth(title) / 2
  const titleTop = track.height / 2 - halfTitleHeight - TEXT_GAP
  const titleBottom = track.height / 2 + halfTitleHeight + TEXT_GAP
  const lowestTick = Math.min(...axis.tickValues)
  const tickWidths = axis.tickValues.flatMap((value) => {
    // D3 places ticks at scale(value) + 0.5. The lowest label is bottom-aligned;
    // all other labels are vertically centered using dy="0.32em".
    const y = axis.scale(value) + 0.5
    const top = y - (value === lowestTick ? TICK_FONT_SIZE : TICK_FONT_SIZE / 2)
    const bottom = value === lowestTick ? y : y + TICK_FONT_SIZE / 2
    if (bottom < titleTop || top > titleBottom) return []
    return [
      formatYAxisTickLabel(
        value,
        axis.scale.domain() as [number, number],
        axis.tickValues,
        series?.unit,
      ).length * Y_AXIS_CHARACTER_WIDTH,
    ]
  })
  // The 20px title band already leaves 3px beside a 14px glyph.
  return (
    Math.max(Y_AXIS_CHARACTER_WIDTH, ...tickWidths) +
    Y_AXIS_TICK_PADDING +
    Y_AXIS_LABEL_BAND_WIDTH / 2
  )
}

export function alignLeftYAxisTitles(layouts: TitleTrack[], yLabel?: string): void {
  const distances = new Map<string, number>()
  for (const track of layouts) {
    let leftIndex = 0
    for (const axis of track.yAxes) {
      if (axis.side !== 'left') continue
      const key = `${track.column}:${leftIndex++}`
      distances.set(key, Math.max(distances.get(key) ?? 0, titleDistance(track, axis, yLabel)))
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
