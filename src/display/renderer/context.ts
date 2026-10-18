import type { TickLayout } from '../layout/ticks/TickStrategy.js'
import type * as d3 from 'd3'
import type { WaveformSeries } from '../types/data.js'
import type { ReturnTypeOfResolveOptions } from '../types/internal.js'
import type { ResolvedValueAxisOptions } from '../config/resolve.js'

export interface ResolvedValueAxis {
  formatDomain?: [number, number]
  options: ResolvedValueAxisOptions
  domain: [number, number]
  ticks: TickLayout
  scale: d3.ScaleLinear<number, number>
  offset: number
  footprint: number
  titleOffset?: number
  tickFootprint?: number
  headerWidth?: number
  headerLeft?: number
  headerRight?: number
}

export interface RenderContext {
  seriesEffects?: Array<{ opacity?: number; clip?: { x: number; width: number } }>
  channelName?: string
  legendItems: Array<{ key: string; series: WaveformSeries; visible: boolean }>
  toggleSeries: (key: string) => void
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>
  plot: d3.Selection<SVGGElement, unknown, null, undefined>
  series: WaveformSeries[]
  options: ReturnTypeOfResolveOptions
  width: number
  height: number
  innerWidth: number
  innerHeight: number
  x: d3.ScaleLinear<number, number>
  xTickLayout: TickLayout
  xTicks: number[]
  yAxes: ResolvedValueAxis[]
  yAxisById: Map<string, ResolvedValueAxis>
  primaryYAxis: ResolvedValueAxis
  xDomain: [number, number]
  clipId: string
}
