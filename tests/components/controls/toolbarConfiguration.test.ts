import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { gridSeries, mountSizedChart } from '@tests/support/waveformChart'
import { resizeObservers } from '@tests/support/setup'
import { resolveToolbar } from '@/components/controls/toolbarRegistry'
import type { WaveformToolbarOptions } from '@/index'

describe('toolbar configuration', () => {
  it('defaults to the requested top-right inset while respecting explicit zero offsets', () => {
    expect(resolveToolbar(true)).toMatchObject({ position: 'top-right', offsetX: -30, offsetY: 18 })
    expect(resolveToolbar({})).toMatchObject({ offsetX: -30, offsetY: 18 })
    expect(resolveToolbar({ offsetX: 0, offsetY: 0 })).toMatchObject({ offsetX: 0, offsetY: 0 })
  })
  it.each([NaN, Infinity, -Infinity])('normalizes invalid offsets %s', (offset) => {
    expect(resolveToolbar({ offsetX: offset, offsetY: offset })).toMatchObject({
      offsetX: 0,
      offsetY: 0,
      position: 'top-right',
    })
  })

  it.each(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const)(
    'positions at %s, avoiding title and pagination, and clamps excessive offsets',
    async (position) => {
      const xSign = position.endsWith('left') ? 1 : -1
      const ySign = position.startsWith('top') ? 1 : -1
      const toolbar: WaveformToolbarOptions = { position, offsetX: 12 * xSign, offsetY: 8 * ySign }
      const w = await mountSizedChart(gridSeries(3), {
        toolbar,
        title: { visible: true, text: 'Title' },
        grid: { rowCount: 2, columnCount: 1 },
      })
      const element = w.get<HTMLElement>('[role="toolbar"]').element
      expect(element.style[position.endsWith('left') ? 'left' : 'right']).toBe('14px')
      const vertical = position.startsWith('top') ? 'top' : 'bottom'
      expect(parseFloat(element.style[vertical])).toBeGreaterThan(10)
      expect(resolveToolbar({ offsetX: -1, offsetY: -10 })).toMatchObject({
        offsetX: -1,
        offsetY: -10,
      })
      const baseline = parseFloat(element.style[vertical]) - 8
      await w.setProps({ toolbar: { position, offsetX: -xSign, offsetY: -10 * ySign } })
      expect(element.style[position.endsWith('left') ? 'left' : 'right']).toBe('1px')
      expect(parseFloat(element.style[vertical])).toBe(Math.max(0, baseline - 10))
      await w.setProps({ toolbar: { position, offsetX: -10000 * xSign, offsetY: -10000 * ySign } })
      expect(element.style[position.endsWith('left') ? 'left' : 'right']).toBe('0px')
      expect(element.style[vertical]).toBe('0px')
      Object.defineProperties(element, {
        offsetWidth: { configurable: true, value: 240 },
        offsetHeight: { configurable: true, value: 22 },
      })
      const observer = resizeObservers.find((o) =>
        o.observe.mock.calls.some(([e]) => e === element),
      )!
      observer.resize(240, 22)
      await w.setProps({ toolbar: { position, offsetX: 10000 * xSign, offsetY: 10000 * ySign } })
      expect(
        parseFloat(element.style[position.endsWith('left') ? 'left' : 'right']),
      ).toBeLessThanOrEqual(558)
      expect(parseFloat(element.style[vertical]) + 22).toBeLessThanOrEqual(358)
      w.unmount()
      expect(observer.disconnect).toHaveBeenCalled()
    },
  )

  it('moves the default top-right toolbar left by exactly 200 pixels', async () => {
    const w = await mountSizedChart(gridSeries(1), { toolbar: { offsetX: 0, offsetY: 0 } })
    const element = w.get<HTMLElement>('[role="toolbar"]').element
    const before = parseFloat(element.style.right)
    await w.setProps({ toolbar: { offsetX: -200 } })
    expect(parseFloat(element.style.right) - before).toBe(200)
    w.unmount()
  })

  it('removes export menu and scope UI without changing the selected interaction mode', async () => {
    const w = await mountSizedChart(gridSeries(2), { toolbar: true, pannable: true })
    await w.get('[data-command="pan"]').trigger('click')
    await w.get('[data-command="export"]').trigger('click')
    expect(w.find('[aria-label="图片格式"]').exists()).toBe(true)
    await w.setProps({ toolbar: { position: 'bottom-left', offsetX: 8 } })
    expect(w.find('[aria-label="图片格式"]').exists()).toBe(true)
    await w.setProps({ toolbar: { items: ['reset'] } })
    expect(w.find('[aria-label="图片格式"]').exists()).toBe(false)
    expect(w.find('[data-command="pan"]').exists()).toBe(false)
    expect(w.vm.getControlState().mode).toBe('pan')
    expect(w.find('.waveform-toolbar select').exists()).toBe(false)
    await w.setProps({ displayMode: 'compact' })
    expect(w.get('[role="toolbar"]').text()).not.toContain('共享范围')
    await w.setProps({ toolbar: { items: [] } })
    expect(w.find('[role="toolbar"]').exists()).toBe(false)
    expect(w.vm.setInteractionMode('zoom').status).toBe('applied')
    w.unmount()
  })

  it('applies toolbar commands to the current page while retaining off-page viewports', async () => {
    const w = await mountSizedChart(gridSeries(4), {
      toolbar: true,
      animation: { enabled: false },
      grid: { rowCount: 2, columnCount: 1 },
      xDomainStrategy: { type: 'data' },
      minVisiblePoints: 1,
      integerZoom: false,
    })
    w.vm.setViewportDomain([0.2, 0.8], { trackId: 'channel-0' })
    await flushPromises()
    const before = w.vm.getControlState().targets.map((t) => t.viewport)
    await w.get('.ant-pagination-next button').trigger('click')
    await flushPromises()
    await w.get('[data-command="zoom-in"]').trigger('click')
    expect(w.vm.getControlState().targets.map((t) => t.trackId)).toEqual(['channel-2', 'channel-3'])
    for (const target of w.vm.getControlState().targets) {
      expect(target.viewport.xDomain[1] - target.viewport.xDomain[0]).toBeLessThan(1)
    }
    await w.get('[data-command="reset"]').trigger('click')
    await w.get('[data-command="fit"]').trigger('click')
    await w.get('.ant-pagination-prev button').trigger('click')
    await flushPromises()
    expect(w.vm.getControlState().targets.map((t) => t.viewport)).toEqual(before)
    await w.setProps({ data: gridSeries(4) })
    await flushPromises()
    await w.get('.ant-pagination-next button').trigger('click')
    await flushPromises()
    expect(w.vm.getControlState().targets.map((t) => t.viewport.xDomain)).toEqual([
      [0, 1],
      [0, 1],
    ])
    w.unmount()
  })
})
