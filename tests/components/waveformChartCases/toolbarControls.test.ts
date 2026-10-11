import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { gridSeries, mountSizedChart } from '@tests/support/waveformChart'
import type { WaveformChartHandle, WaveformData } from '@/index'
import { resolveToolbar } from '@/components/controls/toolbarRegistry'

const data: WaveformData = {
  kind: 'points',
  points: Array.from({ length: 101 }, (_, i) => ({ x: i / 10, y: Math.sin(i) })),
}
const setup = (props = {}) => mountSizedChart(data, { xDomainStrategy: { type: 'data' }, ...props })
describe('toolbar and external commands', () => {
  it('preserves silent numeric methods and default UI', async () => {
    const w = await setup()
    const api: WaveformChartHandle = w.vm
    expect(w.find('[role="toolbar"]').exists()).toBe(false)
    const result: void = api.setViewportDomain([2, 4], 0)
    expect(result).toBeUndefined()
    expect(api.getControlState().targets[0]?.viewport.xDomain[0]).toBeCloseTo(2)
    expect(api.getControlState().targets[0]?.viewport.xDomain[1]).toBeCloseTo(4)
    const reset: void = api.resetViewport(0)
    expect(reset).toBeUndefined()
    expect(w.emitted('zoom-intent')).toBeUndefined()
    expect(w.emitted('zoom-end')).toBeUndefined()
    expect(w.emitted('zoom-reset')).toBeUndefined()
    w.unmount()
  })
  it('keeps controlled requests separate from actual mode and supports external mode', async () => {
    const w = await setup({ toolbar: true, pannable: true, interactionMode: 'zoom' })
    await w.get('[data-command="pan"]').trigger('click')
    expect(w.emitted('update:interactionMode')).toEqual([['pan']])
    expect(w.vm.getControlState().mode).toBe('zoom')
    expect(w.get('[data-command="pan"]').attributes('aria-pressed')).toBe('false')
    await w.setProps({ interactionMode: 'pan' })
    expect(w.get('[data-command="pan"]').attributes('aria-pressed')).toBe('true')
    expect(w.emitted('interaction-mode-change')).toEqual([['pan']])
    await w.setProps({ toolbar: false })
    expect(w.vm.getControlState().mode).toBe('pan')
    w.unmount()
    const u = await setup({ pannable: true })
    expect(u.vm.setInteractionMode('pan').status).toBe('applied')
    expect(u.vm.setInteractionMode('none').status).toBe('applied')
    expect(u.vm.zoomIn().status).toBe('applied')
    await u.setProps({ pannable: false })
    expect(u.vm.setInteractionMode('pan').status).toBe('disabled')
    await u.setProps({ presentationMode: true })
    expect(u.vm.zoomIn().status).toBe('disabled')
    u.unmount()
  })
  it('uses command events with fit and reset intent exceptions', async () => {
    const w = await setup({ initialXDomain: [2, 8], maxZoomScale: 10, toolbar: true })
    const api: WaveformChartHandle = w.vm
    expect(api.fitToData().status).toBe('applied')
    expect(api.getControlState().targets[0]?.viewport.xDomain).toEqual([0, 10])
    expect(w.emitted('zoom-intent')).toBeUndefined()
    expect(w.emitted('zoom-end')?.[0]?.[0]).toMatchObject({
      action: 'fit',
      gesture: 'command',
      source: 'api',
    })
    api.setViewportDomain([4.9, 5.1], {})
    const range = api.getControlState().targets[0]!.viewport.xDomain
    expect(range[1] - range[0]).toBeCloseTo(1)
    expect(api.resetViewport({}).status).toBe('applied')
    expect(api.resetViewport({}).status).toBe('unchanged')
    expect(w.emitted('zoom-reset')).toHaveLength(2)
    expect(api.getControlState().targets[0]?.viewport.xDomain).toEqual([2, 8])
    api.fitToData()
    api.setViewportDomain([0, 10], 0)
    expect(api.getControlState().targets[0]?.viewport.xDomain).toEqual([2, 8])
    await flushPromises()
    await w.get('[data-command="zoom-in"]').trigger('click')
    expect(w.emitted('zoom-intent')?.at(-1)?.[0]).toMatchObject({
      action: 'zoom-in',
      source: 'toolbar',
    })
    const frozen = api.getControlState()
    frozen.targets[0]!.viewport.xDomain[0] = -100
    expect(api.getControlState().targets[0]!.viewport.xDomain[0]).not.toBe(-100)
    w.unmount()
  })
  it('reports partial success and never falls back from invalid targets', async () => {
    const w = await mountSizedChart(gridSeries(3), {
      grid: { rowCount: 2, columnCount: 1 },
      xDomainStrategy: { type: 'data' },
      minZoomSpan: 0.25,
      toolbar: true,
    })
    const api: WaveformChartHandle = w.vm
    api.setViewportDomain([0.3, 0.55], { trackId: 'channel-1' })
    const result = api.zoomIn()
    expect(result.status).toBe('applied')
    expect(result.targets.map((t) => t.status)).toEqual(['applied', 'unchanged'])
    expect(api.zoomIn({ trackId: 'channel-2' }).status).toBe('invalid-target')
    expect(api.setViewportDomain([NaN, 1], {}).status).toBe('invalid-domain')
    expect(api.setViewportDomain([1, 1], {}).targets).toEqual([])
    const events = w.emitted('zoom-end')!
    expect(events.at(-1)?.[0]).toMatchObject({ seriesIds: ['channel-0'] })
    await w.setProps({ displayMode: 'compact' })
    expect(api.zoomIn({ trackId: 'channel-0' }).status).toBe('invalid-target')
    expect(api.zoomIn().targets[0]?.trackId).toBe('shared')
    w.unmount()
  })
  it('groups adjacent items without reordering and retains disabled buttons', async () => {
    expect(resolveToolbar(true).groups.map((g) => g[0]?.group)).toEqual([
      'mode',
      'viewport',
      'export',
    ])
    expect(
      resolveToolbar({ items: ['reset', 'export', 'pan', 'zoom-in', 'reset'] })
        .groups.flat()
        .map((b) => b.id),
    ).toEqual(['reset', 'export', 'pan', 'zoom-in'])
    const w = await setup({ toolbar: { items: ['pan', 'annotate'] } })
    expect(w.findAll('.waveform-toolbar__group')).toHaveLength(1)
    expect(w.get('[data-command="pan"]').attributes('disabled')).toBeDefined()
    await w.setProps({ toolbar: { items: [] } })
    expect(w.find('[role="toolbar"]').exists()).toBe(false)
    w.unmount()
  })
})
