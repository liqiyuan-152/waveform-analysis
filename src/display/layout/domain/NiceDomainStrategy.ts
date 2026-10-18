import { scaleLinear } from 'd3'
import type { Domain, DomainStrategy } from './DomainStrategy.js'

export class NiceDomainStrategy implements DomainStrategy {
  constructor(
    private readonly tickCount = 10,
    private readonly bounds: 'both' | 'end' = 'both',
  ) {}

  resolve(domain: Domain): Domain {
    const count =
      Number.isFinite(this.tickCount) && this.tickCount >= 1 ? Math.trunc(this.tickCount) : 10
    const nice = scaleLinear().domain(domain).nice(count).domain() as Domain
    return this.bounds === 'end' ? [domain[0], nice[1]] : nice
  }
}
