import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { gridSeries, mountSizedChart } from '@tests/support/waveformChart'
import { flushAnimationFrames } from '@tests/support/setup'

const input = {
  kind: 'points' as const,
  points: Array.from({ length: 101 }, (_, i) => ({ x: i / 10, y: i })),
}
const config = { initialXDomain: [2, 8], xDomainStrategy: { type: 'data' }, pannable: true }
function drag(el: Element, type: string, x: number) {
  const event = new MouseEvent(type, {
    button: 0,
    clientX: x,
    clientY: 50,
    bubbles: true,
    cancelable: true,
  })
  Object.defineProperty(event, 'pointerId', { value: 42 })
  el.dispatchEvent(event)
}
describe('toolbar boundaries and lifecycle', () => {
  it('keeps fit boundaries for wheel, pan and box then restores the initial window', async () => {
    const w = await mountSizedChart(input, config)
    const api = w.vm
    api.fitToData()
    await flushPromises()
    const overlay = w.get('.waveform-chart__overlay').element
    const width = Number(overlay.getAttribute('width'))
    Object.defineProperty(overlay, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height: 250 }),
    })
    overlay.dispatchEvent(
      new WheelEvent('wheel', { deltaY: -500, clientX: width / 2, clientY: 50, bubbles: true }),
    )
    flushAnimationFrames()
    await flushPromises()
    const wheel = api.getControlState().targets[0]!.viewport.xDomain
    expect(wheel[1] - wheel[0]).toBeCloseTo(5)
    api.setViewportDomain([0, 5], {})
    api.setInteractionMode('pan')
    await flushPromises()
    drag(overlay, 'pointerdown', 200)
    drag(overlay, 'pointermove', 100)
    drag(overlay, 'pointerup', 100)
    const pan = api.getControlState().targets[0]!.viewport.xDomain
    expect(pan[0]).toBeGreaterThan(0)
    expect(pan[0]).toBeLessThan(2)
    api.setInteractionMode('zoom')
    api.fitToData()
    await flushPromises()
    drag(overlay, 'pointerdown', 0)
    drag(overlay, 'pointerup', width / 2)
    expect(api.getControlState().targets[0]!.viewport.xDomain[0]).toBeCloseTo(0)
    expect(api.getControlState().targets[0]!.viewport.xDomain[1]).toBeCloseTo(5)
    api.resetViewport({})
    expect(api.getControlState().targets[0]!.viewport.xDomain).toEqual([2, 8])
    w.unmount()
  })
  it('cancels captured gestures on mode, capability, data changes and unmount', async () => {
    const w = await mountSizedChart(input, config)
    const overlay = w.get('.waveform-chart__overlay').element
    const release = vi.fn()
    Object.assign(overlay, {
      setPointerCapture: vi.fn(),
      hasPointerCapture: () => true,
      releasePointerCapture: release,
    })
    drag(overlay, 'pointerdown', 30)
    w.vm.setInteractionMode('none')
    drag(overlay, 'pointerup', 300)
    expect(w.emitted('zoom-end')).toBeUndefined()
    expect(release).toHaveBeenCalled()
    w.vm.setInteractionMode('pan')
    drag(overlay, 'pointerdown', 30)
    await w.setProps({ pannable: false })
    drag(overlay, 'pointerup', 300)
    w.vm.setInteractionMode('zoom')
    drag(overlay, 'pointerdown', 30)
    await w.setProps({ data: { ...input, points: [...input.points] } })
    drag(overlay, 'pointerup', 300)
    expect(w.emitted('zoom-end')).toBeUndefined()
    drag(w.get('.waveform-chart__overlay').element, 'pointerdown', 30)
    w.unmount()
  })
  it('clears fit on replacement, initial-domain changes and visibility changes', async () => {
    const w = await mountSizedChart(input, config)
    w.vm.fitToData()
    w.vm.setViewportDomain([1, 4], {})
    await w.setProps({ initialXDomain: [3, 7] })
    const domain = w.vm.getControlState().targets[0]!.viewport.xDomain
    expect(domain[0]).toBeGreaterThanOrEqual(3)
    expect(domain[1]).toBeLessThanOrEqual(7)
    w.vm.fitToData()
    await w.setProps({ data: { ...input, points: input.points.slice(0, 80) } })
    await flushPromises()
    const replaced = w.vm.getControlState().targets[0]!.viewport.xDomain
    expect(replaced[0]).toBeGreaterThanOrEqual(3)
    expect(replaced[1]).toBeLessThanOrEqual(7)
    await w.setProps({ hiddenSeriesIds: [w.vm.getControlState().targets[0]!.trackId] })
    expect(w.vm.zoomIn().status).toBe('empty-data')
    w.unmount()
  })
  it('captures target events in order with one command identity', async () => {
    const order: string[] = []
    const w = await mountSizedChart(gridSeries(2), {
      grid: { rowCount: 2, columnCount: 1 },
      onZoomIntent: () => order.push('intent'),
      onZoomChange: () => order.push('change'),
      onZoomEnd: () => order.push('end'),
    })
    const result = w.vm.zoomIn()
    expect(result.targets).toHaveLength(2)
    expect(order).toEqual(['intent', 'change', 'end', 'intent', 'change', 'end'])
    const events = w.emitted('zoom-end')!.map((e) => e[0] as { commandId: string })
    expect(events[0]!.commandId).toBe(events[1]!.commandId)
    await w.setProps({ grid: { rowCount: 1, columnCount: 1 } })
    expect(w.vm.zoomIn({ trackId: 'channel-1' }).status).toBe('invalid-target')
    w.unmount()
  })
})

it('preserves a full fitted interval across data replacement when initial bounds are wider', async () => {
  const w = await mountSizedChart(input, { ...config, initialXDomain: [-5, 15] })
  w.vm.fitToData()
  await w.setProps({ data: { ...input, points: [...input.points] } })
  await flushPromises()
  expect(w.vm.getControlState().targets[0]!.viewport.xDomain).toEqual([0, 10])
  w.unmount()
})
it('does not confuse an independent track named shared with the shared-axis boundary', async () => {
  const w = await mountSizedChart(
    {
      kind: 'series',
      series: [
        { id: 'shared', name: 'Shared', data: input },
        { id: 'other', name: 'Other', data: input },
      ],
    },
    config,
  )
  w.vm.fitToData({ trackId: 'shared' })
  expect(w.vm.getControlState().targets.map((t) => t.viewport.xDomain)).toEqual([
    [0, 10],
    [2, 8],
  ])
  w.unmount()
})
