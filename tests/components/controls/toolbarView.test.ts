import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { mountSizedChart, gridSeries } from '@tests/support/waveformChart'
import { resizeObservers } from '@tests/support/setup'
import type { WaveformChartController } from '@/components/core/useWaveformChartController'
import WaveformChartView from '@/components/WaveformChartView.vue'

describe('toolbar view interaction', () => {
  it('preserves narrow-container grouping and keyboard menu escape', async () => {
    const w = await mountSizedChart(gridSeries(3), {
      toolbar: true,
      pannable: true,
      grid: { rowCount: 2, columnCount: 1 },
    })
    resizeObservers.at(-1)?.resize(360, 500)
    await flushPromises()
    expect(w.get('[aria-label="图表工具"]').attributes('aria-expanded')).toBe('false')
    await w.get('[aria-label="图表工具"]').trigger('click')
    expect(w.findAll('.waveform-toolbar__group')).toHaveLength(3)
    await w.get('[data-command="export"]').trigger('click')
    expect(w.find('[aria-label="图片格式"]').exists()).toBe(true)
    await w.get('[role="toolbar"]').trigger('keydown', { key: 'Escape' })
    expect(w.find('[aria-label="图片格式"]').exists()).toBe(false)
    expect(w.get('[aria-label="图表工具"]').attributes('aria-expanded')).toBe('false')
    await w.get('[aria-label="操作图框"]').setValue('channel-1')
    await w.setProps({ grid: { rowCount: 1, columnCount: 1 } })
    expect((w.get('select').element as HTMLSelectElement).value).toBe('')
    w.unmount()
  })
  it('reports export errors and then downloads with cleanup', async () => {
    const w = await mountSizedChart(gridSeries(1), { toolbar: true })
    const controller = w
      .getComponent(WaveformChartView)
      .props('controller') as WaveformChartController
    const generate = vi
      .spyOn(controller, 'exportImage')
      .mockRejectedValueOnce(new Error('导出测试失败'))
    await w.get('[data-command="export"]').trigger('click')
    await w.get('[aria-label="图片格式"] button').trigger('click')
    await flushPromises()
    expect(w.get('[role="status"]').text()).toBe('导出测试失败')
    expect(w.get('[data-command="export"]').attributes('disabled')).toBeUndefined()
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:download')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    generate.mockResolvedValue(new Blob(['svg']))
    await w.get('[data-command="export"]').trigger('click')
    await w.findAll('[aria-label="图片格式"] button')[1]!.trigger('click')
    await flushPromises()
    expect(generate).toHaveBeenLastCalledWith({ format: 'svg' })
    expect(click).toHaveBeenCalledOnce()
    expect(revoke).toHaveBeenCalledWith('blob:download')
    expect(document.querySelector('a[download]')).toBeNull()
    create.mockRestore()
    revoke.mockRestore()
    click.mockRestore()
    generate.mockRestore()
    w.unmount()
  })
})
