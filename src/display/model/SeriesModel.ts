import type { WaveformSeries } from '../types/data.js'

/** A normalized series and its instance-local selection identity. */
export class SeriesModel {
  constructor(
    readonly key: string,
    readonly series: WaveformSeries,
  ) {}
}
