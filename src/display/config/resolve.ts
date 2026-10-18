import { defaultOptions } from './defaults.js'
import { resolveAnimation } from './animation.js'
import { parseDimension } from './dimension.js'
import type { AxisLabelOptions, ValueAxisOptions, WaveformOptions } from '../types/options.js'

export interface ResolvedValueAxisOptions extends ValueAxisOptions {
  visible: boolean
  position: 'left' | 'right'
  title: Omit<Required<AxisLabelOptions>, 'offset'> & Pick<AxisLabelOptions, 'offset'>
}

function tickOptions(axis: import('../types/options.js').XAxisOptions | undefined, count: number) {
  return {
    tickStrategy: axis?.tickStrategy === 'nice' ? ('nice' as const) : ('legacy' as const),
    tickCount: Number.isFinite(axis?.tickCount) && axis!.tickCount! > 0 ? axis!.tickCount! : count,
  }
}

function resolveValueAxes(options: WaveformOptions): ResolvedValueAxisOptions[] {
  const configured =
    options.yAxes === undefined
      ? [
          { id: 'left', ...options.yAxis },
          { id: 'right', ...options.secondaryYAxis, position: 'right' as const },
        ]
      : options.yAxes
  const seen = new Set<string>()
  const axes: ResolvedValueAxisOptions[] = []

  for (const axis of configured) {
    const id = axis.id?.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    const legacyDefaults =
      options.yAxes === undefined && id === 'right'
        ? defaultOptions.secondaryYAxis
        : defaultOptions.yAxis
    axes.push({
      ...legacyDefaults,
      ...axis,
      ...tickOptions(axis, 6),
      id,
      title: { ...legacyDefaults.title, ...axis.title },
    })
  }

  if (axes.length) return axes
  return [{ ...defaultOptions.yAxis, id: 'left', title: { ...defaultOptions.yAxis.title } }]
}

export function resolveOptions(options: WaveformOptions = {}) {
  for (const key of ['width', 'height'] as const) {
    if (options[key] !== undefined && !parseDimension(options[key])) {
      throw new Error(`${key} must be a positive number, px length, or percentage in (0, 100]`)
    }
  }
  const yAxes = resolveValueAxes(options)
  const responsive = { ...defaultOptions.responsive, ...options.responsive }
  if (
    !Number.isFinite(responsive.minHeight) ||
    !Number.isFinite(responsive.maxHeight) ||
    responsive.minHeight < 0 ||
    responsive.maxHeight < 0
  ) {
    throw new Error('responsive height limits must be finite non-negative numbers')
  }
  if (responsive.minHeight > responsive.maxHeight) {
    throw new Error('responsive.minHeight must be less than or equal to responsive.maxHeight')
  }
  return {
    ...defaultOptions,
    ...options,
    width: options.width ?? defaultOptions.width,
    height: options.height ?? defaultOptions.height,
    ...resolveAnimation(options),
    responsive,
    layout: { ...defaultOptions.layout, ...options.layout },
    padding: { ...defaultOptions.padding, ...options.padding },
    frame: {
      ...defaultOptions.frame,
      ...options.frame,
    },
    frameNumberStyle: { ...defaultOptions.frameNumberStyle, ...options.frameNumberStyle },
    line: { ...defaultOptions.line, ...options.line },
    point: { ...defaultOptions.point, ...options.point },
    xDomainStrategy: { ...defaultOptions.xDomainStrategy, ...options.xDomainStrategy },
    xAxis: {
      ...defaultOptions.xAxis,
      ...options.xAxis,
      ...tickOptions(options.xAxis, 8),
      minInterval:
        Number.isFinite(options.xAxis?.minInterval) && options.xAxis!.minInterval! >= 0
          ? options.xAxis!.minInterval!
          : 0,
      title: { ...defaultOptions.xAxis.title, ...options.xAxis?.title },
    },
    yAxis: {
      ...defaultOptions.yAxis,
      ...options.yAxis,
      ...tickOptions(options.yAxis, 6),
      title: { ...defaultOptions.yAxis.title, ...options.yAxis?.title },
    },
    secondaryYAxis: {
      ...defaultOptions.secondaryYAxis,
      ...options.secondaryYAxis,
      ...tickOptions(options.secondaryYAxis, 6),
      title: { ...defaultOptions.secondaryYAxis.title, ...options.secondaryYAxis?.title },
    },
    yAxes,
    grid: {
      ...defaultOptions.grid,
      ...options.grid,
      x: { ...defaultOptions.grid.x, ...options.grid?.x },
      y: { ...defaultOptions.grid.y, ...options.grid?.y },
    },
    zeroLine: { ...defaultOptions.zeroLine, ...options.zeroLine },
    title: { ...defaultOptions.title, ...options.title },
    shot: { ...defaultOptions.shot, ...options.shot },
    legend: { ...defaultOptions.legend, ...options.legend },
    emptyState: { ...defaultOptions.emptyState, ...options.emptyState },
  }
}
