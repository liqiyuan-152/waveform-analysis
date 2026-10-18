import { equalValue } from '../config/equal.js'
import { normalizeData } from '../data/normalize.js'
import type { WaveformData } from '../types/data.js'
import { SeriesModel } from './SeriesModel.js'

/** Owns committed data and visibility; rendering never reads caller-owned objects. */
export class WaveformModel {
  private items: SeriesModel[] = []
  readonly hiddenKeys = new Set<string>()

  constructor(data: WaveformData) {
    this.update(data)
  }

  get keyedSeries(): readonly SeriesModel[] {
    return this.items
  }
  get series() {
    return this.items.map((item) => item.series)
  }

  update(data: WaveformData) {
    const occurrences = new Map<string, number>()
    const normalized = normalizeData(data)
    if (equalValue(this.series, normalized)) return false
    this.items = normalized.map((series, index) => {
      const id = series.id?.trim()
      if (!id) return new SeriesModel(`index:${index}`, series)
      const occurrence = occurrences.get(id) ?? 0
      occurrences.set(id, occurrence + 1)
      return new SeriesModel(`id:${id}:${occurrence}`, series)
    })
    const keys = new Set(this.items.map((item) => item.key))
    for (const key of this.hiddenKeys) if (!keys.has(key)) this.hiddenKeys.delete(key)
    return true
  }

  toggle(key: string): boolean {
    if (!this.items.some((item) => item.key === key)) throw new Error('Unknown series key')
    if (this.hiddenKeys.has(key)) this.hiddenKeys.delete(key)
    else this.hiddenKeys.add(key)
    return !this.hiddenKeys.has(key)
  }
}
