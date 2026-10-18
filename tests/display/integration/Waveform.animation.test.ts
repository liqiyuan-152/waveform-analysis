// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Waveform, type WaveformOptions } from '../../../src/display/index'
import { SvgRenderer } from '../../../src/display/renderer/SvgRenderer'

const charts: Waveform[] = []
let time = 0
let sequence = 0
const frames = new Map<number, FrameRequestCallback>()
beforeEach(() => {
  time = 0
  sequence = 0
  vi.spyOn(window.performance, 'now').mockImplementation(() => time)
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++sequence, callback)
    return sequence
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => {
    frames.delete(handle)
  })
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
})
afterEach(() => {
  charts.splice(0).forEach((chart) => chart.destroy())
  frames.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

function step(delta: number) {
  time += delta
  const pending = [...frames.values()]
  frames.clear()
  pending.forEach((callback) => callback(time))
}

const data = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
]
function create(options: WaveformOptions = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  const chart = new Waveform(host, data, {
    width: 800,
    height: 320,
    responsive: { enabled: false },
    layout: { autoPadding: false },
    padding: { left: 60, right: 60 },
    animationEnabled: true,
    animation: { duration: 100, staggerDelay: 0, easing: 'linear' },
    animationUpdate: { duration: 100, easing: 'linear' },
    ...options,
  })
  charts.push(chart)
  return { chart, host }
}

describe('public animation lifecycle', () => {
  it('clips entry, pauses independently, and removes transient geometry at completion', () => {
    const complete = vi.fn()
    const { chart, host } = create({
      animation: { duration: 100, easing: 'linear', onComplete: complete },
    })
    expect(chart.animation.isRunning()).toBe(true)
    expect(host.querySelector('clipPath[id*="entry"] rect')?.getAttribute('width')).toBe('0')
    step(50)
    expect(
      Number(host.querySelector('clipPath[id*="entry"] rect')?.getAttribute('width')),
    ).toBeGreaterThan(0)
    chart.animation.pause()
    expect(frames.size).toBe(0)
    step(100)
    chart.animation.resume()
    step(50)
    expect(chart.animation.isRunning()).toBe(false)
    expect(host.querySelector('clipPath[id*="entry"]')).toBeNull()
    expect(complete).toHaveBeenCalledOnce()
    expect(frames.size).toBe(0)
  })

  it('animates changed point counts and shares moving domains with axes', () => {
    const { chart, host } = create()
    chart.animation.finish()
    chart.updateData([
      { x: 0, y: 0 },
      { x: 1, y: 3 },
      { x: 2, y: 4 },
    ])
    expect(chart.animation.isRunning()).toBe(true)
    const initial = host.innerHTML
    step(50)
    expect(host.innerHTML).not.toBe(initial)
    step(50)
    expect(chart.animation.isRunning()).toBe(false)
    expect(frames.size).toBe(0)
  })

  it('exports the target synchronously and defers completion callbacks', async () => {
    const complete = vi.fn()
    const { chart, host } = create({ animation: { duration: 100, onComplete: complete } })
    step(20)
    const source = chart.toSVGString()
    expect(source).not.toContain('-entry-')
    expect(complete).not.toHaveBeenCalled()
    expect(chart.animation.isRunning()).toBe(false)
    expect(host.querySelector('clipPath[id*="entry"]')).toBeNull()
    await Promise.resolve()
    expect(complete).toHaveBeenCalledOnce()
  })

  it('aborts replaced data even when the new submission disables animation', () => {
    const abort = vi.fn()
    const complete = vi.fn()
    const { chart } = create({ animation: { onAbort: abort, onComplete: complete } })
    chart.update({ data: [{ x: 0, y: 2 }], options: { animationEnabled: false } })
    expect(abort).toHaveBeenCalledOnce()
    expect(complete).not.toHaveBeenCalled()
    expect(chart.animation.isRunning()).toBe(false)
    expect(frames.size).toBe(0)
  })

  it('preserves active timing when only timing or callbacks change', () => {
    const original = vi.fn()
    const replacement = vi.fn()
    const { chart } = create({ animation: { duration: 100, onComplete: original } })
    step(50)
    chart.updateOptions({ animation: { duration: 1000, onComplete: replacement } })
    step(50)
    expect(original).toHaveBeenCalledOnce()
    expect(replacement).not.toHaveBeenCalled()
    expect(chart.getOptions().animation?.duration).toBe(1000)
  })

  it('rejects invalid options without interrupting animation and releases resources before destroy callbacks', () => {
    const abort = vi.fn(() => {
      expect(frames.size).toBe(0)
      expect(() => chart.animation.resume()).toThrow(/destroyed/)
    })
    const chart: Waveform = create({ animation: { onAbort: abort } }).chart
    expect(() => chart.updateOptions({ animation: { duration: -1 } })).toThrow()
    expect(chart.animation.isRunning()).toBe(true)
    chart.destroy()
    expect(abort).toHaveBeenCalledOnce()
    expect(() => chart.animation.isRunning()).toThrow(/destroyed/)
  })

  it('skips zero duration and threshold-limited batches without callbacks', () => {
    const callback = vi.fn()
    const { chart } = create({ animationThreshold: 2, animation: { onComplete: callback } })
    expect(chart.animation.isRunning()).toBe(false)
    const zero = create({ animation: { duration: 0, delay: 100, onComplete: callback } }).chart
    expect(zero.animation.isRunning()).toBe(false)
    expect(callback).not.toHaveBeenCalled()
  })

  it('finishes categories independently and disables only the selected category', () => {
    const enter = vi.fn(),
      update = vi.fn()
    const { chart } = create({
      animation: { duration: 200, onComplete: enter },
      animationUpdate: { duration: 100, onComplete: update },
    })
    chart.animation.finish()
    enter.mockClear()
    chart.updateData([
      {
        id: 'series-0',
        data: [
          { x: 0, y: 2 },
          { x: 2, y: 3 },
        ],
      },
      {
        id: 'new',
        data: [
          { x: 0, y: 0 },
          { x: 2, y: 4 },
        ],
      },
    ])
    step(20)
    chart.updateOptions({ animationUpdate: { enabled: false } })
    expect(update).toHaveBeenCalledOnce()
    expect(enter).not.toHaveBeenCalled()
    expect(chart.animation.isRunning()).toBe(true)
    step(180)
    expect(enter).toHaveBeenCalledOnce()
    expect(update).toHaveBeenCalledOnce()
    expect(chart.animation.isRunning()).toBe(false)
  })

  it('synchronizes update data immediately when update duration is zero', () => {
    const { chart } = create({ animationUpdate: { duration: 0 } })
    chart.animation.finish()
    chart.updateData([
      { x: 0, y: 5 },
      { x: 1, y: 6 },
    ])
    expect(chart.animation.isRunning()).toBe(false)
    expect([...frames.keys()]).toHaveLength(0)
  })

  it('honors manual and hidden pause reasons independently', () => {
    const { chart } = create()
    step(20)
    chart.animation.pause()
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    chart.animation.resume()
    expect(frames.size).toBe(0)
    step(500)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))
    step(79)
    expect(chart.animation.isRunning()).toBe(true)
    step(1)
    expect(chart.animation.isRunning()).toBe(false)
  })

  it('lets an abort callback submit a newer target without old frames overwriting it', () => {
    const abort = vi.fn(() =>
      chart.update({ data: [{ x: 0, y: 9 }], options: { animationEnabled: false } }),
    )
    const chart: Waveform = create({ animation: { onAbort: abort } }).chart
    chart.updateData([
      { x: 0, y: 4 },
      { x: 1, y: 5 },
    ])
    expect(abort).toHaveBeenCalledOnce()
    expect(chart.animation.isRunning()).toBe(false)
    const result = chart.toSVGString()
    step(500)
    expect(chart.toSVGString()).toBe(result)
    expect(frames.size).toBe(0)
  })

  it('does not restart identical values or perform layout measurements in frames', () => {
    const { chart, host } = create()
    const measure = vi.spyOn(SVGElement.prototype, 'getBoundingClientRect')
    const before = [...frames.keys()]
    chart.updateData(data.map((point) => ({ ...point })))
    expect([...frames.keys()]).toEqual(before)
    step(30)
    step(30)
    expect(measure).not.toHaveBeenCalled()
    expect(host.querySelectorAll('svg')).toHaveLength(1)
  })

  it('uses static fallback without paired RAF and for reversed domains', () => {
    vi.spyOn(window, 'cancelAnimationFrame').mockRestore()
    const original = window.cancelAnimationFrame
    Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, value: undefined })
    const unavailable = create().chart
    expect(unavailable.animation.isRunning()).toBe(false)
    Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, value: original })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => {
      frames.delete(handle)
    })
    const { chart } = create()
    chart.animation.finish()
    chart.updateOptions({ xAxis: { min: 2, max: -1 } })
    expect(chart.animation.isRunning()).toBe(false)
  })

  it('transitions explicit domain changes and reuses the exact target tick layout', () => {
    const { chart } = create({ yAxes: [{ id: 'left', tickStrategy: 'nice' }] })
    chart.animation.finish()
    chart.updateOptions({ yAxes: [{ id: 'left', min: -1.3, max: 8.7 }] })
    expect(chart.animation.isRunning()).toBe(true)
    step(100)
    const animated = chart.toSVGString()
    chart.render()
    expect(chart.toSVGString()).toBe(animated)
  })

  it('restores a leaving series at its current opacity and keeps layers bounded', () => {
    const { chart, host } = create()
    const a = {
      id: 'a',
      data: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    }
    const b = {
      id: 'b',
      data: [
        { x: 0, y: 1 },
        { x: 1, y: 0 },
      ],
    }
    chart.updateData([a, b])
    chart.animation.finish()
    chart.updateData([a])
    step(50)
    const opacity = [...host.querySelectorAll('g[opacity]')].map((node) =>
      node.getAttribute('opacity'),
    )
    expect(opacity).toContain('0.5')
    chart.updateData([b, a])
    expect(
      [...host.querySelectorAll('g[opacity]')].map((node) => node.getAttribute('opacity')),
    ).toContain('0.5')
    step(100)
    expect(host.querySelectorAll('g[clip-path] > g[opacity]')).toHaveLength(0)
    expect(frames.size).toBe(0)
  })

  it('crossfades ambiguous points but falls back for ambiguous series identities', () => {
    const { chart, host } = create()
    chart.animation.finish()
    chart.updateData([
      { x: 0, y: 0 },
      { x: 0, y: 3 },
      { x: 1, y: 1 },
    ])
    expect(chart.animation.isRunning()).toBe(true)
    step(50)
    expect(host.querySelectorAll('g[opacity="0.5"]')).toHaveLength(2)
    chart.updateData([{ data }, { id: 'named', data }])
    expect(chart.animation.isRunning()).toBe(false)
    expect(host.querySelectorAll('g[clip-path] > g[opacity]')).toHaveLength(0)
  })

  it('clears empty data immediately and snapshots caller points through finish', () => {
    const { chart, host } = create()
    chart.animation.finish()
    const next = [
      { id: 'p', x: 0, y: 2 },
      { id: 'q', x: 1, y: 4 },
    ]
    chart.updateData(next)
    next[0].y = 200
    const snapshot = chart.toSVGString()
    chart.updateData(next)
    expect(chart.toSVGString()).not.toBe(snapshot)
    chart.updateData([])
    expect(host.textContent).toContain('No waveform data')
    expect(frames.size).toBe(0)
  })

  it('suppresses deferred export callbacks after destroy and tolerates recursive export', async () => {
    const complete = vi.fn()
    const { chart } = create({ animation: { onComplete: complete } })
    chart.toSVGString()
    chart.destroy()
    await Promise.resolve()
    expect(complete).not.toHaveBeenCalled()
    const recursive = vi.fn(() => {
      expect(other.toSVGString()).toContain('<svg')
      other.animation.finish()
    })
    const other: Waveform = create({ animation: { onComplete: recursive } }).chart
    other.animation.finish()
    expect(recursive).toHaveBeenCalledOnce()
  })

  it('recovers from easing failure and never completes a failed final draw', async () => {
    const report = vi.fn()
    vi.stubGlobal('reportError', report)
    const abort = vi.fn(),
      complete = vi.fn()
    const { chart } = create({
      animation: { duration: 100, easing: () => NaN, onAbort: abort, onComplete: complete },
    })
    step(50)
    await Promise.resolve()
    expect(abort).toHaveBeenCalledOnce()
    expect(complete).not.toHaveBeenCalled()
    expect(report).toHaveBeenCalledOnce()
    expect(frames.size).toBe(0)
    chart.update({
      data: [{ x: 0, y: 2 }],
      options: { animationUpdate: { onAbort: abort, onComplete: complete } },
    })
    vi.spyOn(SvgRenderer.prototype, 'draw').mockImplementationOnce(() => {
      throw new Error('draw failure')
    })
    chart.animation.finish()
    await Promise.resolve()
    expect(abort).toHaveBeenCalledTimes(2)
    expect(complete).not.toHaveBeenCalled()
    expect(chart.animation.isRunning()).toBe(false)
    chart.updateData(data)
    chart.animation.finish()
    expect(chart.toSVGString()).toContain('<svg')
  })

  it('finishes on reduced-motion changes and removes its environment listener', () => {
    const listeners = new Set<() => void>()
    const media = {
      matches: false,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    }
    vi.stubGlobal('matchMedia', () => media)
    const { chart } = create()
    expect(chart.animation.isRunning()).toBe(true)
    media.matches = true
    listeners.forEach((fn) => fn())
    expect(chart.animation.isRunning()).toBe(false)
    chart.updateData([{ x: 0, y: 8 }])
    expect(chart.animation.isRunning()).toBe(false)
    chart.destroy()
    expect(listeners.size).toBe(0)
  })

  it('enforces the retained buffer budget even when the public threshold is raised', () => {
    const { chart } = create({ animationThreshold: 100000 })
    chart.animation.finish()
    chart.updateData(Array.from({ length: 20001 }, (_, x) => ({ x, y: Math.sin(x) })))
    expect(chart.animation.isRunning()).toBe(false)
    chart.updateData([{ x: 0, y: 0 }])
    expect(chart.animation.isRunning()).toBe(false)
    expect(frames.size).toBe(0)
  })

  it('finishes styles and tick changes without replay and skips identical options', () => {
    const { chart } = create()
    const handles = [...frames.keys()]
    chart.updateOptions({ animationEnabled: true })
    expect([...frames.keys()]).toEqual(handles)
    chart.updateOptions({ xAxis: { tickStrategy: 'nice' } })
    expect(chart.animation.isRunning()).toBe(false)
    chart.updateData([{ id: 'series-0', data, style: { color: 'red' } }])
    expect(chart.animation.isRunning()).toBe(false)
  })

  it('ignores the observer initial notification but converges after a real resize', () => {
    let callback: () => void = () => {}
    const observe = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(fn: () => void) {
          callback = fn
        }
        observe = observe
        disconnect() {}
      },
    )
    const { chart, host } = create({ responsive: { enabled: true } })
    callback()
    expect(chart.animation.isRunning()).toBe(true)
    chart.update({
      data: [
        { x: 0, y: 1 },
        { x: 1, y: 3 },
      ],
      options: { animationUpdate: { duration: 500 } },
    })
    expect(observe).toHaveBeenCalledOnce()
    expect(chart.animation.isRunning()).toBe(true)
    Object.defineProperty(host, 'clientWidth', { value: 900, configurable: true })
    callback()
    expect(chart.animation.isRunning()).toBe(false)
  })

  it('drops remaining old category notifications when the first abort submits a third target', () => {
    const updateAbort = vi.fn()
    let reenter = false
    const enterAbort = vi.fn(() => {
      if (reenter) chart.update({ data: [{ x: 0, y: 9 }], options: { animationEnabled: false } })
    })
    const chart: Waveform = create({
      animation: { duration: 200, onAbort: enterAbort },
      animationUpdate: { duration: 200, onAbort: updateAbort },
    }).chart
    chart.animation.finish()
    chart.updateData([
      { id: 'series-0', data },
      { id: 'new', data },
    ])
    step(20)
    reenter = true
    chart.updateData([{ id: 'series-0', data: [{ x: 0, y: 2 }] }])
    expect(enterAbort).toHaveBeenCalledOnce()
    // The obsolete version's update callback is discarded; the newer batch may abort once.
    expect(updateAbort).toHaveBeenCalledTimes(1)
    expect(chart.animation.isRunning()).toBe(false)
    expect(frames.size).toBe(0)
  })

  it('cleans foreign-window RAF and document subscriptions without using the parent clock', () => {
    const iframe = document.createElement('iframe')
    document.body.append(iframe)
    const realm = iframe.contentWindow!
    const pending = new Map<number, FrameRequestCallback>()
    let serial = 0
    Object.defineProperty(realm, 'requestAnimationFrame', {
      configurable: true,
      value: (fn: FrameRequestCallback) => {
        pending.set(++serial, fn)
        return serial
      },
    })
    Object.defineProperty(realm, 'cancelAnimationFrame', {
      configurable: true,
      value: (id: number) => pending.delete(id),
    })
    Object.defineProperty(realm.document, 'hidden', { configurable: true, value: false })
    const remove = vi.spyOn(realm.document, 'removeEventListener')
    const host = realm.document.createElement('div')
    realm.document.body.append(host)
    const chart = new Waveform(host, data, {
      animationEnabled: true,
      responsive: { enabled: false },
    })
    charts.push(chart)
    expect(pending.size).toBe(1)
    expect(frames.size).toBe(0)
    chart.destroy()
    expect(pending.size).toBe(0)
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })

  it('uses one numerical domain for geometry, grids and ticks without re-expanding nice frames', () => {
    const draw = vi.spyOn(SvgRenderer.prototype, 'draw')
    const { chart } = create({
      yAxes: [{ id: 'left', tickStrategy: 'nice', tickCount: 5 }],
      point: { visible: true },
    })
    chart.animation.finish()
    const previous = draw.mock.lastCall![0]
    chart.updateData([
      { x: 0, y: 1.3 },
      { x: 2, y: 8.7 },
    ])
    step(50)
    const middle = draw.mock.lastCall![0]
    expect(middle.x.domain()).toEqual(middle.xDomain)
    expect(middle.primaryYAxis.scale.domain()).toEqual(middle.primaryYAxis.domain)
    expect(middle.primaryYAxis.ticks.domain).toEqual(middle.primaryYAxis.domain)
    const targetDomain = [0, 10]
    expect(middle.primaryYAxis.domain).toEqual(
      previous.primaryYAxis.domain.map((value, index) => (value + targetDomain[index]) / 2),
    )
    expect(
      middle.primaryYAxis.ticks.majorValues.every(
        (value) => value >= middle.primaryYAxis.domain[0] && value <= middle.primaryYAxis.domain[1],
      ),
    ).toBe(true)
    step(50)
    const target = draw.mock.lastCall![0]
    chart.render()
    expect(draw.mock.lastCall![0].primaryYAxis.ticks).toEqual(target.primaryYAxis.ticks)
  })

  it('keeps sliding geometry, ticks, grids and zero line on the same interpolated scales', () => {
    const draw = vi.spyOn(SvgRenderer.prototype, 'draw')
    const { chart, host } = create({
      point: { visible: true },
      zeroLine: { visible: true, boundaryThreshold: 0 },
    })
    const previous = [
      {
        id: 'series-0',
        data: [
          { id: 'a', x: 0, y: -2 },
          { id: 'b', x: 1, y: 2 },
          { id: 'c', x: 2, y: 0 },
        ],
      },
    ]
    chart.updateData(previous)
    chart.animation.finish()
    chart.updateData([
      {
        id: 'series-0',
        data: [
          { id: 'b', x: 1, y: 4 },
          { id: 'c', x: 2, y: -4 },
          { id: 'd', x: 3, y: 1 },
        ],
      },
    ])
    expect(chart.animation.isRunning()).toBe(true)
    for (const progress of [0.25, 0.5, 0.75, 1]) {
      step(25)
      const context = draw.mock.lastCall![0]
      expect(context.xDomain).toEqual([progress, 2 + progress])
      expect(context.primaryYAxis.domain).toEqual([-2 - 2 * progress, 2 + 2 * progress])
      expect(context.series[0].data.map((point) => point.id)).toEqual(['b', 'c', 'd'])
      expect(context.series[0].data[0].y).toBe(2 + 2 * progress)
      for (const selector of [
        '.waveform-grid-x .tick',
        '.waveform-axis-x .tick',
        '.waveform-grid-y .tick',
        '.waveform-axis-y--left .tick',
      ]) {
        const nodes = [...host.querySelectorAll(selector)]
        expect(nodes.length).toBeGreaterThan(0)
        for (const node of nodes) {
          const value = (node as Element & { __data__: number }).__data__
          const xAxis = selector.includes('-x')
          const position = (xAxis ? context.x(value) : context.primaryYAxis.scale(value)) + 0.5
          expect(node.getAttribute('transform')).toBe(
            xAxis ? `translate(${position},0)` : `translate(0,${position})`,
          )
        }
      }
      expect(Number(host.querySelector('.waveform-zero-line')?.getAttribute('y1'))).toBeCloseTo(
        context.innerHeight / 2,
      )
      const symbol = host.querySelector('g[clip-path] > g path[transform]')
      expect(symbol).not.toBeNull()
      expect(symbol?.getAttribute('transform')).toBe(
        `translate(${context.x(1)},${context.primaryYAxis.scale(2 + 2 * progress)})`,
      )
    }
    expect(chart.animation.isRunning()).toBe(false)
    expect(frames.size).toBe(0)
  })

  it('staggered entries wait for their own delays and use update duration only for shared domains', () => {
    const draw = vi.spyOn(SvgRenderer.prototype, 'draw')
    const enter = vi.fn(),
      update = vi.fn()
    const { chart } = create({
      animation: {
        duration: 200,
        delay: 50,
        staggerDelay: 50,
        easing: 'linear',
        onComplete: enter,
      },
      animationUpdate: { duration: 100, easing: 'linear', onComplete: update },
    })
    chart.animation.finish()
    enter.mockClear()
    chart.updateData([
      {
        id: 'series-0',
        data: [
          { x: 0, y: 0 },
          { x: 2, y: 4 },
        ],
      },
      { id: 'a', data },
      { id: 'b', data },
    ])
    step(75)
    const frame = draw.mock.lastCall![0]
    expect(frame.seriesEffects?.[1].clip?.width).toBe(frame.innerWidth * 0.125)
    expect(frame.seriesEffects?.[2].clip?.width).toBe(0)
    step(25)
    expect(update).toHaveBeenCalledOnce()
    expect(enter).not.toHaveBeenCalled()
    step(200)
    expect(enter).toHaveBeenCalledOnce()
    expect(chart.animation.isRunning()).toBe(false)
  })

  it('can enter new series with updates disabled and skips layout, axis or extreme-displacement changes', () => {
    const { chart } = create({ animationUpdate: { enabled: false } })
    chart.animation.finish()
    chart.updateData([
      { id: 'series-0', data },
      { id: 'new', data: [{ x: 0, y: 3 }] },
    ])
    expect(chart.animation.isRunning()).toBe(true)
    chart.animation.finish()
    chart.update({
      data: [{ id: 'series-0', data: [{ x: 0, y: 4 }] }],
      options: { padding: { left: 100 } },
    })
    expect(chart.animation.isRunning()).toBe(false)
    chart.update({
      data: [{ id: 'series-0', yAxis: 'other', data }],
      options: { yAxes: [{ id: 'other' }] },
    })
    expect(chart.animation.isRunning()).toBe(false)
    chart.updateOptions({
      animationUpdate: { enabled: true },
      yAxes: [{ id: 'other', min: 0, max: 1 }],
    })
    chart.animation.finish()
    chart.updateData([
      {
        id: 'series-0',
        yAxis: 'other',
        data: [
          { x: 0, y: 1000 },
          { x: 1, y: 1001 },
        ],
      },
    ])
    expect(chart.animation.isRunning()).toBe(false)
  })

  it('drops the second completion when the first callback destroys the chart', () => {
    const update = vi.fn()
    let shouldDestroy = false
    const chart: Waveform = create({
      animation: {
        duration: 100,
        onComplete: () => {
          if (shouldDestroy) chart.destroy()
        },
      },
      animationUpdate: { duration: 100, onComplete: update },
    }).chart
    chart.animation.finish()
    chart.updateData([
      { id: 'series-0', data },
      { id: 'new', data },
    ])
    shouldDestroy = true
    step(100)
    expect(update).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)
  })

  it('initiates downloads before completion callbacks and permits callback replacement of data', async () => {
    const order: string[] = []
    vi.stubGlobal('URL', {
      createObjectURL: () => {
        order.push('blob')
        return 'blob:test'
      },
      revokeObjectURL: () => order.push('revoke'),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      order.push('download')
    })
    const chart: Waveform = create({
      animation: {
        onComplete: () => {
          order.push('complete')
          chart.updateData([{ x: 0, y: 8 }])
        },
      },
    }).chart
    chart.downloadSVG()
    expect(order).toEqual(['blob', 'download', 'revoke'])
    await Promise.resolve()
    expect(order).toEqual(['blob', 'download', 'revoke', 'complete'])
    chart.animation.finish()
  })
})
