import { afterEach, describe, expect, it, vi } from 'vitest'
import { VueChartAdapter } from '@/adapters/vue/VueChartAdapter'
import { WaveformChart } from '@/chart/WaveformChart'
import { getInstanceByDom } from '@/chart/init'
import { ChartEventEmitter } from '@/chart/ChartEventEmitter'
import { flushNativeUpdates } from '../../support/nativeChart'

const adapters: VueChartAdapter[] = []
afterEach(() => {
  adapters.splice(0).forEach((adapter) => adapter.dispose())
  vi.restoreAllMocks()
})
const data = {
  kind: 'points' as const,
  points: [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ],
}
function setup() {
  const host = document.createElement('div')
  const emit = vi.fn()
  const adapter = new VueChartAdapter(emit)
  adapters.push(adapter)
  const options = { data, width: 800, height: 400, animationEnabled: false }
  adapter.attach(host, options)
  return { adapter, options, host, emit }
}

describe('Vue boundary ownership', () => {
  it('commits only changed fields and explicitly removes omitted optional fields', async () => {
    const { adapter, options } = setup()
    const setOption = vi.spyOn(WaveformChart.prototype, 'setOption')
    adapter.update({ ...options, lineColor: 'red', title: { text: '标题' } })
    expect(setOption).toHaveBeenLastCalledWith({ lineColor: 'red', title: { text: '标题' } })
    adapter.update({ ...options, lineColor: 'blue' })
    expect(setOption).toHaveBeenLastCalledWith({ lineColor: 'blue', title: undefined })
    adapter.update({ ...options, lineColor: 'blue' })
    expect(setOption).toHaveBeenCalledTimes(2)
    expect(setOption.mock.calls.every(([patch]) => !('data' in patch))).toBe(true)
    await flushNativeUpdates()
  })

  it('does not advance the prop snapshot when the native option transaction fails', () => {
    const { adapter, options } = setup()
    const setOption = vi.spyOn(WaveformChart.prototype, 'setOption')
    expect(() => adapter.update({ ...options, timeUnit: 'bad' as 's' })).toThrow()
    adapter.update({ ...options, timeUnit: 's' })
    expect(setOption).toHaveBeenLastCalledWith({ timeUnit: 's' })
  })

  it('preserves numeric handle overloads and forwards multi-argument events intact', async () => {
    const subscribe = vi.spyOn(ChartEventEmitter.prototype, 'on')
    const { adapter, emit } = setup()
    await flushNativeUpdates()
    expect(adapter.setViewportDomain([0.2, 0.8], 0)).toBeUndefined()
    expect(adapter.resetViewport(0)).toBeUndefined()
    expect(adapter.setViewportDomain([0.2, 0.8], {}).kind).toBe('viewport')
    const events = subscribe.mock.contexts.at(-1)! as ChartEventEmitter
    const current = { id: 'note', seriesId: 'series-0', x: 0.5, y: 0.5, text: '新值' }
    const previous = { ...current, text: '旧值' }
    events.emit('annotation-update', current, previous)
    events.emit('page-change', 2, 5)
    expect(emit).toHaveBeenCalledWith('annotation-update', current, previous)
    expect(emit).toHaveBeenCalledWith('page-change', 2, 5)
    expect(emit.mock.calls.find(([name]) => name === 'annotation-update')?.slice(1)).toEqual([
      current,
      previous,
    ])
  })

  it('releases subscriptions and the registered instance and rejects exports after unmount', async () => {
    const { adapter, host, emit } = setup()
    const instance = getInstanceByDom(host)!
    const exporting = adapter.exportImage({ format: 'svg' })
    adapter.dispose()
    adapter.dispose()
    await expect(exporting).rejects.toMatchObject({ code: 'export-cancelled' })
    await flushNativeUpdates()
    expect(instance.isDisposed()).toBe(true)
    expect(getInstanceByDom(host)).toBeUndefined()
    expect(host.childElementCount).toBe(0)
    expect(emit).not.toHaveBeenCalled()
    await expect(adapter.exportImage()).rejects.toMatchObject({ code: 'export-cancelled' })
    expect(() => adapter.getControlState()).toThrow('not attached')
  })
})
