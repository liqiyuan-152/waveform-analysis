import type { Domain } from '../domain/DomainStrategy.js'
import type { TickStrategy } from './TickStrategy.js'
import { fallback, generate, niceInterval } from './numeric.js'

export class NiceXTickStrategy implements TickStrategy {
  constructor(private readonly minInterval = 0) {}

  within(domain: Domain, tickCount = 8) {
    const interval = niceInterval(domain, tickCount, 'x')
    if (!interval) return fallback(domain)
    const minimum =
      Number.isFinite(this.minInterval) && this.minInterval >= 0 ? this.minInterval : 0
    return generate(domain, Math.max(interval, minimum))
  }
}
