import type { XDomainStrategy } from '../../types/options.js'
import { DataDomainStrategy } from './DataDomainStrategy.js'
import { NiceDomainStrategy } from './NiceDomainStrategy.js'
import type { Domain } from './DomainStrategy.js'

/** Expands an X domain to readable boundaries without changing source coordinates. */
export function applyXDomainStrategy(
  domain: Domain,
  strategy: XDomainStrategy,
  explicit = false,
): Domain {
  return strategy.type === 'nice' && (!explicit || strategy.includeExplicit)
    ? new NiceDomainStrategy(strategy.tickCount, strategy.bounds).resolve(domain)
    : new DataDomainStrategy().resolve(domain)
}
