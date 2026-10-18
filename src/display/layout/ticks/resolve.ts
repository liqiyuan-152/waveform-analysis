import type { AxisOptions, XAxisOptions } from '../../types/options.js'
import type { Domain } from '../domain/DomainStrategy.js'
import { LegacyTickStrategy } from './LegacyTickStrategy.js'
import { NiceXTickStrategy } from './NiceXTickStrategy.js'
import { NiceYTickStrategy } from './NiceYTickStrategy.js'

export function resolveXTicks(domain: Domain, axis: XAxisOptions, width: number) {
  const explicit = Number.isFinite(axis.tickStep) && axis.tickStep! > 0
  return axis.tickStrategy === 'nice' && !explicit
    ? new NiceXTickStrategy(axis.minInterval).within(domain, axis.tickCount)
    : new LegacyTickStrategy('x', axis, width).within(domain)
}

export function resolveYTicks(domain: Domain, axis: AxisOptions, expand = true) {
  if (axis.tickStrategy !== 'nice') return new LegacyTickStrategy('y', axis).within(domain)
  const strategy = new NiceYTickStrategy()
  return expand
    ? strategy.target(domain, axis.tickCount, Number.isFinite(axis.min), Number.isFinite(axis.max))
    : strategy.within(domain, axis.tickCount)
}
