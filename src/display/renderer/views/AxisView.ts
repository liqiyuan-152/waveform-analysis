import { renderAxes } from '../axes.js'
import type { RenderContext } from '../context.js'
import { BaseView } from './BaseView.js'

export class AxisView extends BaseView {
  protected draw(context: RenderContext) {
    renderAxes(context)
  }
}
