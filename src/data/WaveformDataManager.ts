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
    return { input, retainEmpty, series: prepareWaveformSeries(input, retainEmpty) }
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
