import { renderLegend } from '../legend.js'
import type { RenderContext } from '../context.js'
import { BaseView } from './BaseView.js'

export class LegendView extends BaseView {
  protected draw(ctx: RenderContext) {
    renderLegend(ctx, ctx.legendItems, ctx.toggleSeries)
  }
}
