// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { init, getInstanceByDom, dispose } from '../../../src/analysis'
import { Waveform } from '../../../src/display'
import { Animator } from '../../../src/animation/core/Animator'

let now = 0
let sequence = 0
const frames = new Map<number, FrameRequestCallback>()
const cleanups: (() => void)[] = []
beforeEach(() => {
  now = 0
  vi.spyOn(window.performance, 'now').mockImplementation(() => now)
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++sequence, callback)
    return sequence
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id)
  })
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
})
afterEach(() => {
  cleanups
    .splice(0)
    .reverse()
    .forEach((cleanup) => cleanup())
  frames.clear()
  vi.restoreAllMocks()
  document.body.replaceChildren()
})
function step(ms: number) {
  now += ms
  const pending = [...frames.values()]
  frames.clear()
  pending.forEach((callback) => callback(now))
}
function host() {
  const node = document.createElement('div')
  document.body.append(node)
  Object.defineProperty(node, 'getClientRects', { value: () => [{ width: 600, height: 300 }] })
  return node
}

describe('unified component ownership', () => {
  it('owns both components observers and animation frames in the iframe window', () => {
    const iframe = document.createElement('iframe')
    document.body.append(iframe)
    const owner = iframe.contentWindow!
    const pending = new Map<number, FrameRequestCallback>()
    const observers = new Set<object>()
    let serial = 0
    vi.spyOn(owner.document, 'hidden', 'get').mockReturnValue(false)
    vi.spyOn(owner, 'requestAnimationFrame').mockImplementation((callback) => {
      pending.set(++serial, callback)
      return serial
    })
    vi.spyOn(owner, 'cancelAnimationFrame').mockImplementation((id) => {
      pending.delete(id)
    })
    Object.defineProperty(owner, 'ResizeObserver', {
      configurable: true,
      value: class {
        observe() {
          observers.add(this)
        }
        disconnect() {
          observers.delete(this)
        }
      },
    })
    const nodes = [0, 1].map(() => {
      const node = owner.document.createElement('div')
      owner.document.body.append(node)
      vi.spyOn(node, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
      return node
    })
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]
    const analysis = init(nodes[0], {
      width: 600,
      height: 300,
      data: { kind: 'points', points },
      animationEnabled: true,
      animation: { duration: 1000 },
    })
    cleanups.push(() => analysis.dispose())
    const display = new Waveform(nodes[1], points, {
      width: 600,
      height: 300,
      animationEnabled: true,
      animation: { duration: 1000 },
    })
    cleanups.push(() => display.destroy())
    expect(observers.size).toBeGreaterThanOrEqual(2)
    expect(pending.size).toBeGreaterThan(0)
    expect(frames.size).toBe(0)
    display.destroy()
    expect(nodes[1].querySelector('svg')).toBeNull()
    expect(observers.size).toBeGreaterThan(0)
    analysis.dispose()
    expect(nodes[0].querySelector('svg')).toBeNull()
    expect(observers.size).toBe(0)
    expect(pending.size).toBe(0)
    expect(iframe.isConnected).toBe(true)
  })

  it('shares the task engine while keeping chart state, IDs and consumer tasks independent', () => {
    const source = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]
    const original = JSON.stringify(source)
    const analysisHost = host()
    const analysis = init(analysisHost, {
      width: 600,
      height: 300,
      data: {
        kind: 'series',
        series: [{ id: 'same', name: 'same', data: { kind: 'points', points: source } }],
      },
      animation: { duration: 1000 },
    })
    cleanups.push(() => analysis.dispose())
    const completed = vi.fn()
    const display = new Waveform(host(), [{ id: 'same', data: source }], {
      width: 600,
      height: 300,
      animationEnabled: true,
      animation: { duration: 1000, onComplete: completed },
    })
    cleanups.push(() => display.destroy())
    const external = new Animator({
      now: () => now,
      requestFrame: (callback) => window.requestAnimationFrame(callback),
      cancelFrame: (id) => window.cancelAnimationFrame(id),
      setTimer: (callback) => window.setTimeout(callback, 0),
      clearTimer: (id) => window.clearTimeout(id as number),
    })
    cleanups.push(() => external.destroy())
    const values: number[] = []
    external.animate({ duration: 1000, force: true, during: (p) => values.push(p) }, 'same')
    step(100)
    expect(display.animation.isRunning()).toBe(true)
    display.animation.pause()
    step(100)
    expect(values.at(-1)).toBeCloseTo(0.2)
    expect(completed).not.toHaveBeenCalled()
    const svgIds = [...document.querySelectorAll('[id]')].map((node) => node.id)
    expect(new Set(svgIds).size).toBe(svgIds.length)
    display.destroy()
    step(200)
    expect(values.at(-1)).toBeCloseTo(0.4)
    expect(getInstanceByDom(analysisHost)).toBe(analysis)
    expect(analysis.isDisposed()).toBe(false)
    expect(JSON.stringify(source)).toBe(original)
    dispose(analysisHost)
    expect(getInstanceByDom(analysisHost)).toBeUndefined()
    external.destroy()
    expect(frames.size).toBe(0)
  })

  it('finishes display export synchronously and notifies each category in a microtask', async () => {
    const complete = vi.fn()
    const display = new Waveform(
      host(),
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      {
        width: 600,
        height: 300,
        animationEnabled: true,
        animation: { duration: 1000, onComplete: complete },
      },
    )
    cleanups.push(() => display.destroy())
    display.animation.pause()
    const svg = display.toSVGString()
    expect(svg).toContain('<svg')
    expect(display.animation.isRunning()).toBe(false)
    expect(complete).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(complete).toHaveBeenCalledOnce()
    display.destroy()
    expect(display.toSVGString()).toBe('')
    expect(frames.size).toBe(0)
  })
})
