import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { WaveformChart } from '../components'
import { routes } from '../router'
import FixedYDomainDemo from './FixedYDomainDemo.vue'

describe('fixed Y-domain demo route', () => {
  it('registers the example route', () => {
    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/fixed-y-domain',
          name: 'fixed-y-domain',
        }),
      ]),
    )
  })

  it('switches between global, automatic, and per-channel ranges', async () => {
    const wrapper = mount(FixedYDomainDemo)
    await flushPromises()
    const chart = () => wrapper.getComponent(WaveformChart)
    const modeInputs = wrapper.get('[aria-label="Y 轴范围模式"]').findAll('input[type="radio"]')

    expect(chart().props('yDomain')).toEqual([-80, 80])
    expect(chart().props('yDomains')).toBeUndefined()

    await modeInputs[0]?.setValue(true)
    await flushPromises()
    expect(chart().props('yDomain')).toBeUndefined()
    expect(chart().props('yDomains')).toBeUndefined()

    await modeInputs[2]?.setValue(true)
    await flushPromises()
    expect(chart().props('yDomain')).toBeUndefined()
    expect(chart().props('yDomains')).toEqual({
      voltage: [-65, 65],
      current: [-260, 260],
    })

    wrapper.unmount()
  })
})
