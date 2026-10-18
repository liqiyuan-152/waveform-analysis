import type { WaveformOptions } from '../types/options.js'

export function mergeOptions(base: WaveformOptions, next: WaveformOptions): WaveformOptions {
  const hasHorizontalPaddingUpdate = Object.prototype.hasOwnProperty.call(
    next.layout ?? {},
    'horizontalPadding',
  )
  const nextHorizontalPadding = next.layout?.horizontalPadding
  const horizontalPadding = hasHorizontalPaddingUpdate
    ? nextHorizontalPadding && typeof nextHorizontalPadding === 'object'
      ? { ...base.layout?.horizontalPadding, ...nextHorizontalPadding }
      : undefined
    : base.layout?.horizontalPadding

  return {
    ...base,
    ...next,
    animation:
      Object.prototype.hasOwnProperty.call(next, 'animation') && next.animation === undefined
        ? undefined
        : { ...base.animation, ...next.animation },
    animationUpdate:
      Object.prototype.hasOwnProperty.call(next, 'animationUpdate') &&
      next.animationUpdate === undefined
        ? undefined
        : { ...base.animationUpdate, ...next.animationUpdate },
    responsive: { ...base.responsive, ...next.responsive },
    layout: { ...base.layout, ...next.layout, horizontalPadding },
    padding: { ...base.padding, ...next.padding },
    frame: { ...base.frame, ...next.frame },
    frameNumberStyle: { ...base.frameNumberStyle, ...next.frameNumberStyle },
    line: { ...base.line, ...next.line },
    point: { ...base.point, ...next.point },
    xDomainStrategy: {
      ...base.xDomainStrategy,
      ...next.xDomainStrategy,
      type: next.xDomainStrategy?.type ?? base.xDomainStrategy?.type ?? 'data',
    },
    xAxis: { ...base.xAxis, ...next.xAxis, title: { ...base.xAxis?.title, ...next.xAxis?.title } },
    yAxis: { ...base.yAxis, ...next.yAxis, title: { ...base.yAxis?.title, ...next.yAxis?.title } },
    secondaryYAxis: {
      ...base.secondaryYAxis,
      ...next.secondaryYAxis,
      title: { ...base.secondaryYAxis?.title, ...next.secondaryYAxis?.title },
    },
    yAxes: next.yAxes ?? base.yAxes,
    grid: {
      ...base.grid,
      ...next.grid,
      x: { ...base.grid?.x, ...next.grid?.x },
      y: { ...base.grid?.y, ...next.grid?.y },
    },
    zeroLine: { ...base.zeroLine, ...next.zeroLine },
    title: { ...base.title, ...next.title },
    shot: { ...base.shot, ...next.shot },
    legend: { ...base.legend, ...next.legend },
    emptyState: { ...base.emptyState, ...next.emptyState },
  }
}
