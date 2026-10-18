import { renderFrameBorder } from '../frame.js'
import type { RenderContext } from '../context.js'
import { BaseView } from './BaseView.js'

export class FrameBorderView extends BaseView {
  protected draw(context: RenderContext) {
    renderFrameBorder(context)
  }
}
