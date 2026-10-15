import type { ChartModel } from '../model/ChartModel'
import type { ChartLayoutSnapshot } from '../layout/ChartLayoutEngine'
import type { ChartEventEmitter } from '../chart/ChartEventEmitter'
import type { ResolvedWaveformChartProps } from '../types/options'

/** Page changes own viewport cancellation and preserve the existing two-argument event. */
export class ChartPaginationController {
  constructor(
    private readonly model: ChartModel,
    private readonly layout: () => ChartLayoutSnapshot,
    private readonly changed: () => void,
    private readonly events: ChartEventEmitter,
    private readonly isDisposed: () => boolean,
  ) {}

  change(page: number) {
    if (this.isDisposed()) return
    const pageCount = this.layout().pageCount
    if (!this.model.presentation.setPage(page, pageCount)) return
    this.changed()
    this.events.emit('page-change', this.model.presentation.page, pageCount)
  }

  reconcile(previousOptions: ResolvedWaveformChartProps, previous: ChartLayoutSnapshot) {
    const options = this.model.options.value
    const next = this.layout()
    const modeChanged =
      previousOptions.displayMode !== options.displayMode ||
      previousOptions.integerZoom !== options.integerZoom
    const resetsPage =
      modeChanged ||
      previousOptions.grid.rowCount !== options.grid.rowCount ||
      previousOptions.grid.columnCount !== options.grid.columnCount ||
      previousOptions.grid.fillIncompleteLastRow !== options.grid.fillIncompleteLastRow ||
      previous.pageCount !== next.pageCount
    if (!resetsPage) return
    const page = previous.page > next.pageCount ? next.pageCount : 1
    this.model.presentation.setPage(page, next.pageCount)
    if (modeChanged) this.model.viewport.reset()
    this.changed()
    if (page !== previous.page) this.events.emit('page-change', page, next.pageCount)
  }
}
