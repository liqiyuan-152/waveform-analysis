import { afterEach, describe, expect, it } from 'vitest'
import { mountLegacySizedChart as mountSizedChart } from '../support/waveformChart'
import { init } from '@/chart/init'
import type { WaveformChartInstance } from '@/types/native'
import type { WaveformChartHandle } from '@/types/controls'
import type { WaveformChartOptions } from '@/types/options'
import type { WaveformData } from '@/types/data'
import { flushNativeUpdates } from '../support/nativeChart'

const cleanup: Array<() => void> = []
afterEach(() => cleanup.splice(0).forEach((dispose) => dispose()))
const data: WaveformData = {
  kind: 'series',
  series: ['a', 'b', 'c', 'd'].map((id, i) => ({
    id,
    name: id,
    trackId: i < 2 ? 'first' : 'second',
    data: {
      kind: 'points',
      points: Array.from({ length: 101 }, (_, x) => ({ x: x / 10, y: (i + 1) * Math.sin(x) })),
    },
  })),
}
async function pair(options: WaveformChartOptions = {}) {
  const props = {
    data,
    width: 800,
    height: 360,
    animationEnabled: false,
    xDomainStrategy: { type: 'data' as const },
    initialXDomain: [2, 8] as [number, number],
    rendering: { sampling: { mode: 'raw' as const } },
    ...options,
  }
  const vue = await mountSizedChart(props.data, props)
  cleanup.push(() => vue.unmount())
  const host = document.createElement('div')
  const native = init(host, props, { autoResize: false })
  cleanup.push(() => native.dispose())
  await flushNativeUpdates()
  return { vue, old: vue.vm as WaveformChartHandle, native }
}
function events(chart: WaveformChartInstance) {
  const captured: Record<string, unknown[][]> = {}
  for (const event of ['zoom-intent', 'zoom-change', 'zoom-end', 'zoom-reset'] as const)
    chart.on(event, (...args) => {
      ;(captured[event] ??= []).push(args)
    })
  return captured
}

// Vue represents domains through D3 transforms; compare arithmetic at 14 significant digits.
function comparable(value: unknown): unknown {
  if (typeof value === 'number') return Number(value.toPrecision(14))
  if (Array.isArray(value)) return value.map(comparable)
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, comparable(child)]))
  return value
}

describe('native command compatibility', () => {
  it.each(['independent', 'separated', 'compact'] as const)(
    'matches command results and event tuples in %s',
    async (displayMode) => {
      const h = await pair({ displayMode, overlayMode: 'multi-axis', maxZoomScale: 10 })
      const actual = events(h.native)
      const commands: Array<(chart: WaveformChartHandle) => unknown> = [
        (chart) => chart.fitToData(),
        (chart) => chart.setViewportDomain([4.9, 5.1], {}),
        (chart) => chart.zoomIn(),
        (chart) => chart.zoomOut(),
        (chart) => chart.resetViewport({}),
        (chart) => chart.resetViewport({}),
      ]
      for (const command of commands) {
        expect(comparable(command(h.native))).toEqual(comparable(command(h.old)))
        expect(comparable(h.native.getControlState())).toEqual(comparable(h.old.getControlState()))
      }
      for (const [event, args] of Object.entries(actual))
        expect(comparable(args)).toEqual(comparable(h.vue.emitted(event)))
    },
  )

  it('keeps numeric overloads silent and invalid targets/domains unchanged', async () => {
    const h = await pair()
    const actual = events(h.native)
    for (const chart of [h.native, h.old]) {
      expect(chart.setViewportDomain([3, 5], 1)).toBeUndefined()
      expect(chart.resetViewport(1)).toBeUndefined()
      expect(chart.zoomIn({ trackId: 'missing' }).status).toBe('invalid-target')
      expect(chart.setViewportDomain([NaN, 1], {}).status).toBe('invalid-domain')
    }
    expect(comparable(h.native.getControlState())).toEqual(comparable(h.old.getControlState()))
    expect(actual).toEqual({})
    expect(h.vue.emitted('zoom-intent')).toBeUndefined()
    expect(h.vue.emitted('zoom-reset')).toBeUndefined()
  })

  it.each([
    { maxZoomScale: 2 },
    { minZoomSpan: 1.5 },
    { minVisiblePoints: 20 },
    { integerZoom: true },
    { zoomable: false },
    { presentationMode: true },
    { hiddenSeriesIds: ['a', 'b', 'c', 'd'] },
    { data: { kind: 'points' as const, points: [] } },
  ])('preserves command limits and disabled/empty policies %j', async (options) => {
    const h = await pair(options)
    for (const command of [
      (chart: WaveformChartHandle) => chart.setViewportDomain([4.9, 5.1], {}),
      (chart: WaveformChartHandle) => chart.zoomIn(),
      (chart: WaveformChartHandle) => chart.fitToData(),
      (chart: WaveformChartHandle) => chart.resetViewport({}),
    ]) {
      expect(comparable(command(h.native))).toEqual(comparable(command(h.old)))
      expect(comparable(h.native.getControlState())).toEqual(comparable(h.old.getControlState()))
    }
  })

  it('preserves partial target success and target-scoped zoom limits', async () => {
    const h = await pair({ minZoomSpan: 0.25 })
    for (const chart of [h.native, h.old]) chart.setViewportDomain([3, 3.25], { trackId: 'first' })
    const actual = h.native.zoomIn(),
      expected = h.old.zoomIn()
    expect(actual.targets.map((target) => target.status)).toEqual(['unchanged', 'applied'])
    expect(comparable(actual)).toEqual(comparable(expected))
  })

  it('preserves silent numeric writes while command capabilities are disabled', async () => {
    const h = await pair({ zoomable: false, presentationMode: true })
    for (const chart of [h.native, h.old]) {
      expect(chart.zoomIn().status).toBe('disabled')
      chart.setViewportDomain([3, 5], 0)
      expect(chart.getControlState().targets[0].viewport.xDomain).toEqual([3, 5])
      chart.resetViewport(0)
    }
    expect(comparable(h.native.getControlState())).toEqual(comparable(h.old.getControlState()))
  })
})
