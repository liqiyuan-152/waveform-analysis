import type { PreparedWaveformSeries } from '../core/preparedWaveformSeries'
import type { WaveformPointSource } from '../core/waveformPointSource'

/** Bounded by current input series; a fresh transport key rejects late version acknowledgments. */
export class SamplingDatasetRegistry {
  private current = new Map<string, { id: string; source: WaveformPointSource }>()
  private sequence = 0

  get ids() {
    return new Map([...this.current].map(([id, entry]) => [id, entry.id]))
  }

  reconcile(instanceId: string, series: readonly PreparedWaveformSeries[]) {
    const next = new Map<string, { id: string; source: WaveformPointSource }>()
    for (const item of series) {
      const previous = this.current.get(item.id)
      next.set(
        item.id,
        previous?.source === item.source
          ? previous
          : {
              id: `${instanceId}:${item.id}:${++this.sequence}`,
              source: item.source,
            },
      )
    }
    const retired = [...this.current].filter(([id, entry]) => next.get(id) !== entry)
    this.current = next
    return retired.map(([seriesId, entry]) => ({ seriesId, datasetId: entry.id }))
  }

  clear() {
    this.current.clear()
  }
}
