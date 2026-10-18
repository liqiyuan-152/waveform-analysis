import { AxisView } from './AxisView.js'
import { GridView } from './GridView.js'
import { SeriesView } from './SeriesView.js'
import { FrameBackgroundView } from './FrameBackgroundView.js'
import { FrameBorderView } from './FrameBorderView.js'
import { FrameNumberView } from './FrameNumberView.js'
import { ZeroLineView } from './ZeroLineView.js'
import { LegendView } from './LegendView.js'
import { MetadataView } from './MetadataView.js'
import type { RenderContext } from '../context.js'

/** Built-in views in SVG paint order; deliberately not a public extension API. */
export class ViewRegistry {
  private readonly views = [
    new FrameBackgroundView(),
    new GridView(),
    new FrameNumberView(),
    new AxisView(),
    new FrameBorderView(),
    new SeriesView(),
    new ZeroLineView(),
    new LegendView(),
    new MetadataView(),
  ]
  update(context: RenderContext) {
    const layout = {
      options: context.options,
      width: context.width,
      height: context.height,
      innerWidth: context.innerWidth,
      innerHeight: context.innerHeight,
      channelName: context.channelName,
      legend: context.legendItems.map(({ key, visible, series: { data: _data, ...series } }) => {
        void _data
        return { key, visible, series }
      }),
      axes: context.yAxes.map(
        ({
          scale: _scale,
          domain: _domain,
          ticks: _ticks,
          formatDomain: _formatDomain,
          ...axis
        }) => {
          void [_scale, _domain, _ticks, _formatDomain]
          return axis
        },
      ),
      hasSeries: !!context.series.length,
    }
    const coordinates = {
      layout,
      x: context.xDomain,
      xTicks: context.xTickLayout,
      y: context.yAxes.map((axis) => ({
        domain: axis.domain,
        ticks: axis.ticks,
        formatDomain: axis.formatDomain,
      })),
    }
    this.views.forEach((view) =>
      view.update(
        context,
        view instanceof SeriesView
          ? undefined
          : view instanceof AxisView || view instanceof GridView || view instanceof ZeroLineView
            ? coordinates
            : layout,
      ),
    )
  }
  destroy() {
    this.views.forEach((view) => view.destroy())
  }
}
