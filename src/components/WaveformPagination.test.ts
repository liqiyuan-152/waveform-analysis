import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import WaveformPagination from './WaveformPagination.vue'

describe('WaveformPagination', () => {
  it('renders all pages and disables the first-page previous button', () => {
    const wrapper = mount(WaveformPagination, { props: { current: 1, pageCount: 3 } })

    expect(wrapper.findAll('.waveform-pagination__page').map((page) => page.text())).toEqual([
      '1',
      '2',
      '3',
    ])
    expect(wrapper.get('[aria-label="上一页"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[aria-current="page"]').text()).toBe('1')
  })

  it('uses ellipses for larger page counts and emits valid page changes', async () => {
    const wrapper = mount(WaveformPagination, { props: { current: 5, pageCount: 12 } })

    expect(wrapper.findAll('.waveform-pagination__page').map((page) => page.text())).toEqual([
      '1',
      '4',
      '5',
      '6',
      '12',
    ])
    expect(wrapper.findAll('.waveform-pagination__ellipsis')).toHaveLength(2)

    await wrapper.get('[aria-label="第 6 页"]').trigger('click')
    expect(wrapper.emitted('change')).toEqual([[6]])
  })

  it('clamps invalid current values and does not emit when already at a boundary', async () => {
    const wrapper = mount(WaveformPagination, { props: { current: 99, pageCount: 3 } })

    expect(wrapper.get('[aria-current="page"]').text()).toBe('3')
    await wrapper.get('[aria-label="下一页"]').trigger('click')
    expect(wrapper.emitted('change')).toBeUndefined()
  })
})
