import { expandDomainToStep } from '../../../shared/axis/numeric'
import type { Domain } from '../domain/DomainStrategy.js'
import type { TickStrategy } from './TickStrategy.js'
import { fallback, generate, niceInterval } from './numeric.js'

export class NiceYTickStrategy implements TickStrategy {
  within(domain: Domain, tickCount = 6) {
    return generate(domain, niceInterval(domain, tickCount, 'y'))
  }

  target(domain: Domain, tickCount = 6, fixedStart = false, fixedEnd = false) {
    const step = niceInterval(domain, tickCount, 'y')
    if (!step) return fallback(domain)
    const target = expandDomainToStep(domain, step, fixedStart, fixedEnd)
    if (!target.every(Number.isFinite)) return fallback(domain)
    return generate(target, step)
  }
}
