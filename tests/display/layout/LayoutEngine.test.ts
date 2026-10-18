import { describe, expect, it, vi } from 'vitest'
import { LayoutEngine } from '../../../src/display/layout/LayoutEngine'
import { OptionManager } from '../../../src/display/model/OptionManager'
import { WaveformModel } from '../../../src/display/model/WaveformModel'

it('computes layout with injected measurements and no DOM', () => {
  const options = new OptionManager({ legend: { visible: false }, padding: { left: 0, right: 0 } })
  const model = new WaveformModel([
    {
      id: 'a',
      data: [
        { x: 0, y: 0 },
        { x: 1, y: 2 },
      ],
    },
  ])
  const measureAxis = vi.fn(() => ({
    footprint: 60,
    headerWidth: 0,
    headerHeight: 10,
    tickFootprint: 60,
  }))
  const engine = new LayoutEngine(options.raw, { measureAxis })
  const layout = engine.calculate(model, options.resolved, 800, 320)
  expect(measureAxis).toHaveBeenCalled()
  expect(layout.naturalPadding.left).toBe(65)
  expect(layout.xDomain).toEqual([0, 1])
  expect(layout.primaryYAxis.domain).toEqual([0, 2])
  expect(layout.innerWidth).toBe(735)
})

describe('axis title derivation', () => {
  it('keeps automatic title visibility separate from raw overrides', () => {
    const options = new OptionManager({ legend: { visible: false } })
    const model = new WaveformModel([
      { id: 'a', name: 'First', data: [{ x: 0, y: 1 }] },
      { id: 'b', name: 'Second', data: [{ x: 0, y: 2 }] },
    ])
    const engine = new LayoutEngine(options.raw, {
      measureAxis: () => ({ footprint: 20, headerWidth: 0, headerHeight: 10, tickFootprint: 20 }),
    })
    expect(
      engine.calculate(model, options.resolved, 800, 320).effectiveOptions.yAxes[0].title,
    ).toMatchObject({ text: 'First', visible: true })
    expect(options.raw.yAxes).toBeUndefined()
    expect(options.raw.yAxis).toBeUndefined()
  })
})
