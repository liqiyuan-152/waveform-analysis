import type { WaveformOverlayMode } from '../data/types'
import {
  Y_AXIS_CHARACTER_WIDTH,
  Y_AXIS_LABEL_BAND_WIDTH,
  Y_AXIS_LABEL_GAP,
  Y_AXIS_OUTER_PADDING,
  Y_AXIS_TICK_PADDING,
} from './constants'
import { axisTextMetrics, resolveRenderedYAxisSeriesGroups } from './layout'
import type { DisplayTrack } from './types'
import type { WaveformYDomain } from './yDomain'

export interface YAxisLayoutMetrics {
  tickClearance: number
  fullClearance: number
  labelCenterX: number
}

export function resolveViewportYDomains(
  displayMode: 'independent' | 'separated' | 'compact',
  chartTracks: DisplayTrack[],
  sharedYDomains: Record<string, [number, number]>,
  independentYDomains: Record<number, [number, number]>,
): Record<string, [number, number]> {
  if (displayMode !== 'independent') return sharedYDomains
  return Object.fromEntries(
    chartTracks.flatMap((track, index) => {
      const domain = independentYDomains[index]
      return domain ? [[track.id, domain]] : []
    }),
  )
}

export function resolveYAxisLayoutMetrics(
  chartTracks: DisplayTrack[],
  overlayMode: WaveformOverlayMode,
  yDomain: WaveformYDomain | undefined,
  yDomains: Record<string, WaveformYDomain> | undefined,
  viewportYDomains: Record<string, [number, number]>,
  nice: boolean,
  tickCount: number,
  compact: boolean,
): YAxisLayoutMetrics {
  const axisText = chartTracks
    .filter((track) => track.visibleSeries.length > 0)
    .flatMap((track) =>
      resolveRenderedYAxisSeriesGroups(track, overlayMode, yDomain, yDomains, viewportYDomains),
    )
    .map(
      (group) =>
        axisTextMetrics(
          group.domain,
          nice,
          undefined,
          group.seriesList[0]?.unit,
          tickCount,
          compact,
        ).tickTextWidth,
    )
  const tickTextWidth = Math.max(Y_AXIS_CHARACTER_WIDTH, ...axisText)
  const tickClearance = tickTextWidth + Y_AXIS_TICK_PADDING + Y_AXIS_OUTER_PADDING
  const labelCenterX = -(
    Y_AXIS_TICK_PADDING +
    tickTextWidth +
    Y_AXIS_LABEL_GAP +
    Y_AXIS_LABEL_BAND_WIDTH / 2
  )
  const fullClearance =
    tickTextWidth +
    Y_AXIS_TICK_PADDING +
    Y_AXIS_LABEL_GAP +
    Y_AXIS_LABEL_BAND_WIDTH +
    Y_AXIS_OUTER_PADDING
  return { tickClearance, fullClearance, labelCenterX }
}
