import type { WaveformAmplitudeLimits } from '../../types'
import type { WaveformOverlayMode } from '../data/types'
import {
  Y_AXIS_CHARACTER_WIDTH,
  Y_AXIS_LABEL_GAP,
  Y_AXIS_OUTER_PADDING,
  Y_AXIS_TICK_PADDING,
} from './constants'
import { axisTextMetrics, resolveRenderedYAxisSeriesGroups } from './layout'
import type { DisplayTrack } from './types'
import type { WaveformYDomain } from './yDomain'
import type { YAxisPaddingOptions } from './yAxisPadding'
import { resolveYAxisLabelBandWidth } from './yAxisLabelStyle'

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
  padding?: YAxisPaddingOptions | number,
  showUnits = true,
  measureTextWidth?: (text: string) => number,
  amplitudeLimits?: WaveformAmplitudeLimits,
): YAxisLayoutMetrics {
  const labelBandWidth = resolveYAxisLabelBandWidth(
    typeof padding === 'object' ? padding.labelTextStyle : undefined,
  )
  const axisText = chartTracks
    .filter((track) => track.series.length > 0)
    .flatMap((track) =>
      resolveRenderedYAxisSeriesGroups(
        track,
        overlayMode,
        yDomain,
        yDomains,
        viewportYDomains,
        padding,
        amplitudeLimits,
      ),
    )
    .map((group) =>
      axisTextMetrics(
        group.domain,
        nice,
        undefined,
        showUnits ? group.seriesList[0]?.unit : undefined,
        tickCount,
        compact,
        measureTextWidth,
        group.maximumTick,
        group.minimumTick,
        group.tickBounds,
      ),
    )
  const tickTextWidth = Math.max(
    Y_AXIS_CHARACTER_WIDTH,
    ...axisText.map((text) => text.tickTextWidth),
  )
  const titleTextWidth = Math.max(
    Y_AXIS_CHARACTER_WIDTH,
    ...axisText.map((text) => text.titleTextWidth),
  )
  const tickClearance = tickTextWidth + Y_AXIS_TICK_PADDING + Y_AXIS_OUTER_PADDING
  const labelCenterX = -(
    Y_AXIS_TICK_PADDING +
    titleTextWidth +
    Y_AXIS_LABEL_GAP +
    labelBandWidth / 2
  )
  const fullClearance =
    Math.max(tickTextWidth, titleTextWidth + Y_AXIS_LABEL_GAP + labelBandWidth) +
    Y_AXIS_TICK_PADDING +
    Y_AXIS_OUTER_PADDING
  return { tickClearance, fullClearance, labelCenterX }
}
