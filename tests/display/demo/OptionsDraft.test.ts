import { describe, expect, it } from 'vitest'
import { OptionsDraft } from '../../../demo-app/src/display/config/OptionsDraft'

describe('raw option drafts', () => {
  it('restores absent bindings and reference-axis overrides without making them explicit', () => {
    const draft = new OptionsDraft({ yAxes: [{ id: 'left' }, { id: 'right', position: 'right' }] })
    const single = draft.switchAxes('single', [{ id: 'a', data: [{ x: 0, y: 1 }] }])
    const multi = draft.switchAxes('multiple', single.data)
    expect(multi.data[0].yAxis).toBeUndefined()
    expect(multi.options.grid?.y?.axisId).toBeUndefined()
    expect(multi.options.zeroLine?.axisId).toBeUndefined()
  })
  it('submits only edited fields without materializing automatic axes', () => {
    const draft = new OptionsDraft({ yAxis: { color: 'red' } })
    expect(draft.set('line.width', 2)).toEqual({ line: { width: 2 } })
    expect(draft.options.yAxes).toBeUndefined()
    expect(draft.set('yAxes.0.color', 'blue').yAxes?.[0]).toEqual({ id: 'left', color: 'blue' })
    expect(draft.options.yAxes?.[0].title).toBeUndefined()
  })

  it('preserves explicit titles, restores multi-axis bindings and keeps edits in single mode', () => {
    const draft = new OptionsDraft({
      yAxes: [
        { id: 'l', position: 'left' },
        { id: 'r', position: 'right', title: { text: 'Right' } },
      ],
    })
    const data = [{ id: 'a', yAxis: 'r', data: [{ x: 0, y: 1 }] }]
    const single = draft.switchAxes('single', data)
    expect(single.data[0].yAxis).toBe('l')
    draft.set('yAxes.0.color', 'blue')
    const multi = draft.switchAxes('multiple', single.data)
    expect(multi.data[0].yAxis).toBe('r')
    expect(multi.options.yAxes?.[0].color).toBe('blue')
    expect(multi.options.yAxes?.[1].title).toEqual({ text: 'Right' })
    expect(multi.options.yAxes?.[1].title?.visible).toBeUndefined()
  })

  it('rejects conflicting responsive height limits without mutating the draft', () => {
    const draft = new OptionsDraft({ responsive: { minHeight: 220, maxHeight: 600 } })
    expect(() => draft.set('responsive.minHeight', 601)).toThrow('最小高度不能大于最大高度')
    expect(draft.options.responsive).toEqual({ minHeight: 220, maxHeight: 600 })
    expect(draft.set('responsive.minHeight', 600)).toEqual({ responsive: { minHeight: 600 } })
  })
})
