import { afterEach, describe, expect, it, vi } from 'vitest'
import { init } from '@/chart/init'
import type { WaveformChartInstance } from '@/types/native'

const cleanup: Array<() => void> = []
afterEach(() => {
  cleanup.splice(0).forEach((dispose) => dispose())
  vi.restoreAllMocks()
})
async function fixture() {
  const iframe = document.createElement('iframe')
  document.body.append(iframe)
  const owner = iframe.contentWindow!,
    host = owner.document.createElement('div')
  owner.document.body.append(host)
  vi.spyOn(host, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
  let sequence = 0
  const frames = new Map<number, FrameRequestCallback>(),
    timers = new Map<number, () => void>()
  vi.spyOn(owner, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = ++sequence
    frames.set(id, callback)
    return id
  })
  vi.spyOn(owner, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id)
  })
  vi.spyOn(owner, 'setTimeout').mockImplementation((callback) => {
    const id = ++sequence
    timers.set(id, callback as () => void)
    return id
  })
  vi.spyOn(owner, 'clearTimeout').mockImplementation((id) => {
    if (id !== undefined) timers.delete(id)
  })
  const add = vi.spyOn(owner, 'addEventListener'),
    remove = vi.spyOn(owner, 'removeEventListener')
  const chart: WaveformChartInstance = init(
    host,
    {
      width: 800,
      height: 360,
      animationEnabled: false,
      pannable: true,
      xDomainStrategy: { type: 'data' },
      rendering: { sampling: { mode: 'raw' } },
      data: {
        kind: 'points',
        points: Array.from({ length: 101 }, (_, n) => ({ x: n / 10, y: n })),
      },
    },
    { autoResize: false },
  )
  cleanup.push(() => {
    chart.dispose()
    iframe.remove()
  })
  async function settle() {
    for (let turn = 0; turn < 12; turn++) {
      const callbacks = [...frames.values()]
      frames.clear()
      callbacks.forEach((callback) => callback(0))
      await Promise.resolve()
    }
  }
  await settle()
  const root = host.querySelector<HTMLElement>('.waveform-native-chart')!
  const overlay = host.querySelector<SVGRectElement>('.waveform-chart__overlay')!
  const width = Number(overlay.getAttribute('width'))
  Object.defineProperty(overlay, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width, height: 260 }),
  })
  function pointer(type: string, ratio: number, target: EventTarget = overlay) {
    const event = owner.document.createEvent('MouseEvent')
    event.initMouseEvent(
      type,
      true,
      true,
      owner,
      0,
      0,
      0,
      width * ratio,
      100,
      false,
      false,
      false,
      false,
      0,
      null,
    )
    Object.defineProperty(event, 'pointerId', { value: 99 })
    target.dispatchEvent(event)
  }
  return { chart, root, overlay, owner, frames, timers, add, remove, pointer, settle, width }
}

describe('native gesture owner-window lifecycle', () => {
  it('keeps annotation drag capture/frames and cancellation in the host realm', async () => {
    const h = await fixture()
    h.chart.setOption({
      data: {
        kind: 'series',
        series: [
          {
            id: 'a',
            name: 'a',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 10, y: 100 },
              ],
            },
          },
        ],
      },
      annotations: [{ id: 'note', seriesId: 'a', x: 5, y: 50, text: '跨窗口标注' }],
    })
    await h.settle()
    const parentRequest = vi.spyOn(window, 'requestAnimationFrame'),
      request = vi.fn()
    h.chart.on('update:annotations', request)
    const node = h.root.querySelector<SVGGElement>('.waveform-annotation')!
    const release = vi.fn()
    node.setPointerCapture = vi.fn()
    node.hasPointerCapture = () => true
    node.releasePointerCapture = release
    h.pointer('pointerdown', 0.2, node)
    h.pointer('pointermove', 0.3, h.owner)
    expect(parentRequest).not.toHaveBeenCalled()
    expect(h.frames.size).toBe(1)
    const stale = [...h.frames.values()][0]!
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(release).not.toHaveBeenCalled()
    const escape = h.owner.document.createEvent('Event')
    escape.initEvent('keydown', true, true)
    Object.defineProperty(escape, 'key', { value: 'Escape' })
    h.owner.dispatchEvent(escape)
    expect(release).toHaveBeenCalledWith(99)
    expect(h.frames.size).toBe(0)
    stale(0)
    h.pointer('pointerup', 0.3, h.owner)
    expect(request).not.toHaveBeenCalled()
    h.pointer('pointerdown', 0.2, node)
    h.pointer('pointermove', 0.3, h.owner)
    h.chart.dispose()
    expect(h.frames.size).toBe(0)
    h.pointer('pointerup', 0.3, h.owner)
    expect(request).not.toHaveBeenCalled()
  })

  it('keeps hover frames, tooltip observer and removed callbacks in the host realm', async () => {
    const h = await fixture()
    const parentRequest = vi.spyOn(window, 'requestAnimationFrame')
    const point = vi.fn()
    h.chart.on('point-hover', point)
    const rootRemove = vi.spyOn(h.root, 'removeEventListener')
    const observe = vi.fn(),
      disconnect = vi.fn()
    let observerCallback: ResizeObserverCallback | undefined
    Object.defineProperty(h.owner, 'ResizeObserver', {
      configurable: true,
      value: class {
        constructor(callback: ResizeObserverCallback) {
          observerCallback = callback
        }
        observe = observe
        disconnect = disconnect
      },
    })
    h.pointer('pointermove', 0.25)
    expect(parentRequest).not.toHaveBeenCalled()
    expect(h.frames.size).toBe(1)
    const stale = [...h.frames.values()][0]!
    await h.settle()
    expect(point).toHaveBeenLastCalledWith({ x: 2.5, y: 25 })
    expect(h.root.querySelector('.waveform-tooltip')).not.toBeNull()
    expect(observe).toHaveBeenCalledWith(h.root.querySelector('.waveform-tooltip'))
    h.pointer('pointermove', 0.5)
    h.chart.dispose()
    expect(h.frames.size).toBe(0)
    const notifications = point.mock.calls.length
    stale(0)
    await h.settle()
    expect(point).toHaveBeenCalledTimes(notifications)
    expect(h.root.querySelector('.waveform-tooltip')).toBeNull()
    expect(disconnect).toHaveBeenCalledOnce()
    observerCallback!([], {} as ResizeObserver)
    const hoverNames = ['pointermove', 'pointerout', 'pointerleave', 'pointercancel']
    expect(rootRemove.mock.calls.filter(([name]) => hoverNames.includes(name))).toHaveLength(5)
  })

  it('ignores parent Escape and releases the pointer only on owner-window cancellation', async () => {
    const h = await fixture(),
      release = vi.fn()
    h.overlay.setPointerCapture = vi.fn()
    h.overlay.releasePointerCapture = release
    h.pointer('pointerdown', 0.25)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(release).not.toHaveBeenCalled()
    expect(h.root.querySelector<SVGElement>('.waveform-chart__zoom-selection')?.style.display).toBe(
      '',
    )
    const event = h.owner.document.createEvent('Event')
    event.initEvent('keydown', true, true)
    Object.defineProperty(event, 'key', { value: 'Escape' })
    h.owner.dispatchEvent(event)
    expect(release).toHaveBeenCalledWith(99)
    expect(h.root.querySelector<SVGElement>('.waveform-chart__zoom-selection')?.style.display).toBe(
      'none',
    )
    h.pointer('pointerup', 0.75)
    expect(h.chart.getControlState().targets[0].viewport.xDomain).toEqual([0, 10])
  })

  it('uses and releases owner-window wheel frames, timers and exact event listeners', async () => {
    const h = await fixture(),
      ends = vi.fn(),
      changes = vi.fn()
    h.chart.on('zoom-end', ends)
    h.chart.on('zoom-change', changes)
    const beforeTimers = h.timers.size
    // jsdom also installs its own capture keyboard handlers on this window.
    const listeners = h.add.mock.calls.filter(
      ([name, , options]) =>
        options === undefined &&
        ['keydown', 'keyup', 'blur', 'pointermove', 'pointerup', 'pointercancel'].includes(name),
    )
    const event = h.owner.document.createEvent('MouseEvent')
    event.initMouseEvent(
      'wheel',
      true,
      true,
      h.owner,
      0,
      0,
      0,
      h.width / 2,
      100,
      false,
      false,
      false,
      false,
      0,
      null,
    )
    Object.defineProperty(event, 'deltaY', { value: -100 })
    h.overlay.dispatchEvent(event)
    expect(h.timers.size).toBe(beforeTimers + 1)
    expect(h.frames.size).toBeGreaterThan(0)
    await h.settle()
    expect(changes).toHaveBeenCalledOnce()
    expect(h.chart.getControlState().targets[0].viewport.xDomain).toEqual([2.5, 7.5])
    const pending = [...h.timers.values()]
    h.chart.dispose()
    expect(h.frames.size).toBe(0)
    expect(h.timers.size).toBe(0)
    // Gesture manager + annotation drag + annotation draft/menu owners share this realm.
    expect(listeners.map(([name]) => name).sort()).toEqual(
      [
        'keydown',
        'keyup',
        'blur',
        'pointermove',
        'pointerup',
        'pointercancel',
        'pointermove',
        'pointerup',
        'pointercancel',
        'blur',
        'keydown',
        'keydown',
      ].sort(),
    )
    for (const [name, listener] of listeners) expect(h.remove).toHaveBeenCalledWith(name, listener)
    pending.forEach((callback) => callback())
    expect(ends).not.toHaveBeenCalled()
    expect(changes).toHaveBeenCalledOnce()
  })
})
