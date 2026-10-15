import { afterEach, describe, expect, it, vi } from 'vitest'
import { init } from '@/chart/init'
import type { WaveformChartOptions } from '@/types/options'
import type { WaveformAnnotation } from '@/types/chart'
import { flushNativeUpdates } from '../support/nativeChart'
import { pendingAnimationFrameCount } from '../support/setup'
import { mountLegacySizedChart as mountSizedChart } from '../support/waveformChart'

const cleanup: Array<() => void> = []
afterEach(() => {
  cleanup.splice(0).forEach((dispose) => dispose())
  vi.restoreAllMocks()
})
const annotation: WaveformAnnotation = {
  id: 'a/b',
  seriesId: 'a',
  x: 1,
  y: 0,
  text: '中文标注',
  style: { borderColor: '#123456', textColor: '#654321', backgroundColor: 'rgba(1, 2, 3, 0.5)' },
}
const data = {
  kind: 'series' as const,
  series: ['a', 'b'].map((id) => ({
    id,
    name: id,
    data: {
      kind: 'points' as const,
      points: [
        { x: 0, y: -1 },
        { x: 1, y: 0 },
        { x: 2, y: 1 },
      ],
    },
  })),
}
async function setup(options: WaveformChartOptions = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  Object.defineProperty(host, 'getClientRects', { value: () => [{}] })
  const chart = init(
    host,
    {
      width: 800,
      height: 360,
      data,
      annotations: [annotation],
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
function label(host: HTMLElement) {
  return host.querySelector<SVGGElement>('.waveform-annotation')!
}
function box(host: HTMLElement) {
  const node = host.querySelector('.waveform-annotation__box')!
  return { x: Number(node.getAttribute('x')), y: Number(node.getAttribute('y')) }
}
function pointer(target: EventTarget, type: string, x: number, y: number, id = 1) {
  target.dispatchEvent(
    new PointerEvent(type, { bubbles: true, pointerId: id, button: 0, clientX: x, clientY: y }),
  )
}

describe('native annotation rendering and drag integration', () => {
  it.each(['independent', 'separated', 'compact'] as const)(
    'matches Vue annotation geometry/styles in %s and retains the node on resize',
    async (displayMode) => {
      const { host, chart } = await setup({ displayMode })
      const legacy = await mountSizedChart(data, {
        annotations: [annotation],
        displayMode,
        animationEnabled: false,
        xDomainStrategy: { type: 'data' },
        grid: { rowCount: 2, columnCount: 1 },
        width: 800,
        height: 360,
      })
      cleanup.push(() => legacy.unmount())
      await flushNativeUpdates()
      const oldBox = legacy.find('.waveform-annotation__box')
      expect(box(host)).toEqual({
        x: Number(oldBox.attributes('x')),
        y: Number(oldBox.attributes('y')),
      })
      const element = label(host)
      expect(element.textContent).toBe('中文标注')
      expect(element.querySelector('rect')!.getAttribute('fill')).toBe('rgba(1, 2, 3, 0.5)')
      chart.setOption({ width: 500 })
      await flushNativeUpdates()
      expect(label(host)).toBe(element)
    },
  )

  it('keeps SVG references unique across colliding user IDs and simultaneous instances', async () => {
    const annotations = [annotation, { ...annotation, id: 'a-b', seriesId: 'b' }]
    const a = await setup({ annotations }),
      b = await setup({ annotations })
    const ids = [a.host, b.host].flatMap((host) =>
      [...host.querySelectorAll('marker')].map((node) => node.id),
    )
    expect(new Set(ids).size).toBe(4)
    for (const host of [a.host, b.host])
      for (const arrow of host.querySelectorAll('.waveform-annotation__arrow')) {
        const id = arrow.getAttribute('marker-end')!.slice(5, -1)
        expect(host.querySelector(`#${id}`)).not.toBeNull()
      }
    a.chart.dispose()
    expect(b.host.querySelectorAll('.waveform-annotation')).toHaveLength(2)
  })

  it('renders annotation text as text and never changes frozen consumer input', async () => {
    const input = Object.freeze({
      ...annotation,
      text: '<img src=x>',
      style: Object.freeze({ ...annotation.style }),
    })
    const { host, chart } = await setup({
      annotations: Object.freeze([input]) as unknown as WaveformAnnotation[],
    })
    expect(label(host).textContent).toBe('<img src=x>')
    expect(host.querySelector('img')).toBeNull()
    chart.setViewportDomain([0.5, 1.5])
    await flushNativeUpdates()
    expect(input).toEqual({ ...annotation, text: '<img src=x>' })
  })

  it('reprojects anchors on viewport/data updates and hides removed/hidden/out-of-domain series', async () => {
    const { host, chart } = await setup()
    const anchor = () =>
      Number(host.querySelector('.waveform-annotation__arrow')!.getAttribute('x2'))
    const before = anchor()
    chart.setViewportDomain([0.75, 2])
    await flushNativeUpdates()
    expect(anchor()).not.toBe(before)
    chart.setOption({ data: { ...data, series: [...data.series].reverse() } })
    await flushNativeUpdates()
    expect(host.querySelectorAll('.waveform-annotation')).toHaveLength(1)
    chart.setOption({ hiddenSeriesIds: ['a'] })
    await flushNativeUpdates()
    expect(label(host)).toBeNull()
    chart.setOption({ hiddenSeriesIds: [], annotationsVisible: false })
    await flushNativeUpdates()
    expect(label(host)).toBeNull()
    chart.setOption({ annotationsVisible: true })
    chart.setViewportDomain([1.5, 2])
    await flushNativeUpdates()
    expect(label(host)).toBeNull()
    chart.setOption({ data: { ...data, series: [data.series[1]!] } })
    await flushNativeUpdates()
    expect(label(host)).toBeNull()
  })

  it('coalesces drag frames, uses the final pointer position and emits only a controlled request', async () => {
    const { host, chart } = await setup()
    const request = vi.fn(),
      update = vi.fn(),
      rendered = vi.fn()
    chart.on('update:annotations', request)
    chart.on('annotation-update', update)
    chart.on('rendered', rendered)
    const before = box(host)
    pointer(label(host), 'pointerdown', 100, 100)
    pointer(window, 'pointermove', 120, 110)
    pointer(window, 'pointermove', 125, 115)
    expect(pendingAnimationFrameCount()).toBe(1)
    await flushNativeUpdates()
    expect(box(host)).toEqual({ x: before.x + 25, y: before.y + 15 })
    pointer(window, 'pointerup', 130, 120)
    expect(request).toHaveBeenCalledExactlyOnceWith([
      { ...annotation, labelOffsetX: 30, labelOffsetY: 20 },
    ])
    expect(box(host)).toEqual({ x: before.x + 30, y: before.y + 20 })
    expect(update).not.toHaveBeenCalled()
    expect(rendered).not.toHaveBeenCalled()
    expect(annotation.labelOffsetX).toBeUndefined()
  })

  it('clears preview on synchronous acknowledgement and accumulates unacknowledged drags', async () => {
    const { host, chart } = await setup()
    const request = vi.fn()
    chart.on('update:annotations', request)
    pointer(label(host), 'pointerdown', 100, 100)
    pointer(window, 'pointerup', 110, 110)
    const first = box(host)
    pointer(label(host), 'pointerdown', 100, 100)
    pointer(window, 'pointermove', 110, 105)
    await flushNativeUpdates()
    expect(box(host)).toEqual({ x: first.x + 10, y: first.y + 5 })
    pointer(window, 'pointerup', 110, 105)
    const replacement = request.mock.calls.at(-1)![0] as WaveformAnnotation[]
    expect(replacement[0]).toEqual({ ...annotation, labelOffsetX: 20, labelOffsetY: 15 })
    chart.setOption({ annotations: replacement })
    await flushNativeUpdates()
    const acknowledged = box(host)
    chart.on('update:annotations', (annotations) => chart.setOption({ annotations }))
    pointer(label(host), 'pointerdown', 100, 100)
    pointer(window, 'pointerup', 110, 110)
    await flushNativeUpdates()
    expect(box(host)).toEqual({ x: acknowledged.x + 10, y: acknowledged.y + 10 })
  })

  it.each(['cancel', 'escape', 'data', 'mode', 'resize', 'hide', 'dispose'] as const)(
    'cancels active annotation drag on %s and drops late frames/up events',
    async (reason) => {
      const { host, chart } = await setup()
      const request = vi.fn()
      chart.on('update:annotations', request)
      const before = box(host)
      pointer(label(host), 'pointerdown', 100, 100)
      pointer(window, 'pointermove', 120, 120)
      if (reason === 'cancel') pointer(window, 'pointercancel', 120, 120)
      if (reason === 'escape') window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      if (reason === 'data') chart.setOption({ data: { ...data, series: [...data.series] } })
      if (reason === 'mode') chart.setInteractionMode('pan')
      if (reason === 'resize') chart.setOption({ width: 600 })
      if (reason === 'hide') chart.setOption({ annotationsVisible: false })
      if (reason === 'dispose') chart.dispose()
      pointer(window, 'pointerup', 120, 120)
      await flushNativeUpdates()
      expect(request).not.toHaveBeenCalled()
      if (reason === 'cancel' || reason === 'escape') expect(box(host)).toEqual(before)
      if (reason === 'dispose') expect(host.children).toHaveLength(0)
    },
  )

  it('ignores other pointers and returning below the movement threshold', async () => {
    const { host, chart } = await setup()
    const request = vi.fn()
    chart.on('update:annotations', request)
    const before = box(host)
    pointer(label(host), 'pointerdown', 100, 100)
    pointer(window, 'pointermove', 120, 120, 2)
    await flushNativeUpdates()
    expect(box(host)).toEqual(before)
    pointer(window, 'pointermove', 120, 120)
    await flushNativeUpdates()
    pointer(window, 'pointerup', 101, 100)
    expect(box(host)).toEqual(before)
    expect(request).not.toHaveBeenCalled()
  })

  it('deletes via the context menu as a request and waits for host acknowledgement', async () => {
    const { host, chart } = await setup()
    const request = vi.fn(),
      remove = vi.fn()
    chart.on('update:annotations', request)
    chart.on('annotation-delete', remove)
    label(host).dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 200, clientY: 100 }),
    )
    const menu = host.querySelector('.waveform-annotation-context-menu')!
    const node = label(host)
    menu.querySelectorAll('button')[1]!.click()
    expect(request).toHaveBeenCalledExactlyOnceWith([])
    expect(remove).toHaveBeenCalledExactlyOnceWith(annotation)
    expect(label(host)).toBe(node)
    chart.setOption({ annotations: [] })
    await flushNativeUpdates()
    expect(label(host)).toBeNull()
    expect(host.querySelector('.waveform-annotation-context-menu')).toBeNull()
  })
})
