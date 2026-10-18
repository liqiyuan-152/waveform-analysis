import { Pagination } from '../controls/Pagination'
import type { ChartLayoutSnapshot } from '../layout/ChartLayoutEngine'

export class PaginationView extends Pagination {
  constructor(parent: HTMLElement, change: (page: number) => void) {
    super(parent, change)
    this.root.classList.add('waveform-chart__pagination')
    this.root.setAttribute('aria-label', '波形分页')
  }

  render(layout: ChartLayoutSnapshot) {
    this.update({
      page: layout.page,
      pageCount: layout.pageCount,
      visible: layout.paginationVisible,
    })
  }
}
