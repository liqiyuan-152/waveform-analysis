import { afterEach, describe, expect, it, vi } from 'vitest'
import { init } from '@/chart/init'
import type { WaveformChartOptions } from '@/types/options'
import { flushNativeUpdates } from '../support/nativeChart'

const cleanup: Array<() => void> = []
afterEach(() => {
  cleanup.splice(0).forEach((dispose) => dispose())
  vi.restoreAllMocks()
})
const data = {
  kind: 'series' as const,
  series: ['a', 'b', 'c'].map((id) => ({
    id,
    name: id,
    data: {
      kind: 'points' as const,
      points: Array.from({ length: 101 }, (_, i) => ({ x: i / 10, y: Math.sin(i) })),
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
      data,
      width: 800,
      height: 400,
      toolbar: { display: 'always' },
      animationEnabled: false,
      xDomainStrategy: { type: 'data' },
      grid: { rowCount: 2, columnCount: 1 },
      ...options,
    },
    { autoResize: false },
  )
  cleanup.push(() => {
    chart.dispose()
    host.remove()
  })
  await flushNativeUpdates()
  const button = (id: string) => host.querySelector<HTMLButtonElement>(`[data-command="${id}"]`)!
  return { chart, host, button }
}

describe('native toolbar instance integration', () => {
  it('keeps adjacent groups/order, disabled items and stable focused nodes on redraw', async () => {
    const { host, chart, button } = await setup({
      toolbar: { items: ['reset', 'export', 'pan', 'zoom-in', 'reset'] },
    })
    expect(
      [...host.querySelectorAll('[data-command]')].map((node) => node.getAttribute('data-command')),
    ).toEqual(['reset', 'export', 'pan', 'zoom-in'])
    expect(
      [...host.querySelectorAll('.waveform-toolbar__group')].map((node) =>
        node.getAttribute('data-group'),
      ),
    ).toEqual(['viewport', 'export', 'mode', 'viewport'])
    expect(button('pan').disabled).toBe(true)
    const zoom = button('zoom-in')
    zoom.focus()
    chart.setOption({ lineColor: '#123456' })
    await flushNativeUpdates()
    expect(button('zoom-in')).toBe(zoom)
    expect(document.activeElement).toBe(zoom)
    const request = vi.fn()
    chart.on('zoom-intent', request)
    chart.setOption({ toolbar: false })
    await flushNativeUpdates()
    zoom.click()
    expect(request).not.toHaveBeenCalled()
  })

  it('keeps controlled highlights unchanged until acknowledgement and restores internal mode on release', async () => {
    const { host, chart, button } = await setup({ interactionMode: 'zoom', pannable: true })
    const request = vi.fn(),
      change = vi.fn()
    chart.on('update:interactionMode', request)
    chart.on('interaction-mode-change', change)
    button('pan').click()
    await flushNativeUpdates()
    expect(request).toHaveBeenCalledWith('pan')
    expect(change).not.toHaveBeenCalled()
    expect(button('pan').getAttribute('aria-pressed')).toBe('false')
    chart.setOption({ interactionMode: 'pan' })
    await flushNativeUpdates()
    expect(button('pan').getAttribute('aria-pressed')).toBe('true')
    chart.setOption({ interactionMode: undefined })
    await flushNativeUpdates()
    expect(button('zoom-box').getAttribute('aria-pressed')).toBe('true')
    button('annotate').click()
    await flushNativeUpdates()
    expect(button('annotate').getAttribute('aria-pressed')).toBe('true')
    expect(host.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1)
  })

  it('runs scoped viewport commands with toolbar metadata and resets page-invalid selections', async () => {
    const { host, chart, button } = await setup()
    const select = host.querySelector<HTMLSelectElement>('[aria-label="操作图框"]')!
    select.value = 'b'
    select.dispatchEvent(new Event('change'))
    const end = vi.fn(),
      intent = vi.fn()
    chart.on('zoom-end', end)
    chart.on('zoom-intent', intent)
    button('zoom-in').click()
    await flushNativeUpdates()
    expect(intent).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'toolbar',
        action: 'zoom-in',
        commandId: expect.any(String),
        trackIndex: 1,
      }),
    )
    expect(end).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'toolbar', action: 'zoom-in', trackIndex: 1 }),
    )
    const state = chart.getControlState()
    expect(state.targets[0].viewport.xDomain).toEqual([0, 10])
    expect(state.targets[1].viewport.xDomain).not.toEqual([0, 10])
    host.querySelector<HTMLButtonElement>('[aria-label="下一页"]')!.click()
    await flushNativeUpdates()
    expect(select.value).toBe('')
    expect([...select.options].map((option) => option.value)).toEqual([
      '',
      'c',
      'empty-grid-slot-1',
    ])
    chart.setOption({ displayMode: 'compact' })
    await flushNativeUpdates()
    expect(select.hidden).toBe(true)
    expect(host.querySelector<HTMLElement>('.waveform-toolbar__scope')!.hidden).toBe(false)
  })

  it('collapses small containers and dismisses export menus without chart gestures', async () => {
    const { host, button } = await setup({ width: 360 })
    const toolbar = host.querySelector<HTMLElement>('[role="toolbar"]')!
    const toggle = toolbar.querySelector<HTMLButtonElement>('[aria-label="图表工具"]')!
    expect(toolbar.classList.contains('waveform-toolbar--collapsed')).toBe(true)
    toggle.click()
    button('export').click()
    expect(toolbar.querySelector<HTMLElement>('.waveform-toolbar__menu')!.hidden).toBe(false)
    const propagated = vi.fn()
    host.addEventListener('wheel', propagated)
    button('zoom-in').dispatchEvent(new WheelEvent('wheel', { bubbles: true }))
    expect(propagated).not.toHaveBeenCalled()
    toolbar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(toolbar.classList.contains('waveform-toolbar--collapsed')).toBe(true)
    expect(toolbar.querySelector<HTMLElement>('.waveform-toolbar__menu')!.hidden).toBe(true)
    toggle.click()
    button('export').click()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(toolbar.querySelector<HTMLElement>('.waveform-toolbar__menu')!.hidden).toBe(true)
  })

  it('disables all toolbar capabilities in presentation mode and retains command API state', async () => {
    const { chart, host } = await setup({ presentationMode: true, pannable: true })
    expect(
      [
        ...host.querySelectorAll<HTMLButtonElement>('[data-command]:not([data-command="export"])'),
      ].every((button) => button.disabled),
    ).toBe(true)
    expect(host.querySelector<HTMLButtonElement>('[data-command="export"]')!.disabled).toBe(false)
    expect(chart.zoomIn().status).toBe('disabled')
    chart.setOption({ presentationMode: false, toolbar: { items: [] } })
    await flushNativeUpdates()
    expect(host.querySelector<HTMLElement>('[role="toolbar"]')!.hidden).toBe(true)
    expect(chart.zoomIn().status).toBe('applied')
  })

  it('cleans detached controls and owner-document listeners on disposal', async () => {
    const { chart, button } = await setup()
    const intent = vi.fn()
    chart.on('zoom-intent', intent)
    const zoom = button('zoom-in')
    chart.dispose()
    zoom.click()
    expect(intent).not.toHaveBeenCalled()
  })
})
