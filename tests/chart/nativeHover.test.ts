import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { init } from '@/chart/init'
import type { WaveformChartOptions } from '@/types/options'
import type { WaveformPoint } from '@/types/chart'
import { mountLegacySizedChart as mountSizedChart } from '../support/waveformChart'
import { flushNativeUpdates } from '../support/nativeChart'
import { flushAnimationFrames, pendingAnimationFrameCount, resizeObservers } from '../support/setup'

const cleanup: Array<() => void> = []
afterEach(() => {
  cleanup.splice(0).forEach((dispose) => dispose())
  vi.restoreAllMocks()
})
const data = {
  kind: 'series' as const,
  series: [
    {
      id: 'a',
      name: '完整',
      shotNo: '炮 7',
      unit: 'A',
      data: {
        kind: 'points' as const,
        points: [
          { x: -1, y: 1 },
          { x: 0, y: 2 },
          { x: 1, y: 3 },
        ],
      },
    },
    {
      id: 'b',
      name: '短曲线',
      data: {
        kind: 'points' as const,
        points: [
          { x: 0, y: 10 },
          { x: 1, y: 20 },
        ],
      },
    },
  ],
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
      timeUnit: 's',
      xDomainStrategy: { type: 'data' },
      rendering: { sampling: { mode: 'raw' } },
      ...options,
    },
    { autoResize: false },
  )
  cleanup.push(() => {
    chart.dispose()
    host.remove()
  })
  await flushNativeUpdates()
  return { host, chart }
}
function target(root: Element, index = 0) {
  const node = root.querySelectorAll<SVGRectElement>('.waveform-chart__overlay')[index]!
  Object.defineProperty(node, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ left: 0, top: 0 }),
  })
  return node
}
function move(node: SVGRectElement, ratio = 0.25, type = 'pointermove', pointerType = 'mouse') {
  const event = new MouseEvent(type, {
    clientX: Number(node.getAttribute('width')) * ratio,
    clientY: Number(node.getAttribute('height')) / 2,
    bubbles: true,
    cancelable: true,
  })
  Object.defineProperties(event, { pointerId: { value: 7 }, pointerType: { value: pointerType } })
  node.dispatchEvent(event)
}
function values(root: Element) {
  return [...root.querySelectorAll('.waveform-tooltip__value')].map((item) => item.textContent)
}

describe('native hover', () => {
  it.each(['independent', 'separated', 'compact'] as const)(
    'matches Vue endpoint queries, tooltip rows and crosshairs in %s',
    async (displayMode) => {
      const options = {
        displayMode,
        initialXDomain: [-1, 1] as [number, number],
        timeUnit: 'ms' as const,
      }
      const { host, chart } = await native(options)
      const wrapper = await mountSizedChart(data, {
        ...options,
        width: 800,
        height: 360,
        animationEnabled: false,
        xDomainStrategy: { type: 'data' },
        rendering: { sampling: { mode: 'raw' } },
      })
      cleanup.push(() => wrapper.unmount())
      const points: Array<WaveformPoint | null> = []
      chart.on('point-hover', (point) => points.push(point))
      move(target(host))
      move(target(wrapper.element))
      flushAnimationFrames()
      await flushPromises()
      expect(points.at(-1)).toEqual(wrapper.emitted('point-hover')!.at(-1)![0])
      expect(values(host)).toEqual(values(wrapper.element))
      const nativeLines = [...host.querySelectorAll('.waveform-chart__crosshair')]
      const vueLines = [...wrapper.element.querySelectorAll('.waveform-chart__crosshair line')]
      expect(nativeLines).toHaveLength(vueLines.length)
      nativeLines.forEach((line, index) => {
        expect(Number(line.getAttribute('x1'))).toBeCloseTo(
          Number(vueLines[index].getAttribute('x1')),
          10,
        )
      })
      expect(values(host)).toHaveLength(displayMode === 'independent' ? 1 : 2)
      move(target(host), 0.25, 'pointerout')
      expect(host.querySelector('.waveform-tooltip')).toBeNull()
      expect(host.querySelector('.waveform-chart__crosshair')).toBeNull()
      expect(points.at(-1)).toBeNull()
    },
  )

  it('coalesces moves, keeps event seconds and creates no finished/rendered cycle', async () => {
    const { host, chart } = await native({ timeUnit: 'ms' })
    const points: Array<WaveformPoint | null> = []
    const finished = vi.fn(),
      rendered = vi.fn()
    chart.on('point-hover', (point) => points.push(point))
    chart.on('finished', finished)
    chart.on('rendered', rendered)
    const overlay = target(host)
    move(overlay, 0)
    move(overlay, 0.5)
    move(overlay, 1)
    expect(pendingAnimationFrameCount()).toBe(1)
    expect(points).toEqual([])
    await flushNativeUpdates()
    expect(points).toEqual([{ x: 1, y: 3 }])
    expect(values(host)).toEqual(['(x:1,000 y:3)'])
    expect(finished).not.toHaveBeenCalled()
    expect(rendered).not.toHaveBeenCalled()
  })

  it('uses full typed sources when the nearest point is absent from sampled SVG geometry', async () => {
    const x = Float64Array.from({ length: 10001 }, (_, index) => index / 1000)
    const y = Float64Array.from(x, (value) => Math.sin(value))
    const { host, chart } = await native({
      data: { kind: 'typed-points', x, y },
      initialXDomain: [0, 10],
      rendering: {
        sampling: { mode: 'auto', strategy: 'average', maxPointCount: 20, autoThreshold: 1 },
      },
    })
    const point = vi.fn()
    chart.on('point-hover', point)
    move(target(host), 0.5432)
    await flushNativeUpdates()
    expect(point).toHaveBeenLastCalledWith({ x: x[5432], y: y[5432] })
    const path = host.querySelector('.waveform-chart__line')!.getAttribute('d')!
    const vertices = [...path.matchAll(/[ML](-?\d+(?:\.\d+)?),/g)].map((match) => Number(match[1]))
    expect(vertices.length).toBeGreaterThan(0)
    expect(vertices.length).toBeLessThan(50)
    const rawPixel = Number((Number(target(host).getAttribute('width')) * 0.5432).toFixed(3))
    expect(vertices).not.toContain(rawPixel)
    expect(values(host)[0]).toContain('x:5.432')
    // Event snapshots cannot mutate the private normalized source or the consumer's typed arrays.
    point.mock.calls.at(-1)![0].y = 999
    move(target(host), 0.5432)
    await flushNativeUpdates()
    expect(point.mock.calls.at(-1)![0].y).toBe(y[5432])
  })

  it('keeps querying when showTooltip is false but disables hover in presentation mode', async () => {
    const { host, chart } = await native({ showTooltip: false })
    const point = vi.fn()
    chart.on('point-hover', point)
    move(target(host), 0.5)
    await flushNativeUpdates()
    expect(point).toHaveBeenLastCalledWith({ x: 0, y: 2 })
    expect(host.querySelector('.waveform-tooltip')).toBeNull()
    expect(host.querySelector('.waveform-chart__crosshair')).toBeNull()
    chart.setOption({ showTooltip: true })
    await flushNativeUpdates()
    expect(host.querySelector('.waveform-tooltip')).not.toBeNull()
    expect(host.querySelector('.waveform-chart__crosshair')).not.toBeNull()
    chart.setOption({ presentationMode: true })
    await flushNativeUpdates()
    point.mockClear()
    move(target(host))
    await flushNativeUpdates()
    expect(point).not.toHaveBeenCalled()
  })

  it('excludes hidden series and scopes independent overlays to their current track', async () => {
    const { host, chart } = await native({ displayMode: 'independent' })
    move(target(host, 1), 0.5)
    await flushNativeUpdates()
    expect(values(host)).toEqual(['(x:1 y:20)'])
    chart.setOption({ hiddenSeriesIds: ['b'], displayMode: 'separated' })
    await flushNativeUpdates()
    move(target(host), 0.5)
    await flushNativeUpdates()
    expect(values(host)).toEqual(['(x:0 y:2)'])
    expect(host.querySelector('.waveform-tooltip')!.textContent).not.toContain('短曲线')
  })

  it.each(['data', 'mode', 'page', 'size', 'dispose'] as const)(
    'cancels pending hover on %s with no late point event',
    async (change) => {
      const { host, chart } = await native({ grid: { rowCount: 1, columnCount: 1 } })
      const point = vi.fn()
      chart.on('point-hover', point)
      move(target(host))
      if (change === 'data')
        chart.setOption({ data: { kind: 'points', points: [{ x: 10, y: 50 }] } })
      if (change === 'mode') chart.setInteractionMode('pan')
      if (change === 'page') host.querySelector<HTMLButtonElement>('[aria-label="下一页"]')!.click()
      if (change === 'size') chart.setOption({ width: 400 })
      if (change === 'dispose') chart.dispose()
      await flushNativeUpdates()
      expect(point.mock.calls.every(([value]) => value === null)).toBe(true)
      expect(host.querySelector('.waveform-tooltip')).toBeNull()
    },
  )

  it('blocks hover while dragging and clears it on touch cancellation', async () => {
    const { host, chart } = await native()
    const point = vi.fn()
    chart.on('point-hover', point)
    const overlay = target(host)
    move(overlay, 0.5, 'pointermove', 'touch')
    await flushNativeUpdates()
    expect(values(host)).toEqual(['(x:0 y:2)'])
    move(overlay, 0.5, 'pointercancel', 'touch')
    expect(host.querySelector('.waveform-tooltip')).toBeNull()
    move(overlay, 0.2, 'pointerdown')
    point.mockClear()
    move(overlay, 0.5)
    await flushNativeUpdates()
    expect(point).not.toHaveBeenCalled()
    move(overlay, 0.5, 'pointercancel')
    move(overlay, 0.5)
    await flushNativeUpdates()
    expect(point).toHaveBeenLastCalledWith({ x: 0, y: 2 })
  })

  it('removes hover immediately when a point callback replaces data or disposes', async () => {
    const { host, chart } = await native()
    const cancel = chart.on('point-hover', (point) => {
      if (point) chart.setOption({ data: { kind: 'points', points: [{ x: 0, y: 90 }] } })
    })
    move(target(host), 0.5)
    await flushNativeUpdates()
    expect(host.querySelector('.waveform-tooltip')).toBeNull()
    cancel()
    chart.on('point-hover', (point) => {
      if (point) chart.dispose()
    })
    move(target(host), 0.5)
    await flushNativeUpdates()
    expect(chart.isDisposed()).toBe(true)
    expect(host.children).toHaveLength(0)
  })

  it('measures, flips, clamps, remeasures and disconnects the native tooltip', async () => {
    let width = 238,
      height = 40
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return {
        width: Math.min(width, Number.parseFloat(this.style.maxWidth) || width),
        height,
      } as DOMRect
    })
    const { host, chart } = await native({ width: 400, height: 300 })
    move(target(host), 0.95)
    await flushNativeUpdates()
    const tooltip = host.querySelector<HTMLElement>('.waveform-tooltip')!
    expect(tooltip.style.right).not.toBe('')
    expect(tooltip.style.maxWidth).toBe('384px')
    const observer = resizeObservers.at(-1)!
    width = 500
    height = 280
    observer.resize(width, height)
    expect(tooltip.style.left).toBe('8px')
    expect(tooltip.style.right).toBe('')
    expect(tooltip.style.top).toBe('12px')
    chart.dispose()
    expect(observer.disconnect).toHaveBeenCalledOnce()
    observer.resize(100, 20)
    expect(host.children).toHaveLength(0)
  })

  it('renders consumer labels as text and supports absent ResizeObserver', async () => {
    const { host } = await native({
      data: {
        kind: 'series',
        series: [
          {
            id: 'x',
            name: '<img src=x onerror=alert(1)>',
            data: { kind: 'points', points: [{ x: 0, y: 1 }] },
          },
        ],
      },
    })
    const descriptor = Object.getOwnPropertyDescriptor(window, 'ResizeObserver')!
    Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: undefined })
    try {
      move(target(host), 0.5)
      await flushNativeUpdates()
      expect(host.querySelector('.waveform-tooltip')!.textContent).toContain('<img src=x')
      expect(host.querySelector('img')).toBeNull()
    } finally {
      Object.defineProperty(window, 'ResizeObserver', descriptor)
    }
  })

  it('clips a remote crosshair outside the viewport instead of moving it to the plot edge', async () => {
    const { host, chart } = await native({ initialXDomain: [0, 1], panXDomain: [-10, 10] })
    chart.setViewportDomain([5, 6])
    await flushNativeUpdates()
    move(target(host), 0.5)
    await flushNativeUpdates()
    expect(values(host)).toEqual(['(x:1 y:3)'])
    const line = host.querySelector<SVGLineElement>('.waveform-chart__crosshair')!
    expect(Number(line.getAttribute('x1'))).toBeLessThan(0)
    const clipId = line.getAttribute('clip-path')!.slice(5, -1)
    const clip = host.querySelector(`#${clipId} rect`)!
    expect(Number(clip.getAttribute('width'))).toBeGreaterThan(0)
    expect(clip.parentElement!.localName).toBe('clipPath')
  })

  it('preserves missing rows without inventing points and isolates simultaneous instances', async () => {
    const a = await native({
      displayMode: 'separated',
      panXDomain: [-10, 10],
      data: {
        kind: 'series',
        series: [
          data.series[0],
          { id: 'empty', name: '等待加载', data: { kind: 'points', points: [] } },
        ],
      },
    })
    const b = await native()
    move(target(a.host), 0.5)
    move(target(b.host), 0.95)
    await flushNativeUpdates()
    expect(values(a.host)).toEqual(['(x:0 y:2)', '无数据'])
    expect(values(b.host)).toEqual(['(x:1 y:3)'])
    const ids = [a.host, b.host].flatMap((host) =>
      [...host.querySelectorAll('clipPath')].map((node) => node.id),
    )
    expect(new Set(ids).size).toBe(ids.length)
    a.chart.dispose()
    expect(values(b.host)).toEqual(['(x:1 y:3)'])
  })

  it('stabilizes an active entrance before hover and finishes the existing revision once', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const host = document.createElement('div')
    document.body.append(host)
    Object.defineProperty(host, 'getClientRects', { value: () => [{}] })
    const chart = init(
      host,
      {
        data: data.series[0].data,
        width: 800,
        height: 360,
        animation: { duration: 1000, easing: 'linear' },
        rendering: { sampling: { mode: 'raw' } },
      },
      { autoResize: false },
    )
    cleanup.push(() => {
      chart.dispose()
      host.remove()
    })
    const finished = vi.fn()
    chart.on('finished', finished)
    for (let index = 0; index < 4; index++) {
      flushAnimationFrames(0)
      await Promise.resolve()
    }
    expect(host.querySelector('.waveform-chart__series clipPath rect')!.getAttribute('width')).toBe(
      '0',
    )
    expect(finished).not.toHaveBeenCalled()
    move(target(host), 0.5)
    await flushNativeUpdates()
    expect(host.querySelector('.waveform-chart__series clipPath')).toBeNull()
    expect(finished).toHaveBeenCalledOnce()
    move(target(host), 0.75)
    await flushNativeUpdates()
    expect(finished).toHaveBeenCalledOnce()
  })
})
