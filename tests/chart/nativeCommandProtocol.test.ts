import { afterEach, describe, expect, it } from 'vitest'
import { init } from '@/chart/init'
import { ChartModel } from '@/model/ChartModel'
import { ChartLayoutEngine } from '@/layout/ChartLayoutEngine'
import { ChartEventEmitter } from '@/chart/ChartEventEmitter'
import { ChartCommandDispatcher } from '@/controls/ChartCommandDispatcher'
import type { WaveformChartInstance, WaveformChartEvents } from '@/types/native'
import { flushNativeUpdates } from '../support/nativeChart'

const charts: WaveformChartInstance[] = []
afterEach(() => charts.splice(0).forEach((chart) => chart.dispose()))
const data = (offset = 0) => ({
  kind: 'series' as const,
  series: ['a', 'b'].map((id) => ({
    id,
    name: id,
    data: {
      kind: 'points' as const,
      points: Array.from({ length: 101 }, (_, i) => ({ x: offset + i / 10, y: i })),
    },
  })),
})
const options = {
  data: data(),
  animationEnabled: false,
  width: 800,
  height: 360,
  xDomainStrategy: { type: 'data' as const },
  grid: { rowCount: 2, columnCount: 1 },
}
function create() {
  const chart = init(document.createElement('div'), options, { autoResize: false })
  charts.push(chart)
  return chart
}
function listen(chart: Pick<WaveformChartInstance, 'on'> | ChartEventEmitter) {
  const result: Array<{ event: string; args: unknown[] }> = []
  for (const event of ['zoom-intent', 'zoom-change', 'zoom-end', 'zoom-reset'] as const)
    chart.on(event, (...args: WaveformChartEvents[typeof event]) =>
      result.push({ event, args: structuredClone(args) }),
    )
  return result
}

describe('native command event protocol', () => {
  it.each(['api', 'toolbar'] as const)(
    'uses one monotonic identity and captures all target payloads for %s source',
    (source) => {
      const model = new ChartModel(options)
      const layout = new ChartLayoutEngine(model, document)
      const emitter = new ChartEventEmitter()
      const dispatcher = new ChartCommandDispatcher(
        model,
        () => layout.calculate(800, 360),
        emitter,
        () => {},
      )
      const log = listen(emitter)
      dispatcher.execute({ type: 'zoom-in' }, source)
      expect(log.map(({ event }) => event)).toEqual([
        'zoom-intent',
        'zoom-change',
        'zoom-end',
        'zoom-intent',
        'zoom-change',
        'zoom-end',
      ])
      const first = log.filter(({ event }) => event === 'zoom-end').map(({ args }) => args[0])
      expect(first).toEqual([
        expect.objectContaining({
          commandId: 'command-1',
          source,
          action: 'zoom-in',
          gesture: 'command',
          trackIndex: 0,
          seriesIds: ['a'],
        }),
        expect.objectContaining({
          commandId: 'command-1',
          source,
          action: 'zoom-in',
          gesture: 'command',
          trackIndex: 1,
          seriesIds: ['b'],
        }),
      ])
      dispatcher.execute({ type: 'zoom-out' }, source)
      expect(
        log
          .filter(({ event }) => event === 'zoom-end')
          .slice(2)
          .every(({ args }) => (args[0] as { commandId: string }).commandId === 'command-2'),
      ).toBe(true)
      model.data.dispose()
      emitter.dispose()
    },
  )

  it('preserves fit/reset exceptions, unchanged reset notifications and silent legacy methods', async () => {
    const chart = create()
    const log = listen(chart)
    expect(chart.fitToData().status).toBe('unchanged')
    expect(chart.zoomOut().status).toBe('unchanged')
    expect(log).toEqual([])
    expect(chart.resetViewport({}).status).toBe('unchanged')
    expect(log.map(({ event }) => event)).toEqual(['zoom-reset', 'zoom-reset'])
    for (const { args } of log)
      expect(Object.keys(args[0] as object).sort()).toEqual([
        'action',
        'commandId',
        'seriesIds',
        'source',
        'trackIndex',
      ])
    log.length = 0
    chart.setViewportDomain([2, 4])
    chart.resetViewport()
    await flushNativeUpdates()
    expect(log).toEqual([])
    chart.setViewportDomain([2, 4], {})
    log.length = 0
    chart.fitToData()
    expect(log.map(({ event }) => event)).toEqual([
      'zoom-change',
      'zoom-end',
      'zoom-change',
      'zoom-end',
    ])
    expect(log[1].args[0]).toMatchObject({ action: 'fit', source: 'api', gesture: 'command' })
  })

  it('does not emit intent/change/end/reset for disabled, empty or invalid requests', () => {
    const chart = create()
    const log = listen(chart)
    expect(chart.zoomIn({ trackId: 'missing' }).status).toBe('invalid-target')
    expect(chart.setViewportDomain([NaN, 1], {}).status).toBe('invalid-domain')
    chart.setOption({ zoomable: false })
    expect(chart.zoomIn().status).toBe('disabled')
    expect(chart.resetViewport({}).status).toBe('disabled')
    chart.setOption({ zoomable: true, hiddenSeriesIds: ['a', 'b'] })
    expect(chart.zoomIn().status).toBe('empty-data')
    expect(chart.resetViewport({}).status).toBe('empty-data')
    expect(log).toEqual([])
  })

  it('does not write old target domains back after a notification replaces data and runs another command', () => {
    const chart = create()
    const log = listen(chart)
    let updated = false
    chart.on('zoom-intent', () => {
      if (updated) return
      updated = true
      chart.setOption({ data: { ...data(20), series: data(20).series.reverse() } })
      chart.setViewportDomain([23, 27]) // Silent numeric path uses the new data.
    })
    const result = chart.zoomIn()
    expect(
      chart.getControlState().targets.map((target) => [target.trackId, target.viewport.xDomain]),
    ).toEqual([
      ['b', [23, 27]],
      ['a', [23, 27]],
    ])
    const ends = log.filter(({ event }) => event === 'zoom-end').map(({ args }) => args[0])
    expect(ends).toEqual([
      expect.objectContaining({
        commandId: 'command-1',
        seriesIds: ['a'],
        trackIndex: 0,
        start: 2.5,
        end: 7.5,
      }),
      expect.objectContaining({
        commandId: 'command-1',
        seriesIds: ['b'],
        trackIndex: 1,
        start: 2.5,
        end: 7.5,
      }),
    ])
    expect(result.targets.map((target) => target.after!.xDomain)).toEqual([
      [2.5, 7.5],
      [2.5, 7.5],
    ])
  })

  it('retains the outer command identity around a nested command', () => {
    const chart = create()
    const log = listen(chart)
    let nested = false
    chart.on('zoom-intent', () => {
      if (nested) return
      nested = true
      chart.zoomIn({ trackId: 'a' })
    })
    chart.zoomIn()
    expect(
      log
        .filter(({ event }) => event === 'zoom-end')
        .map(({ args }) => (args[0] as { commandId: string }).commandId),
    ).toEqual(['command-2', 'command-1', 'command-1'])
    expect(chart.getControlState().targets.map((target) => target.viewport.xDomain)).toEqual([
      [3.75, 6.25],
      [2.5, 7.5],
    ])
  })

  it('stops further command notifications when an intent callback disposes', async () => {
    const chart = create()
    const log = listen(chart)
    chart.on('zoom-intent', () => chart.dispose())
    const result = chart.zoomIn()
    expect(result.status).toBe('applied')
    expect(log.map(({ event }) => event)).toEqual(['zoom-intent'])
    await flushNativeUpdates()
    expect(chart.isDisposed()).toBe(true)
  })
})
