import type { WaveformLayoutChange } from './options.js'

export interface SeriesVisibilityChange {
  seriesKey: string
  seriesId?: string
  seriesIndex: number
  visible: boolean
}

export interface WaveformEvents {
  layoutChange: WaveformLayoutChange
  seriesVisibilityChange: SeriesVisibilityChange
}
