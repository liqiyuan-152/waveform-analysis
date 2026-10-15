import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { init } from '@/chart/init'
import type { WaveformChartOptions } from '@/types/options'
import type { WaveformChartInstance } from '@/types/native'
import type { WaveformChartHandle } from '@/types/controls'
import { flushNativeUpdates } from '../support/nativeChart'
import { mountLegacySizedChart as mountSizedChart } from '../support/waveformChart'

const cleanup: Array<() => void> = []
afterEach(() => {
  cleanup.splice(0).forEach((dispose) => dispose())
  vi.restoreAllMocks()
})
const data = {
  kind: 'series' as const,
  series: ['low', 'high', 'mid'].map((id, index) => ({
    id,
    trackId: 'group',
    name: id,
    data: {
      kind: 'points' as const,
      points: [
        { x: 0, y: index * 100 },
        { x: (index + 1) * 10, y: (index + 1) * 100 },
      ],
    },
  })),
}
async function native(options: WaveformChartOptions = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  Object.defineProperty(host, 'getClientRects', { value: () => [{}] })
  const chart = init(
    host,
    {
      data,
      width: 800,
      height: 360,
      animationEnabled: false,
      xDomainStrategy: { type: 'data' },
      overlayMode: 'multi-axis',
      legend: { interactive: true },
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
function items(root: Element) {
  return [...root.querySelectorAll<HTMLButtonElement>('.waveform-chart__legend-item')]
}
function click(root: Element, id: string) {
  const button = items(root).find(
    (item) => item.getAttribute('data-series-id') === id || item.textContent === id,
  )!
  button.click()
}
function visible(root: Element) {
  return [...root.querySelectorAll('.waveform-chart__line')].map(
    (line) =>
      line.getAttribute('data-series-id') ??
      line.closest('[data-series-id]')!.getAttribute('data-series-id'),
  )
}
function hover(root: Element) {
  const node = root.querySelector<SVGRectElement>('.waveform-chart__overlay')!
  Object.defineProperty(node, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ left: 0, top: 0 }),
  })
  node.dispatchEvent(
    new MouseEvent('pointermove', {
      bubbles: true,
      clientX: Number(node.getAttribute('width')) / 2,
      clientY: Number(node.getAttribute('height')) / 2,
    }),
  )
}
function events(chart: WaveformChartInstance) {
  const log: Array<[string, unknown]> = []
  for (const name of [
    'update:hidden-series-ids',
    'series-visibility-change',
    'update:interactionMode',
    'interaction-mode-change',
  ] as const)
    chart.on(name, (payload) => log.push([name, payload]))
  return log
}

describe('native controlled state', () => {
  it.each(['independent', 'separated', 'compact'] as const)(
    'matches Vue controlled visibility requests and host acknowledgements in %s',
    async (displayMode) => {
      const hiddenSeriesIds = ['high', 'temporarily-absent']
      Object.freeze(hiddenSeriesIds)
      const options = {
        displayMode,
        hiddenSeriesIds,
        overlayMode: 'multi-axis' as const,
        legend: { interactive: true },
      }
      const h = await native(options)
      const wrapper = await mountSizedChart(data, {
        ...options,
        width: 800,
        height: 360,
        animationEnabled: false,
        xDomainStrategy: { type: 'data' },
      })
      cleanup.push(() => wrapper.unmount())
      const log = events(h.chart)
      const before = h.chart.getControlState()
      click(h.host, 'low')
      click(wrapper.element, 'low')
      await flushNativeUpdates()
      await flushPromises()
      expect(log).toEqual([
        ['update:hidden-series-ids', ['high', 'temporarily-absent', 'low']],
        [
          'series-visibility-change',
          {
            seriesId: 'low',
            visible: false,
            hiddenSeriesIds: ['high', 'temporarily-absent', 'low'],
          },
        ],
      ])
      expect(wrapper.emitted('update:hidden-series-ids')!.at(-1)).toEqual([log[0][1]])
      expect(wrapper.emitted('series-visibility-change')!.at(-1)).toEqual([log[1][1]])
      expect(h.chart.getControlState()).toEqual(before)
      expect(visible(h.host)).toEqual(visible(wrapper.element))
      expect(visible(h.host)).toEqual(['low', 'mid'])
      expect(items(h.host)[0].getAttribute('aria-pressed')).toBe('true')
      click(h.host, 'low')
      expect(log[2]).toEqual(log[0])
      h.chart.setOption({ hiddenSeriesIds: ['low'] })
      await wrapper.setProps({ hiddenSeriesIds: ['low'] })
      await flushNativeUpdates()
      expect(visible(h.host)).toEqual(visible(wrapper.element))
      expect(visible(h.host)).toEqual(['high', 'mid'])
      expect(h.host.querySelectorAll('.waveform-chart__axis--y')).toHaveLength(2)
      hover(h.host)
      await flushNativeUpdates()
      const labels = [...h.host.querySelectorAll('.waveform-tooltip__series-label')].map(
        (item) => item.textContent,
      )
      expect(labels).toHaveLength(2)
      expect(labels.join(' ')).not.toContain('low')
      expect(hiddenSeriesIds).toEqual(['high', 'temporarily-absent'])
      expect(log).toHaveLength(4) // Host acknowledgement does not emit another visibility request.
    },
  )

  it('restores the original internal visibility after controlled operations and ignores new defaults', async () => {
    const { host, chart } = await native({ defaultHiddenSeriesIds: ['high'] })
    expect(visible(host)).toEqual(['low', 'mid'])
    click(host, 'mid')
    await flushNativeUpdates()
    expect(visible(host)).toEqual(['low'])
    chart.setOption({ hiddenSeriesIds: ['low'], defaultHiddenSeriesIds: ['low', 'high', 'mid'] })
    await flushNativeUpdates()
    click(host, 'high') // Request only; must not overwrite the internal hidden high/mid set.
    chart.setOption({ hiddenSeriesIds: undefined })
    await flushNativeUpdates()
    expect(visible(host)).toEqual(['low'])
    expect(
      items(host)
        .filter((item) => item.getAttribute('aria-pressed') === 'false')
        .map((item) => item.dataset.seriesId),
    ).toEqual(['high', 'mid'])
  })

  it.each([false, true])(
    'retains visibility by ID across reorder (controlled=%s)',
    async (controlled) => {
      const { host, chart } = await native(controlled ? { hiddenSeriesIds: ['high'] } : {})
      if (!controlled) click(host, 'high')
      chart.setOption({ data: { ...data, series: [...data.series].reverse() } })
      await flushNativeUpdates()
      expect(visible(host)).toEqual(['mid', 'low'])
      expect(
        items(host).map((item) => [item.dataset.seriesId, item.getAttribute('aria-pressed')]),
      ).toEqual([
        ['mid', 'true'],
        ['high', 'false'],
        ['low', 'true'],
      ])
      chart.setOption({ data: { ...data, series: [data.series[0]] } })
      chart.setOption({ data })
      await flushNativeUpdates()
      expect(visible(host)).toEqual(controlled ? ['low', 'mid'] : ['low', 'high', 'mid'])
    },
  )

  it('keeps all-hidden legends recoverable and recomputes axes, domains and capabilities', async () => {
    const { host, chart } = await native({ defaultHiddenSeriesIds: ['low', 'high', 'mid'] })
    expect(visible(host)).toEqual([])
    expect(items(host)).toHaveLength(3)
    expect(host.querySelector('.waveform-chart__overlay')).toBeNull()
    expect(chart.zoomIn().status).toBe('empty-data')
    expect(chart.getControlState().available['zoom-in']).toBe(false)
    click(host, 'low')
    await flushNativeUpdates()
    expect(visible(host)).toEqual(['low'])
    expect(chart.getControlState().targets[0].viewport.xDomain).toEqual([0, 10])
    expect(host.querySelectorAll('.waveform-chart__axis--y')).toHaveLength(1)
    expect(host.querySelector('.waveform-chart__overlay')).not.toBeNull()
    expect(chart.getControlState().available['zoom-in']).toBe(true)
  })

  it('supports synchronous visibility acknowledgement, captured payloads and callback disposal', async () => {
    const { host, chart } = await native({ hiddenSeriesIds: [] })
    const changed = vi.fn()
    chart.on('series-visibility-change', changed)
    chart.on('update:hidden-series-ids', (ids) => {
      chart.setOption({
        hiddenSeriesIds: ids,
        data: { ...data, series: [...data.series].reverse() },
      })
      ids.push('consumer-mutated-payload')
    })
    click(host, 'high')
    expect(changed).toHaveBeenCalledExactlyOnceWith({
      seriesId: 'high',
      visible: false,
      hiddenSeriesIds: ['high'],
    })
    await flushNativeUpdates()
    expect(visible(host)).toEqual(['mid', 'low'])
    chart.on('update:hidden-series-ids', () => chart.dispose())
    click(host, 'low')
    expect(chart.isDisposed()).toBe(true)
    expect(changed).toHaveBeenCalledOnce()
    expect(host.children).toHaveLength(0)
  })

  it('does not expose mutable state through visibility events and ignores disabled or obsolete buttons', async () => {
    const { host, chart } = await native()
    const log = events(chart)
    const old = items(host).find((item) => item.dataset.seriesId === 'high')!
    chart.on('update:hidden-series-ids', (ids) => {
      ids.length = 0
    })
    click(host, 'high')
    await flushNativeUpdates()
    expect(visible(host)).toEqual(['low', 'mid'])
    expect(log[1][1]).toEqual({ seriesId: 'high', visible: false, hiddenSeriesIds: ['high'] })
    chart.setOption({ legend: { interactive: false } })
    await flushNativeUpdates()
    click(host, 'low')
    expect(log).toHaveLength(2)
    chart.setOption({ data: { ...data, series: [data.series[0]] } })
    await flushNativeUpdates()
    old.click()
    expect(log).toHaveLength(2)
  })

  it('separates mode requests from actual mode and matches Vue host acknowledgement', async () => {
    const { host, chart } = await native({ interactionMode: 'zoom', pannable: true })
    const wrapper = await mountSizedChart(data, {
      interactionMode: 'zoom',
      pannable: true,
      animationEnabled: false,
    })
    cleanup.push(() => wrapper.unmount())
    const vue = wrapper.vm as unknown as WaveformChartHandle
    const log = events(chart)
    expect(chart.setInteractionMode('pan')).toEqual(vue.setInteractionMode('pan'))
    expect(chart.getControlState().mode).toBe('zoom')
    expect(host.querySelector('.waveform-chart--interaction-zoom')).not.toBeNull()
    expect(log).toEqual([['update:interactionMode', 'pan']])
    expect(wrapper.emitted('update:interactionMode')).toEqual([['pan']])
    expect(chart.setInteractionMode('zoom').status).toBe('unchanged')
    chart.setOption({ interactionMode: 'pan' })
    await wrapper.setProps({ interactionMode: 'pan' })
    await flushNativeUpdates()
    expect(chart.getControlState().mode).toBe('pan')
    expect(host.querySelector('.waveform-chart--interaction-pan')).not.toBeNull()
    expect(log).toEqual([
      ['update:interactionMode', 'pan'],
      ['interaction-mode-change', 'pan'],
    ])
    expect(wrapper.emitted('interaction-mode-change')).toEqual([['pan']])
  })

  it('preserves uncontrolled mode through controlled overrides and enforces current capabilities', async () => {
    const { chart } = await native({ pannable: true })
    const log = events(chart)
    expect(chart.setInteractionMode('pan').status).toBe('applied')
    chart.setOption({ interactionMode: 'annotation' })
    expect(chart.setInteractionMode('zoom').status).toBe('requested')
    expect(chart.getControlState().mode).toBe('annotation')
    chart.setOption({ interactionMode: undefined, pannable: false })
    expect(chart.getControlState().mode).toBe('pan')
    expect(chart.setInteractionMode('pan').status).toBe('disabled')
    chart.setOption({ pannable: true })
    expect(chart.setInteractionMode('pan').status).toBe('unchanged')
    expect(log).toEqual([
      ['interaction-mode-change', 'pan'],
      ['interaction-mode-change', 'annotation'],
      ['update:interactionMode', 'zoom'],
      ['interaction-mode-change', 'pan'],
    ])
    chart.setOption({ presentationMode: true })
    expect(chart.setInteractionMode('none').status).toBe('disabled')
  })

  it('allows synchronous mode acknowledgement and disposal without duplicate actual events', async () => {
    const { chart } = await native({ interactionMode: 'zoom', pannable: true })
    const actual = vi.fn()
    chart.on('interaction-mode-change', actual)
    const release = chart.on('update:interactionMode', (mode) =>
      chart.setOption({ interactionMode: mode }),
    )
    expect(chart.setInteractionMode('pan').status).toBe('requested')
    expect(chart.getControlState().mode).toBe('pan')
    expect(actual).toHaveBeenCalledExactlyOnceWith('pan')
    release()
    chart.on('update:interactionMode', () => chart.dispose())
    expect(chart.setInteractionMode('zoom').status).toBe('requested')
    expect(chart.isDisposed()).toBe(true)
    expect(actual).toHaveBeenCalledOnce()
  })
})
