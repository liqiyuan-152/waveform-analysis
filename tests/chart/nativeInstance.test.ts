import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushNativeUpdates } from '../support/nativeChart'
import { init, dispose, getInstanceByDom } from '@/chart/init'
import type { WaveformChartInstance } from '@/types/native'
import type { WaveformChartOptionUpdate } from '@/types/options'
import { flushAnimationFrames, pendingAnimationFrameCount, resizeObservers } from '../support/setup'
import { ChartLayoutEngine } from '@/layout/ChartLayoutEngine'

const charts: WaveformChartInstance[] = []
afterEach(() => {
  charts.forEach((chart) => chart.dispose())
  charts.length = 0
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

function container(width = 800, height = 400) {
  const host = document.createElement('div')
  document.body.append(host)
  const rect = { width, height } as DOMRect
  vi.spyOn(host, 'getBoundingClientRect').mockImplementation(() => rect)
  vi.spyOn(host, 'getClientRects').mockImplementation(() =>
    width > 0 ? ([rect] as unknown as DOMRectList) : ([] as unknown as DOMRectList),
  )
  return { host, rect }
}

function create(
  host: HTMLElement,
  options: Parameters<typeof init>[1] = {},
  initOptions?: Parameters<typeof init>[2],
) {
  const chart = init(host, { animationEnabled: false, ...options }, initOptions)
  charts.push(chart)
  return chart
}

const data = {
  kind: 'points' as const,
  points: [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 0 },
  ],
}

describe('native DOM instance lifecycle', () => {
  it('defers line geometry during data rebind and synchronous control queries', async () => {
    const { host } = container()
    const chart = create(host, { data, rendering: { sampling: { mode: 'raw' } } })
    await flushNativeUpdates()
    const before = host.querySelector('.waveform-chart__line')!.getAttribute('d')
    const calculate = vi.spyOn(ChartLayoutEngine.prototype, 'calculate')
    chart.setOption({
      data: {
        kind: 'points',
        points: [
          { x: 5, y: 0 },
          { x: 6, y: 3 },
          { x: 7, y: 1 },
        ],
      },
    })
    expect(chart.getControlState().targets[0]!.viewport.xDomain).toEqual([5, 7])
    expect(calculate).toHaveBeenCalled()
    expect(calculate.mock.calls.every((args) => args[4] === false)).toBe(true)
    expect(host.querySelector('.waveform-chart__line')!.getAttribute('d')).toBe(before)
    await flushNativeUpdates()
    expect(calculate.mock.calls.some((args) => args[4] === true)).toBe(true)
    expect(host.querySelector('.waveform-chart__line')!.getAttribute('d')).not.toBe(before)
  })

  it('registers exactly one instance and duplicate init never applies options', () => {
    const { host } = container()
    const chart = create(host, { data })
    expect(init(host, { data: { kind: 'points', points: [] } })).toBe(chart)
    expect(getInstanceByDom(host)).toBe(chart)
    expect(host.querySelectorAll('.waveform-native-chart')).toHaveLength(1)
    expect(chart.getControlState().targets[0]?.viewport.xDomain).toEqual([0, 2])
    chart.dispose()
    expect(getInstanceByDom(host)).toBeUndefined()
    expect(create(host)).not.toBe(chart)
    expect(host.querySelectorAll('.waveform-native-chart')).toHaveLength(1)
  })

  it.each([
    null,
    'selector',
    {},
    { value: document.createElement('div') },
    document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
  ])('rejects a non-HTMLElement: %j', (value) => {
    expect(() => init(value as HTMLElement)).toThrow(
      expect.objectContaining({ code: 'invalid-container' }),
    )
  })

  it('accepts a container in another window and releases owner-document nodes', () => {
    const iframe = document.createElement('iframe')
    document.body.append(iframe)
    const host = iframe.contentDocument!.createElement('div')
    iframe.contentDocument!.body.append(host)
    const chart = create(host)
    expect(getInstanceByDom(host)).toBe(chart)
    expect(host.firstElementChild?.ownerDocument).toBe(iframe.contentDocument)
    chart.dispose()
    expect(host.childElementCount).toBe(0)
  })

  it('rolls back failed initialization and can subsequently create on the same DOM', () => {
    const { host } = container()
    expect(() => init(host, { data: undefined })).toThrow(
      expect.objectContaining({ field: 'data' }),
    )
    expect(host.childElementCount).toBe(0)
    expect(getInstanceByDom(host)).toBeUndefined()
    const append = vi.spyOn(host, 'append').mockImplementationOnce(() => {
      throw new Error('DOM failure')
    })
    expect(() => init(host, { data })).toThrow('DOM failure')
    expect(getInstanceByDom(host)).toBeUndefined()
    append.mockRestore()
    expect(create(host, { data }).isDisposed()).toBe(false)
  })

  it('preserves host children/styles, cancels frames and enforces disposed-call contracts', async () => {
    const { host } = container()
    host.style.cssText = 'position: absolute; width: 800px; height: 400px'
    const child = document.createElement('span')
    host.append(child)
    const chart = create(host, { data })
    const cancel = chart.on('rendered', vi.fn())
    expect(pendingAnimationFrameCount()).toBe(1)
    host.style.width = '900px'
    chart.dispose()
    chart.dispose()
    cancel()
    chart.off('rendered')
    dispose(host)
    expect(pendingAnimationFrameCount()).toBe(0)
    expect(host.children).toHaveLength(1)
    expect(host.firstChild).toBe(child)
    expect(host.style.width).toBe('900px')
    expect(resizeObservers[0]?.disconnect).toHaveBeenCalledOnce()
    expect(() => chart.setOption({ lineColor: 'red' })).toThrow(
      expect.objectContaining({ code: 'instance-disposed' }),
    )
    expect(() => chart.zoomIn()).toThrow(expect.objectContaining({ code: 'instance-disposed' }))
    expect(() => chart.getControlState()).toThrow(
      expect.objectContaining({ code: 'instance-disposed' }),
    )
    expect(() => chart.on('rendered', vi.fn())).toThrow(
      expect.objectContaining({ code: 'instance-disposed' }),
    )
    await expect(chart.exportImage()).rejects.toMatchObject({ code: 'export-cancelled' })
  })

  it('merges DOM work while synchronously using latest data in commands', async () => {
    const { host } = container()
    const chart = create(host, { data, xDomainStrategy: { type: 'data' } })
    const finished = vi.fn()
    chart.on('finished', finished)
    chart.setOption({
      data: {
        kind: 'points',
        points: [
          { x: 10, y: 3 },
          { x: 20, y: 4 },
        ],
      },
    })
    chart.setViewportDomain([12, 14])
    expect(chart.getControlState().targets[0]?.viewport.xDomain).toEqual([12, 14])
    expect(pendingAnimationFrameCount()).toBe(1)
    flushAnimationFrames()
    expect(host.querySelector('path.waveform-chart__line')?.getAttribute('d')).toBeTruthy()
    expect(finished).not.toHaveBeenCalled()
    await flushNativeUpdates()
    expect(finished).toHaveBeenCalledOnce()
    chart.setOption({ lineColor: '#0960bd' })
    expect(pendingAnimationFrameCount()).toBe(0)
    const before = chart.getControlState()
    expect(() =>
      chart.setOption({
        data: { kind: 'unknown' },
        height: 500,
      } as unknown as WaveformChartOptionUpdate),
    ).toThrow()
    expect(chart.getControlState()).toEqual(before)
  })

  it('reuses stable track/series nodes and keeps clipping references unique across instances', () => {
    const { host } = container()
    const other = container().host
    const chart = create(host, { data })
    create(other, { data })
    flushAnimationFrames()
    const svg = host.querySelector('svg')
    const track = host.querySelector('[data-track-id="series-0"]')
    const line = host.querySelector('.waveform-chart__line')
    chart.setOption({ lineColor: 'red' })
    flushAnimationFrames()
    expect(host.querySelector('svg')).toBe(svg)
    expect(host.querySelector('[data-track-id="series-0"]')).toBe(track)
    expect(host.querySelector('.waveform-chart__line')).toBe(line)
    expect(line?.getAttribute('stroke')).toBe('red')
    expect(host.querySelector('clipPath')?.id).not.toBe(other.querySelector('clipPath')?.id)
    chart.dispose()
    expect(other.querySelector('.waveform-chart__line')).not.toBeNull()
  })

  it('keeps controlled visibility until the host responds, with stable event snapshots', () => {
    const { host } = container()
    const seriesData = {
      kind: 'series' as const,
      series: ['a', 'b'].map((id) => ({
        id,
        trackId: 't',
        name: id,
        data,
      })),
    }
    const chart = create(host, {
      data: seriesData,
      hiddenSeriesIds: [],
      legend: { interactive: true },
      grid: { rowCount: 1, columnCount: 1 },
    })
    flushAnimationFrames()
    const requests: string[][] = []
    const changes: unknown[] = []
    chart.on('update:hidden-series-ids', (ids) => {
      requests.push([...ids])
      ids.push('mutated')
    })
    chart.on('series-visibility-change', (payload) => changes.push(payload))
    const button = host.querySelector<HTMLButtonElement>('.waveform-chart__legend-item')!
    button.click()
    flushAnimationFrames()
    expect(requests).toEqual([['a']])
    expect(changes).toEqual([{ seriesId: 'a', visible: false, hiddenSeriesIds: ['a'] }])
    expect(button.getAttribute('aria-pressed')).toBe('true')
    chart.setOption({ hiddenSeriesIds: ['a'] })
    flushAnimationFrames()
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(host.querySelector('.waveform-chart__series[data-series-id="a"]')).toBeNull()
    chart.setOption({ hiddenSeriesIds: undefined })
    flushAnimationFrames()
    expect(button.getAttribute('aria-pressed')).toBe('true')
    button.click()
    flushAnimationFrames()
    expect(button.getAttribute('aria-pressed')).toBe('false')
  })

  it('pauses hidden rendering, restores after resize and honors autoResize:false', async () => {
    const { host, rect } = container(0, 0)
    const chart = create(host, { data }, { autoResize: false })
    const rendered = vi.fn()
    const finished = vi.fn()
    chart.on('rendered', rendered)
    chart.on('finished', finished)
    flushAnimationFrames()
    expect(rendered).not.toHaveBeenCalled()
    expect(finished).not.toHaveBeenCalled()
    expect(resizeObservers).toHaveLength(0)
    Object.assign(rect, { width: 800, height: 400 })
    vi.mocked(host.getClientRects).mockReturnValue([rect] as unknown as DOMRectList)
    chart.resize()
    flushAnimationFrames()
    await flushNativeUpdates()
    expect(rendered).toHaveBeenCalled()
    expect(finished).toHaveBeenCalledOnce()
    chart.resize()
    expect(pendingAnimationFrameCount()).toBe(0)
  })

  it('continues instance cleanup when an observer fails to disconnect', () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { host } = container()
    const chart = create(host, { data })
    const failure = new Error('observer cleanup')
    vi.mocked(resizeObservers[0]!.disconnect).mockImplementation(() => {
      throw failure
    })
    chart.dispose()
    expect(report).toHaveBeenCalledWith(failure)
    expect(getInstanceByDom(host)).toBeUndefined()
    expect(host.childElementCount).toBe(0)
    expect(pendingAnimationFrameCount()).toBe(0)
  })

  it('keeps disabled command snapshots unchanged and preserves legacy silent methods', () => {
    const { host } = container()
    const chart = create(host, { data, zoomable: false })
    const zoom = vi.fn()
    chart.on('zoom-end', zoom)
    const before = chart.getControlState().targets[0]?.viewport
    const result = chart.dispatchAction({ type: 'set-domain', domain: [0.5, 1] })
    expect(result.status).toBe('disabled')
    if (result.kind === 'viewport') expect(result.targets[0]?.after).toEqual(before)
    chart.setViewportDomain([0.5, 1])
    expect(chart.getControlState().targets[0]?.viewport.xDomain).toEqual([0.5, 1])
    chart.resetViewport()
    expect(chart.getControlState().targets[0]?.viewport.xDomain).toEqual([0, 2])
    expect(zoom).not.toHaveBeenCalled()
  })

  it('measures actual inner CSS constraints, resets optional sizes and avoids observer loops', async () => {
    const { host } = container()
    const chart = create(host, { data, width: 600, height: 100 })
    const root = host.querySelector<HTMLElement>('.waveform-native-chart')!
    expect(root.style.width).toBe('600px')
    expect(root.style.height).toBe('180px')
    const rect = { width: 300, height: 200 } as DOMRect
    vi.spyOn(root, 'getBoundingClientRect').mockImplementation(() => rect)
    vi.spyOn(root, 'getClientRects').mockImplementation(() => [rect] as unknown as DOMRectList)
    chart.resize()
    flushAnimationFrames()
    expect(root.querySelector('svg')?.getAttribute('width')).toBe('300')
    expect(root.querySelector('svg')?.getAttribute('height')).toBe('200')
    await flushNativeUpdates()
    resizeObservers[0]!.resize(800, 400)
    expect(pendingAnimationFrameCount()).toBe(0)
    chart.setOption({ width: undefined, height: undefined })
    expect(root.style.width).toBe('100%')
    expect(root.style.height).toBe('100%')
    Object.assign(rect, { width: 0, height: 0 })
    chart.resize()
    const rendered = vi.fn()
    chart.on('rendered', rendered)
    flushAnimationFrames()
    expect(rendered).not.toHaveBeenCalled()
  })

  it('degrades to manual resize when ResizeObserver is unavailable', () => {
    const Original = window.ResizeObserver
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: undefined })
    try {
      const { host, rect } = container()
      const chart = create(host, { data })
      expect(info).toHaveBeenCalledOnce()
      expect(resizeObservers).toHaveLength(0)
      Object.assign(rect, { width: 360, height: 300 })
      chart.resize()
      flushAnimationFrames()
      expect(host.querySelector('svg')?.getAttribute('width')).toBe('360')
    } finally {
      Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: Original })
    }
  })

  it('uses the measured content box, excluding borders and padding like ResizeObserver', async () => {
    const { host } = container()
    const chart = create(host, { data })
    const root = host.querySelector<HTMLElement>('.waveform-native-chart')!
    root.style.border = '2px solid black'
    root.style.padding = '3px 5px'
    const rect = { width: 360, height: 300 } as DOMRect
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(rect)
    vi.spyOn(root, 'getClientRects').mockReturnValue([rect] as unknown as DOMRectList)
    chart.resize()
    await flushNativeUpdates()
    expect(root.querySelector('svg')?.getAttribute('width')).toBe('346')
    expect(root.querySelector('svg')?.getAttribute('height')).toBe('290')
    Object.defineProperty(root, 'clientWidth', { configurable: true, value: 356 })
    Object.defineProperty(root, 'clientHeight', { configurable: true, value: 296 })
    Object.assign(rect, { width: 720, height: 600 })
    chart.resize()
    await flushNativeUpdates()
    // CSS transforms change bounding rectangles, not the drawing's layout pixels.
    expect(root.querySelector('svg')?.getAttribute('width')).toBe('346')
    expect(root.querySelector('svg')?.getAttribute('height')).toBe('290')
  })
})
