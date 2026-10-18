import { renderXMetadata } from '../xMetadata.js'
import type { RenderContext } from '../context.js'
import { BaseView } from './BaseView.js'

export class MetadataView extends BaseView {
  protected draw(ctx: RenderContext) {
    const { svg, options, width, innerWidth } = ctx
    const p = options.padding
    if (ctx.channelName !== undefined) {
      svg
        .append('text')
        .attr('class', 'waveform-channel-name')
        .attr('x', p.left + innerWidth / 2)
        .attr('y', options.title.visible && options.title.text ? 46 : 22)
        .attr('text-anchor', 'middle')
        .attr('fill', options.legend.color)
        .attr('font-size', options.legend.fontSize)
        .text(ctx.channelName!)
    }
    renderXMetadata(ctx)

    if (options.title.visible && options.title.text) {
      const tx =
        options.title.align === 'left'
          ? p.left
          : options.title.align === 'right'
            ? width - p.right
            : width / 2
      svg
        .append('text')
        .attr('x', tx)
        .attr('y', 24)
        .attr(
          'text-anchor',
          options.title.align === 'left'
            ? 'start'
            : options.title.align === 'right'
              ? 'end'
              : 'middle',
        )
        .attr('fill', options.title.color)
        .attr('font-size', options.title.fontSize)
        .attr('font-weight', options.title.fontWeight)
        .text(options.title.text)
    }
  }
}
