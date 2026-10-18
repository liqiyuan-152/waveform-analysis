import { scaleLinear } from 'd3'
import { yAxisTickValues } from '../../renderer/helpers.js'
import { resolveXAxisTickValues } from '../../renderer/xTicks.js'
import type { XAxisOptions } from '../../types/options.js'
import type { Domain } from '../domain/DomainStrategy.js'
import type { TickStrategy, TickLayout } from './TickStrategy.js'

export class LegacyTickStrategy implements TickStrategy {
  constructor(
    private readonly axis: 'x' | 'y',
    private readonly options: XAxisOptions = {},
    private readonly width = 800,
  ) {}

  within(domain: Domain, tickCount = this.options.tickCount): TickLayout {
    const majorValues =
      this.axis === 'x'
        ? resolveXAxisTickValues(
            scaleLinear().domain(domain),
            { ...this.options, tickCount },
            this.width,
          )
        : yAxisTickValues(domain, tickCount)
    const interval = Math.abs(majorValues[1] - majorValues[0])
    return {
      domain: [...domain],
      majorValues,
      boundaryValues: [...new Set(domain)],
      interval: Number.isFinite(interval) && interval > 0 ? interval : undefined,
    }
  }
}
