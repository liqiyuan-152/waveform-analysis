import { describe, expect, it } from 'vitest'
import { OptionManager } from '../../../src/display/model/OptionManager'

describe('OptionManager', () => {
  it('preserves nested overrides, replaces arrays and clears coordinated padding', () => {
    const manager = new OptionManager({
      title: { text: 'Title', color: 'red' },
      yAxes: [{ id: 'a' }, { id: 'b' }],
      layout: { horizontalPadding: { left: 100, right: 80 } },
    })
    manager.update({
      title: { text: 'Next' },
      yAxes: [{ id: 'c' }],
      layout: { horizontalPadding: { left: 50 } },
    })
    expect(manager.resolved.title).toMatchObject({ text: 'Next', color: 'red' })
    expect(manager.raw.yAxes).toEqual([{ id: 'c' }])
    expect(manager.raw.layout?.horizontalPadding).toEqual({ left: 50, right: 80 })
    manager.update({ layout: { horizontalPadding: undefined } })
    expect(manager.raw.layout?.horizontalPadding).toBeUndefined()
  })

  it('isolates input and snapshots while keeping callbacks and derived defaults', () => {
    const tickFormat = (n: number) => String(n)
    const options = { yAxes: [{ id: 'a', color: 'red' }], xAxis: { tickFormat } }
    const manager = new OptionManager(options)
    options.yAxes[0].color = 'blue'
    const result = manager.getOptions()
    result.yAxes![0].color = 'green'
    expect(manager.resolved.yAxes[0].color).toBe('red')
    expect(result.xAxis?.tickFormat).toBe(tickFormat)
    expect(result.xAxis?.tickCount).toBe(8)
    expect(manager.raw.yAxes![0].title).toBeUndefined()
    manager.update({ yAxes: [] })
    expect(manager.raw.yAxes).toEqual([])
    expect(manager.resolved.yAxes).toHaveLength(1)
  })
})
