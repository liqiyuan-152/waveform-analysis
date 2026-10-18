import type { RenderContext } from './context.js'

const MAX_AUTO_FONT_SIZE = 120
const HEIGHT_RATIO = 0.65
const WIDTH_RATIO = 0.9
const TEXT_WIDTH_FACTOR = 0.6

function resolveFontSize(ctx: RenderContext, text: string): number {
  const configured = ctx.options.frameNumberStyle.fontSize
  const maximum = Number.isFinite(configured) && configured! > 0 ? configured! : MAX_AUTO_FONT_SIZE
  const heightLimit = ctx.innerHeight * HEIGHT_RATIO
  const widthLimit = (ctx.innerWidth * WIDTH_RATIO) / Math.max(1, text.length * TEXT_WIDTH_FACTOR)
  return Math.max(0.1, Math.min(maximum, heightLimit, widthLimit))
}

function resolveOpacity(value: number): number {
  if (!Number.isFinite(value)) return 0.1
  return Math.max(0, Math.min(1, value))
}

export function renderFrameNumber(ctx: RenderContext) {
  if (ctx.options.frameNumber === undefined || !ctx.series.length) return

  const text = String(ctx.options.frameNumber)
  const style = ctx.options.frameNumberStyle
  const color = style.color?.trim() || '#1677ff'
  const fontFamily = style.fontFamily?.trim() || "Consolas, Monaco, 'Courier New', monospace"

  ctx.plot
    .append('text')
    .attr('class', 'waveform-frame-number')
    .attr('x', ctx.innerWidth / 2)
    .attr('y', ctx.innerHeight / 2)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('fill', color)
    .attr('opacity', resolveOpacity(style.opacity))
    .attr('font-size', resolveFontSize(ctx, text))
    .attr('font-family', fontFamily)
    .attr('font-weight', style.fontWeight)
    .attr('aria-hidden', 'true')
    .style('pointer-events', 'none')
    .style('user-select', 'none')
    .style('-webkit-user-select', 'none')
    .text(text)
}
