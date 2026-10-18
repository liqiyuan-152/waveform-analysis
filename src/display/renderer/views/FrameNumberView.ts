import { renderFrameNumber } from '../frameNumber.js'
import type { RenderContext } from '../context.js'
import { BaseView } from './BaseView.js'

export class FrameNumberView extends BaseView {
  protected draw(context: RenderContext) {
    renderFrameNumber(context)
  }
}
