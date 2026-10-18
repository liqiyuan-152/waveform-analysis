import { describe, expect, it } from 'vitest'
import { WaveformModel } from '../../../src/display/model/WaveformModel'

const points = [
  { x: 0, y: 1 },
  { x: 1, y: 2 },
]
describe('WaveformModel', () => {
  it('keeps unique identity through reorder and forgets removed selection', () => {
    const model = new WaveformModel([
      { id: 'a', data: points },
      { id: 'b', data: points },
    ])
    const key = model.keyedSeries[0].key
    model.toggle(key)
    model.update([
      { id: 'b', data: points },
      { id: 'a', data: points },
    ])
    expect(model.keyedSeries[1].key).toBe(key)
    expect(model.hiddenKeys.has(key)).toBe(true)
    model.update([])
    expect(model.hiddenKeys.size).toBe(0)
  })

  it('distinguishes duplicate and missing IDs and respects normalized order', () => {
    const model = new WaveformModel([
      { id: 'a', order: 3, data: points },
      { id: 'a', order: 2, data: points },
      { order: 1, data: points },
    ])
    expect(model.keyedSeries.map((item) => item.key)).toEqual(['index:0', 'id:a:0', 'id:a:1'])
    expect(() => model.toggle('missing')).toThrow('Unknown series key')
  })

  it('isolates mutable points and styles but accepts explicit same-reference resubmission', () => {
    const data = [{ id: 'a', data: [{ x: 1, y: 2 }], style: { point: { color: 'red' } } }]
    const model = new WaveformModel(data)
    data[0].data[0].y = 9
    data[0].style.point.color = 'blue'
    expect(model.series[0].data[0].y).toBe(2)
    expect(model.series[0].style?.point?.color).toBe('red')
    model.update(data)
    expect(model.series[0].data[0].y).toBe(9)
  })
})
