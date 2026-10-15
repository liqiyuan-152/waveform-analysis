import { afterEach, describe, expect, it, vi } from 'vitest'
import { init } from '@/chart/init'
import { ChartEventEmitter } from '@/chart/ChartEventEmitter'
import { ControlStateObserver } from '@/controls/ControlStateObserver'
import type { WaveformChartOptions } from '@/types/options'
import { flushNativeUpdates } from '../support/nativeChart'
import { mountLegacySizedChart as mountSizedChart } from '../support/waveformChart'
import { flushPromises } from '@vue/test-utils'

const cleanup: Array<() => void> = []
afterEach(() => cleanup.splice(0).forEach((dispose) => dispose()))
const data = {
  kind: 'points' as const,
  points: Array.from({ length: 101 }, (_, index) => ({ x: index / 10, y: index })),
}
async function native(options: WaveformChartOptions = {}) {
  const host = document.createElement('div')
  Object.defineProperty(host, 'getClientRects', { value: () => [{}] })
  document.body.append(host)
  const chart = init(
    host,
    {
      data,
      width: 800,
      height: 360,
      animationEnabled: false,
      xDomainStrategy: { type: 'data' },
      ...options,
    },
    { autoResize: false },
  )
  cleanup.push(() => {
    chart.dispose()
    host.remove()
  })
  await flushNativeUpdates()
  return { chart, host }
}
function comparable(value: unknown): unknown {
  if (typeof value === 'number') return Number(value.toPrecision(13))
  if (Array.isArray(value)) return value.map(comparable)
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, comparable(item)]))
  return value
}

describe('native control-state protocol', () => {
  it('does not emit an initial state and notifies once after synchronous lifecycle events', async () => {
    const { chart } = await native()
    const order: string[] = []
    chart.on('control-state-change', (state) => {
      order.push('state')
      expect(state).toEqual(chart.getControlState())
    })
    chart.on('zoom-intent', () => order.push('intent'))
    chart.on('zoom-change', () => order.push('change'))
    chart.on('zoom-end', () => order.push('end'))
    await flushNativeUpdates()
    expect(order).toEqual([])
    chart.zoomIn()
    expect(order).toEqual(['intent', 'change', 'end'])
    await flushNativeUpdates()
    expect(order).toEqual(['intent', 'change', 'end', 'state'])
  })

  it.each(['independent', 'separated', 'compact'] as const)(
    'matches Vue effective state changes through commands, capabilities and replacement in %s',
    async (displayMode) => {
      const options = { displayMode, pannable: true, initialXDomain: [2, 8] as [number, number] }
      const { chart } = await native(options)
      const wrapper = await mountSizedChart(data, {
        ...options,
        width: 800,
        height: 360,
        animationEnabled: false,
        xDomainStrategy: { type: 'data' },
      })
      cleanup.push(() => wrapper.unmount())
      const states = vi.fn()
      chart.on('control-state-change', states)
      const steps = [
        () => {
          chart.zoomIn()
          wrapper.vm.zoomIn()
        },
        () => {
          chart.fitToData()
          wrapper.vm.fitToData()
        },
        () => {
          chart.resetViewport({})
          wrapper.vm.resetViewport({})
        },
        () => {
          chart.setInteractionMode('pan')
          wrapper.vm.setInteractionMode('pan')
        },
        async () => {
          chart.setOption({ pannable: false })
          await wrapper.setProps({ pannable: false })
        },
        async () => {
          chart.setOption({ data: { ...data, points: data.points.slice(0, 51) } })
          await wrapper.setProps({ data: { ...data, points: data.points.slice(0, 51) } })
        },
      ]
      for (const step of steps) {
        await step()
        await flushNativeUpdates()
        await flushPromises()
        const vueStates = wrapper.emitted('control-state-change')!
        expect(states.mock.calls.length).toBe(vueStates.length)
        expect(comparable(states.mock.calls.at(-1)![0])).toEqual(comparable(vueStates.at(-1)![0]))
      }
    },
  )

  it('coalesces updates and suppresses changed configuration with an identical effective state', async () => {
    const { chart } = await native()
    const states = vi.fn()
    chart.on('control-state-change', states)
    chart.zoomIn()
    chart.resetViewport({})
    await flushNativeUpdates()
    expect(states).not.toHaveBeenCalled()
    chart.setOption({ lineColor: '#f00', timeUnit: 's' })
    chart.setOption({ data: { ...data, points: [...data.points] } })
    await flushNativeUpdates()
    expect(states).not.toHaveBeenCalled()
    chart.zoomIn()
    chart.zoomIn()
    await flushNativeUpdates()
    expect(states).toHaveBeenCalledExactlyOnceWith(chart.getControlState())
  })

  it('does not notify an unacknowledged controlled request but observes host acknowledgement', async () => {
    const { chart } = await native({ interactionMode: 'zoom', pannable: true })
    const states = vi.fn()
    chart.on('control-state-change', states)
    chart.setInteractionMode('pan')
    await flushNativeUpdates()
    expect(states).not.toHaveBeenCalled()
    chart.setOption({ interactionMode: 'pan' })
    await flushNativeUpdates()
    expect(states).toHaveBeenCalledExactlyOnceWith(chart.getControlState())
  })

  it('observes visible series identity and the active page', async () => {
    const input = {
      kind: 'series' as const,
      series: ['a', 'b'].map((id) => ({ id, name: id, data })),
    }
    const { chart, host } = await native({ data: input, grid: { rowCount: 1, columnCount: 1 } })
    const states = vi.fn()
    chart.on('control-state-change', states)
    host.querySelector<HTMLButtonElement>('[aria-label="下一页"]')!.click()
    await flushNativeUpdates()
    expect(states.mock.calls.at(-1)![0].targets[0].trackId).toBe('b')
    chart.setOption({ hiddenSeriesIds: ['b'] })
    await flushNativeUpdates()
    expect(states.mock.calls.at(-1)![0].available['zoom-in']).toBe(false)
  })

  it('isolates payload mutation and delivers a callback update as a new notification', async () => {
    const { chart } = await native({ pannable: true })
    const states = vi.fn()
    chart.on('control-state-change', states)
    const release = chart.on('control-state-change', (state) => {
      state.targets[0].viewport.xDomain[0] = -999
      release()
      chart.setInteractionMode('pan')
    })
    chart.zoomIn()
    await flushNativeUpdates()
    expect(states).toHaveBeenCalledTimes(2)
    expect(chart.getControlState().targets[0].viewport.xDomain[0]).toBeGreaterThan(0)
    expect(states.mock.calls[1][0]).toEqual(chart.getControlState())
  })

  it('drops pending notifications and subsequent subscribers when a callback disposes', async () => {
    const { chart } = await native()
    const later = vi.fn()
    chart.on('control-state-change', () => chart.dispose())
    chart.on('control-state-change', later)
    chart.zoomIn()
    await flushNativeUpdates()
    expect(chart.isDisposed()).toBe(true)
    expect(later).not.toHaveBeenCalled()
    const second = await native()
    second.chart.on('control-state-change', later)
    second.chart.zoomIn()
    second.chart.dispose()
    await flushNativeUpdates()
    expect(later).not.toHaveBeenCalled()
  })

  it('commits signatures before callbacks and invalidates uncancellable queued microtasks on disposal', async () => {
    const { chart } = await native()
    let state = chart.getControlState()
    const emitter = new ChartEventEmitter()
    const queued: Array<() => void> = []
    const observer = new ControlStateObserver(
      () => structuredClone(state),
      emitter,
      (callback) => queued.push(callback),
    )
    const handler = vi.fn()
    emitter.on('control-state-change', handler)
    state = { ...state, mode: 'pan' }
    observer.schedule()
    observer.schedule()
    expect(queued).toHaveLength(1)
    observer.dispose()
    queued[0]()
    expect(handler).not.toHaveBeenCalled()
  })

  it('reports failed snapshot reads without poisoning the next notification', async () => {
    const { chart } = await native()
    const emitter = new ChartEventEmitter()
    const queued: Array<() => void> = []
    const read = vi.fn(() => chart.getControlState())
    const report = vi.fn(),
      handler = vi.fn()
    const observer = new ControlStateObserver(
      read,
      emitter,
      (callback) => queued.push(callback),
      report,
    )
    emitter.on('control-state-change', handler)
    const error = new Error('formatter failed')
    read.mockImplementationOnce(() => {
      throw error
    })
    observer.schedule()
    queued.shift()!()
    expect(report).toHaveBeenCalledExactlyOnceWith(error)
    expect(handler).not.toHaveBeenCalled()
    chart.zoomIn()
    observer.schedule()
    queued.shift()!()
    expect(handler).toHaveBeenCalledExactlyOnceWith(chart.getControlState())
    observer.dispose()
    emitter.dispose()
  })
})
