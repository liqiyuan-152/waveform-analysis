import { defaultOptions } from '../../config/defaults.js'
import type { RenderContext } from '../context.js'
import { BaseView } from './BaseView.js'

export class ZeroLineView extends BaseView {
  protected draw(ctx: RenderContext) {
    const { yAxisById, primaryYAxis, options, plot, innerWidth } = ctx
    const zeroAxis = yAxisById.get(options.zeroLine.axisId ?? '') ?? primaryYAxis
    const [yMin, yMax] =
      zeroAxis.options.tickStrategy === 'nice'
        ? [...zeroAxis.domain].sort((a, b) => a - b)
        : zeroAxis.domain
    const tickInterval = zeroAxis.ticks.interval ?? 0
    const configuredThreshold = options.zeroLine.boundaryThreshold
    const boundaryThreshold =
      Number.isFinite(configuredThreshold) && configuredThreshold >= 0
        ? configuredThreshold
        : defaultOptions.zeroLine.boundaryThreshold
    const margin = tickInterval * boundaryThreshold
    if (options.zeroLine.visible && yMin < 0 && yMax > 0 && -yMin >= margin && yMax >= margin) {
      plot
        .append('line')
        .attr('class', 'waveform-zero-line')
        .attr('data-axis-id', zeroAxis.options.id)
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', zeroAxis.scale(0))
        .attr('y2', zeroAxis.scale(0))
        .attr('stroke', options.zeroLine.color)
        .attr('stroke-opacity', options.zeroLine.opacity)
        .attr('stroke-width', options.zeroLine.width)
        .attr('stroke-dasharray', options.zeroLine.dash)
    }
  }
}
