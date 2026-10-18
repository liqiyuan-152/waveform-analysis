import { renderGrid } from '../grid.js'
import type { RenderContext } from '../context.js'
import { BaseView } from './BaseView.js'

export class GridView extends BaseView {
  protected draw(context: RenderContext) {
    renderGrid(context)
  }
}
