import { SamplingSession } from './SamplingSession'
import { WorkerSamplingClient } from './WorkerSamplingClient'
import { resolveWaveformRenderingOptions } from '../core/renderingOptions'
import type { ResolvedWaveformChartProps } from '../types/options'
import type { SingleWaveformData } from '../types/data'

function pointCount(data: SingleWaveformData) {
  if (data.kind === 'points') return data.points.length
  if (data.kind === 'typed-points') return data.x.length
  return data.values.length
}

/** Starts the owned transport while synchronous normalization prepares large inputs. */
export class NativeSamplingSession extends SamplingSession {
  constructor(window: Window & typeof globalThis) {
    super(
      () => new WorkerSamplingClient(window, true),
      {
        setTimeout: (callback, delay) => window.setTimeout(callback, delay),
        clearTimeout: (timer) => {
          if (typeof timer === 'number') window.clearTimeout(timer)
        },
      },
      true,
      true,
    )
  }

  prewarm(options: ResolvedWaveformChartProps) {
    const { mode, autoThreshold } = resolveWaveformRenderingOptions(options.rendering).sampling
    if (mode === 'raw') return
    // Visibility and explicit track ordering need normalized IDs/layout; leave these cases lazy.
    if (
      options.hiddenSeriesIds?.length ||
      options.defaultHiddenSeriesIds.length ||
      options.grid.trackOrder !== undefined
    )
      return
    const data = options.data
    const sources = data.kind === 'series' ? data.series.map((series) => series.data) : [data]
    if (sources.some((source) => pointCount(source) > (mode === 'auto' ? autoThreshold : 0)))
      this.getClient()
  }
}
