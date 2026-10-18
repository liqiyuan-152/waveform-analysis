// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AnimationPanel from '../../../demo-app/src/display/components/AnimationPanel.vue'
import { resolveOptions } from '../../../src/display/config/resolve'

describe('animation panel', () => {
  it('keeps every parameter and action wired across the three categories', async () => {
    const wrapper = mount(AnimationPanel, {
      props: { options: resolveOptions({ animationEnabled: true }), replayDisabled: false },
    })
    await wrapper.find('[aria-label="启用动画（影响后续数据更新）"]').trigger('click')
    expect(wrapper.emitted('field')?.slice(-1)[0]).toEqual(['animationEnabled', false])
    await wrapper.find('input[aria-label="入场时长（ms）"]').setValue('1500')
    expect(wrapper.emitted('field')?.slice(-1)[0]).toEqual(['animation.duration', 1500])
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '重播入场')!
      .trigger('click')
    expect(wrapper.emitted('replay')).toHaveLength(1)
    await wrapper
      .findAll('[role=tab]')
      .find((tab) => tab.text() === '更新动画')!
      .trigger('click')
    await wrapper.find('input[aria-label="更新时长（ms）"]').setValue('700')
    expect(wrapper.emitted('field')?.slice(-1)[0]).toEqual(['animationUpdate.duration', 700])
    await wrapper
      .findAll('[role=tab]')
      .find((tab) => tab.text() === '数据场景')!
      .trigger('click')
    for (const button of wrapper.findAll('.scenario-buttons button')) await button.trigger('click')
    expect(wrapper.emitted('scenario')).toEqual([
      ['append'],
      ['window'],
      ['domain'],
      ['extreme'],
      ['auto-padding'],
    ])
    for (const button of wrapper.findAll('.animation-actions button')) await button.trigger('click')
    expect(wrapper.emitted('control')).toEqual([['pause'], ['resume'], ['finish']])
    await wrapper
      .findAll('[role=tab]')
      .find((tab) => tab.text() === '入场动画')!
      .trigger('click')
    wrapper.unmount()
    const disabled = mount(AnimationPanel, {
      props: { options: resolveOptions({ animationEnabled: true }), replayDisabled: true },
    })
    expect(
      disabled
        .findAll('button')
        .find((button) => button.text() === '重播入场')!
        .attributes('disabled'),
    ).toBeDefined()
    disabled.unmount()
  })
})
