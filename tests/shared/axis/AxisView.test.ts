import { scaleLinear } from 'd3'
import { describe, expect, it } from 'vitest'
import { AxisView, type AxisRenderPlan } from '@/shared/axis/AxisView'
import { TextMeasurer } from '@/shared/axis/TextMeasurer'
import { expandDomainToStep, niceCoefficient } from '@/shared/axis/numeric'

describe('shared axis core', () => {
  it.each(['top', 'bottom', 'left', 'right'] as const)(
    'retains tick nodes during %s animation',
    (side) => {
      const element = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      const view = new AxisView(element)
      const plan: AxisRenderPlan = {
        scale: scaleLinear().domain([0, 10]).range([0, 100]),
        ticks: [0, 10],
        side,
        format: String,
        tickSize: -4,
        tickPadding: 7,
      }
      view.render(plan)
      const tick = element.querySelectorAll('.tick')[1]!
      const text = tick.querySelector('text')!.firstChild
      const before = tick.getAttribute('transform')
      plan.scale.domain([0, 20])
      view.render(plan)
      expect(tick.getAttribute('transform')).not.toBe(before)
      expect(tick.querySelector('text')!.firstChild).toBe(text)
      const observer = new MutationObserver(() => {})
      observer.observe(element, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true,
      })
      view.render(plan)
      expect(observer.takeRecords()).toEqual([])
      observer.disconnect()
      view.render({ ...plan, tickSize: -12, tickPadding: 15 })
      const coordinate = side === 'top' || side === 'bottom' ? 'y2' : 'x2'
      expect(Math.abs(Number(tick.querySelector('line')!.getAttribute(coordinate)))).toBe(12)
      view.render({ ...plan, line: 'none' })
      expect(element.querySelector('.domain')).toBeNull()
      view.render({ ...plan, line: 'hidden' })
      expect(element.querySelector('.domain')?.getAttribute('display')).toBe('none')
      view.render({ ...plan, line: 'visible' })
      expect(element.querySelector('.domain')?.hasAttribute('display')).toBe(false)
    },
  )

  it('changes orientation without retaining obsolete tick geometry', () => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    const view = new AxisView(element)
    const plan: AxisRenderPlan = {
      scale: scaleLinear(),
      ticks: [0, 1],
      side: 'bottom',
      format: String,
      tickSize: 6,
      tickPadding: 3,
    }
    view.render(plan)
    view.render({ ...plan, side: 'left' })
    expect(element.getAttribute('text-anchor')).toBe('end')
    expect(element.querySelector('.tick line')?.hasAttribute('y2')).toBe(false)
    expect(element.querySelector('.tick line')?.getAttribute('x2')).toBe('-6')
    plan.scale.range([0, 300])
    view.render({ ...plan, side: 'left' })
    expect(element.querySelector('.domain')?.getAttribute('d')).toContain('300')
  })

  it('shares quantization without conflating coefficient or fixed-bound policies', () => {
    expect(niceCoefficient(2.8, '125')).toBe(2)
    expect(niceCoefficient(2.8, '1235')).toBe(3)
    expect(niceCoefficient(2.8, '125', false)).toBe(5)
    expect(expandDomainToStep([1.2, 8.2], 2)).toEqual([0, 10])
    expect(expandDomainToStep([8.2, 1.2], 2, true)).toEqual([8.2, 0])
    expect(expandDomainToStep([8.2, 1.2], 2, false, true)).toEqual([10, 1.2])
  })

  it('handles unavailable measurement APIs and releases backend resources', () => {
    let destroyed = false
    const measurer = new TextMeasurer(
      {
        width: () => {
          throw new Error('hidden SVG')
        },
        height: () => Number.NaN,
        destroy: () => {
          destroyed = true
        },
      },
      (text) => text.length * 6,
      11,
    )
    const measure = measurer.measure
    expect(measure('abc')).toBe(18)
    expect(measure('')).toBe(0)
    expect(measurer.height('abc')).toBe(11)
    measurer.destroy()
    expect(destroyed).toBe(true)
  })
})
