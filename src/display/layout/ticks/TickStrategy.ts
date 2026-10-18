import type { Domain } from '../domain/DomainStrategy.js'

export interface TickLayout {
  domain: Domain
  majorValues: number[]
  interval?: number
  boundaryValues: number[]
}

export interface TickStrategy {
  /** Generates ticks inside an already resolved domain; never expands it. */
  within(domain: Domain, tickCount?: number): TickLayout
}
