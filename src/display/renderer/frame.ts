import { borderDash } from './helpers.js'
import type { RenderContext } from './context.js'

export function renderFrameBackground(ctx: RenderContext) {
  const { plot, innerWidth, innerHeight, options } = ctx
  if (!options.frame.visible) return

  plot
    .append('rect')
    .attr('class', 'waveform-frame-background')
    .attr('width', innerWidth)
    .attr('height', innerHeight)
    .attr('rx', options.frame.radius)
    .attr('fill', options.frame.backgroundColor)
    .attr('stroke', 'none')
}

export function renderFrameBorder(ctx: RenderContext) {
  const { plot, innerWidth, innerHeight, options } = ctx
  if (!options.frame.visible) return

  const dotted = options.frame.borderStyle === 'dotted'
  plot
    .append('rect')
    .attr('class', 'waveform-frame-border')
    .attr('width', innerWidth)
    .attr('height', innerHeight)
    .attr('rx', options.frame.radius)
    .attr('fill', 'none')
    .attr('stroke', options.frame.borderColor)
    .attr('stroke-width', options.frame.borderWidth)
    .attr('stroke-dasharray', borderDash(options.frame.borderStyle))
    .attr('stroke-linecap', dotted ? 'round' : null)
}
