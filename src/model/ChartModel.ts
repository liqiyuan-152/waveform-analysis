import { OptionManager } from './OptionManager'
import { ViewportModel } from './ViewportModel'
import { SeriesVisibilityModel } from './SeriesVisibilityModel'
import { PresentationModel } from './PresentationModel'
import { WaveformDataManager } from '../data/WaveformDataManager'
import { WaveformQueryService } from '../data/WaveformQueryService'
import type { WaveformChartOptions, WaveformChartOptionUpdate } from '../types/options'

/** Composition owns state once; views read these owners instead of mirroring them. */
export class ChartModel {
  readonly options: OptionManager
  readonly viewport = new ViewportModel()
  readonly visibility: SeriesVisibilityModel
  readonly presentation = new PresentationModel()
  readonly data = new WaveformDataManager()
  readonly query = new WaveformQueryService(this.data)

  constructor(options: WaveformChartOptions | OptionManager = {}) {
    this.options = options instanceof OptionManager ? options : new OptionManager(options)
    this.visibility = new SeriesVisibilityModel(this.options.value.defaultHiddenSeriesIds)
    this.data.commit(this.data.prepare(this.options.value.data, true))
  }

  setOption(patch: WaveformChartOptionUpdate) {
    const candidate = this.options.prepare(patch)
    const data = this.data.prepare(candidate.resolved.data, true)
    const changed = Object.keys(patch).some(
      (key) =>
        candidate.resolved[key as keyof WaveformChartOptionUpdate] !==
        this.options.value[key as keyof WaveformChartOptionUpdate],
    )
    if (!changed) return { changed: false, dataChanged: false }
    // All fallible preparation happens above; commit owners together before emitting any events.
    const dataChanged = candidate.resolved.data !== this.options.value.data
    this.options.commit(candidate)
    const preparedChanged = this.data.commit(data)
    if (preparedChanged) this.visibility.retain(this.data.series.map((series) => series.id))
    return { changed: true, dataChanged }
  }
}
