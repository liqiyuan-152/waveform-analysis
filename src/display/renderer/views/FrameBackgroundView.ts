import { renderFrameBackground } from '../frame.js'
import type { RenderContext } from '../context.js'
import { BaseView } from './BaseView.js'

export class FrameBackgroundView extends BaseView {
  protected draw(context: RenderContext) {
    renderFrameBackground(context)
  }
}
