import type { ResolvedValueAxisOptions } from '../config/resolve.js'
import type { TickLayout } from './ticks/TickStrategy.js'
import type { Domain } from './domain/DomainStrategy.js'

export interface AxisMeasurement {
  footprint: number
  titleOffset?: number
  headerWidth: number
  headerHeight: number
  tickFootprint: number
}

/** The renderer supplies font measurements; layout does not access DOM nodes. */
export interface LayoutMeasurements {
  measureAxis(options: ResolvedValueAxisOptions, domain: Domain, ticks: TickLayout): AxisMeasurement
}

export interface AxisLayout extends AxisMeasurement {
  options: ResolvedValueAxisOptions
  domain: Domain
  ticks: TickLayout
  offset: number
}
