import { describe, expect, it } from 'vitest'
import { ChartModel } from '@/model/ChartModel'
import type { WaveformChartOptionUpdate } from '@/types/options'

describe('native state ownership', () => {
  it('commits prepared data synchronously and rejects invalid mixed updates atomically', () => {
    const model = new ChartModel({ data: { kind: 'points', points: [{ x: 0, y: 1 }] } })
    const beforeOptions = model.options.value
    const beforeSeries = model.data.series
    model.viewport.set('series-0', { xDomain: [0, 1], yDomains: {} })
    expect(() =>
      model.setOption({
        data: { kind: 'points', points: [{ x: 5, y: 10 }] },
        width: 'invalid',
      } as unknown as WaveformChartOptionUpdate),
    ).toThrow(expect.objectContaining({ code: 'invalid-option', field: 'width' }))
    expect(model.options.value).toBe(beforeOptions)
    expect(model.data.series).toBe(beforeSeries)
    expect(model.viewport.get('series-0')?.xDomain).toEqual([0, 1])
    model.setOption({ data: { kind: 'points', points: [{ x: 5, y: 10 }] } })
    expect(model.query.nearestPoint('series-0', 5)).toEqual({ x: 5, y: 10 })
  })

  it('does not normalize same-reference style changes or create no-op default cycles', () => {
    const data = Object.freeze({ kind: 'points' as const, points: [{ x: 0, y: 1 }] })
    const model = new ChartModel({ data })
    const beforeSeries = model.data.series
    expect(model.setOption({ data, lineColor: 'red' })).toEqual({
      changed: true,
      dataChanged: false,
    })
    expect(model.data.series).toBe(beforeSeries)
    expect(model.setOption({ lineColor: 'red' }).changed).toBe(false)
    expect(model.setOption({ annotations: undefined }).changed).toBe(false)
    expect(model.setOption({}).changed).toBe(false)
    model.viewport.set('series-0', { xDomain: [0, 0.5], yDomains: {} })
    expect(model.setOption({ grid: { trackOrder: ['series-0'] } }).dataChanged).toBe(false)
    expect(model.viewport.get('series-0')?.xDomain).toEqual([0, 0.5])
  })

  it('restores internal visibility after controlled overrides and ignores later default seeds', () => {
    const model = new ChartModel({ defaultHiddenSeriesIds: ['a'] })
    model.visibility.request('b', false)
    model.setOption({ hiddenSeriesIds: ['c'], defaultHiddenSeriesIds: ['d'] })
    const controlled = model.options.value.hiddenSeriesIds
    expect(model.visibility.request('e', false, controlled)).toEqual(['c', 'e'])
    expect(model.visibility.snapshot(controlled)).toEqual(new Set(['c']))
    model.setOption({ hiddenSeriesIds: undefined })
    const restored = model.visibility.snapshot(model.options.value.hiddenSeriesIds)
    expect(restored).toEqual(new Set(['a', 'b']))
    restored.clear()
    expect(model.visibility.snapshot()).toEqual(new Set(['a', 'b']))
  })

  it('restores internal interaction mode while respecting current capabilities', () => {
    const model = new ChartModel({ pannable: true })
    expect(model.presentation.requestMode('pan', model.options.value)).toBe('applied')
    model.setOption({ interactionMode: 'annotation' })
    expect(model.presentation.requestMode('zoom', model.options.value)).toBe('requested')
    expect(model.presentation.mode(model.options.value)).toBe('annotation')
    model.setOption({ interactionMode: undefined, pannable: false })
    expect(model.presentation.mode(model.options.value)).toBe('pan')
    expect(model.presentation.requestMode('pan', model.options.value)).toBe('disabled')
    model.setOption({ presentationMode: true })
    expect(model.presentation.requestMode('none', model.options.value)).toBe('disabled')
  })

  it('keeps annotations host-owned, isolates viewport snapshots, and clamps pages', () => {
    const annotation = Object.freeze({ id: 'a', seriesId: 's', x: 1, y: 2, text: 'note' })
    const model = new ChartModel({ annotations: [annotation] })
    model.setOption({ annotations: undefined })
    expect(model.options.value.annotations).toEqual([])
    const viewport = {
      xDomain: [0, 1] as [number, number],
      yDomains: { s: [-1, 1] as [number, number] },
    }
    model.viewport.set('s', viewport)
    viewport.xDomain[0] = 9
    const snapshot = model.viewport.get('s')!
    snapshot.yDomains.s![0] = 9
    expect(model.viewport.get('s')).toEqual({ xDomain: [0, 1], yDomains: { s: [-1, 1] } })
    model.presentation.setPage(99, 3)
    expect(model.presentation.page).toBe(3)
    model.presentation.setPage(3, 1)
    expect(model.presentation.page).toBe(1)
    model.viewport.retain([])
    expect(model.viewport.get('s')).toBeUndefined()
  })
})
