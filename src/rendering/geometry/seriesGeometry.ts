import { resolveWaveformPointErrors } from '../../core/data'
import type { TrackLayout, TrackSeriesPath } from '../../components/core/types'
import {
  waveformPointSeriesPath,
  waveformPointSymbolArea,
} from '../../components/rendering/seriesStyle'

/** Shared by native and Vue views; sampling chooses points before geometry is encoded. */
export function seriesGeometry(path: TrackSeriesPath, track: TrackLayout) {
  const pointPath = waveformPointSeriesPath(
    path.series.pointType,
    path.pointRenderPoints.map((point) => ({
      x: track.xScale(point.x),
      y: path.yScale(point.y),
    })),
    waveformPointSymbolArea(path.series.pointSize),
  )
  const half = path.series.errorBar.capWidth / 2
  const errorBarPath = path.errorBarRenderPoints
    .map((point) => {
      const { lower, upper } = resolveWaveformPointErrors(point)
      const x = track.xScale(point.x)
      const lowerY = path.yScale(point.y - lower)
      const upperY = path.yScale(point.y + upper)
      return (
        `M${x - half},${lowerY}H${x + half}M${x},${lowerY}V${upperY}` +
        `M${x - half},${upperY}H${x + half}`
      )
    })
    .join('')
  return { pointPath, errorBarPath: errorBarPath || null }
}
