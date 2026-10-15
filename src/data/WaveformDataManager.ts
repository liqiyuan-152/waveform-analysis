import { prepareWaveformSeries, type PreparedWaveformSeries } from '../core/preparedWaveformSeries'
import type { WaveformData } from '../types/data'

export interface PreparedWaveformData {
  readonly input: WaveformData
  readonly series: PreparedWaveformSeries[]
  readonly retainEmpty: boolean
}

/** Preparation is transactional; a rejected option never changes the live point sources. */
export class WaveformDataManager {
  private current?: PreparedWaveformData
  private version = 0

  get revision() {
    return this.version
  }

  get series(): readonly PreparedWaveformSeries[] {
    return this.current?.series ?? []
  }

  prepare(input: WaveformData, retainEmpty = false): PreparedWaveformData {
    if (this.current?.input === input && this.current.retainEmpty === retainEmpty)
      return this.current
    const previousById = new Map(this.series.map((series) => [series.id, series]))
    const series = prepareWaveformSeries(input, retainEmpty).map((series) => {
      const previous = previousById.get(series.id)
      if (series.source.length || !previous || series.trackId !== previous.trackId) return series
      return {
        ...series,
        xDomain: previous.xDomain,
        yDomain: previous.yDomain,
        rawYMaximum: previous.rawYMaximum,
        rawYMinimum: previous.rawYMinimum,
      }
    })
    return { input, retainEmpty, series }
  }

  commit(candidate: PreparedWaveformData) {
    if (candidate === this.current) return false
    this.current = candidate
    this.version += 1
    return true
  }

  dispose() {
    this.current = undefined
  }
}
