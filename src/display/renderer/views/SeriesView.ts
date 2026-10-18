import { renderSeries } from '../series.js'
import type { RenderContext } from '../context.js'
import { BaseView } from './BaseView.js'

export class SeriesView extends BaseView {
  protected draw(context: RenderContext) {
    renderSeries(context)
  }
}
