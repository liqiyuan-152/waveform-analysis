import { afterEach, describe, expect, it, vi } from 'vitest'
import { init } from '@/chart/init'
import type { WaveformChartInstance, WaveformChartAction } from '@/types/native'
import { ChartModel } from '@/model/ChartModel'
import { ChartLayoutEngine } from '@/layout/ChartLayoutEngine'
import { ChartCommandDispatcher } from '@/controls/ChartCommandDispatcher'
import { ChartEventEmitter } from '@/chart/ChartEventEmitter'

const charts: WaveformChartInstance[] = []
afterEach(() => charts.splice(0).forEach((chart) => chart.dispose()))
const data = (start = 0, end = 10) => ({
  kind: 'points' as const,
  points: Array.from({ length: 101 }, (_, i) => ({
    x: start + ((end - start) * i) / 100,
    y: i / 20 - 2,
  })),
})
function create() {
  const chart = init(
    document.createElement('div'),
    {
      width: 800,
      height: 360,
      data: data(),
      animationEnabled: false,
      xDomainStrategy: { type: 'data' },
      initialXDomain: [2, 8],
    },
    { autoResize: false },
  )
  charts.push(chart)
  return chart
}

describe('native public commands', () => {
  it('shares dispatch and convenience semantics and synchronously uses replaced data', () => {
    const chart = create(),
      dispatch = create()
    expect(chart.zoomIn()).toEqual(dispatch.dispatchAction({ type: 'zoom-in' }))
    expect(chart.zoomOut()).toEqual(dispatch.dispatchAction({ type: 'zoom-out' }))
    expect(chart.fitToData()).toEqual(dispatch.dispatchAction({ type: 'fit' }))
    chart.setOption({ data: data(20, 40), initialXDomain: undefined })
    const result = chart.setViewportDomain([25, 30], {})
    expect(result.status).toBe('applied')
    expect(chart.getControlState().targets[0].viewport.xDomain).toEqual([25, 30])
    expect(chart.resetViewport({}).targets[0].after?.xDomain).toEqual([20, 40])
  })

  it.each([null, 'series-0', [], { trackId: 1 }, { trackId: 'missing' }])(
    'rejects invalid targets without state or event changes: %j',
    (target) => {
      const chart = create()
      const before = chart.getControlState(),
        event = vi.fn()
      chart.on('zoom-intent', event)
      const result = chart.dispatchAction({ type: 'zoom-in', target } as WaveformChartAction)
      expect(result).toEqual({ kind: 'viewport', status: 'invalid-target', targets: [] })
      expect(chart.getControlState()).toEqual(before)
      expect(event).not.toHaveBeenCalled()
    },
  )

  it.each([
    [null, 'action'],
    [[], 'action'],
    [{}, 'action.type'],
    [{ type: 'unknown' }, 'action.type'],
    [{ type: 'set-mode', mode: 'bad' }, 'action.mode'],
  ])('rejects invalid action discriminants with code/field: %j', (action, field) => {
    const chart = create(),
      before = chart.getControlState()
    expect(() => chart.dispatchAction(action as WaveformChartAction)).toThrow(
      expect.objectContaining({ code: 'invalid-option', field }),
    )
    expect(chart.getControlState()).toEqual(before)
  })

  it('keeps result snapshots independent of model state and later commands', () => {
    const chart = create()
    const result = chart.zoomIn()
    const after = result.targets[0].after!
    after.xDomain[0] = -100
    Object.values(after.yDomains)[0][0] = -100
    const state = chart.getControlState()
    expect(state.targets[0].viewport.xDomain[0]).not.toBe(-100)
    expect(Object.values(state.targets[0].viewport.yDomains)[0][0]).not.toBe(-100)
    expect(result.targets[0].before?.xDomain).toEqual([2, 8])
  })
})

describe('native command Y viewport reset', () => {
  it.each(['fit', 'reset'] as const)('returns the actual cleared Y ranges for %s', (type) => {
    const model = new ChartModel({
      data: data(),
      xDomainStrategy: { type: 'data' },
      axes: { y: { nice: false } },
    })
    const engine = new ChartLayoutEngine(model)
    const layout = () => engine.calculate(800, 360)
    const track = layout().trackLayouts[0]
    const seriesId = track.seriesPaths[0].series.id
    model.viewport.set(track.id, { xDomain: [2, 8], yDomains: { [seriesId]: [-0.5, 0.5] } })
    const dispatcher = new ChartCommandDispatcher(model, layout, new ChartEventEmitter(), () => {})
    const result = dispatcher.execute({ type })
    expect(result.targets[0].before?.yDomains[seriesId]).toEqual([-0.5, 0.5])
    expect(result.targets[0].after?.yDomains[seriesId]).toEqual([-2, 3])
    expect(result.targets[0].after).toEqual(dispatcher.getControlState().targets[0].viewport)
    expect(model.viewport.get(track.id)?.yDomains).toEqual({})
  })
})
