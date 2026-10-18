import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import ControlExamplePage from '../../src/controls/ControlExamplePage.vue'
import { createExample } from '../../src/controls/example'
import { routes } from '../../src/router'

afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
  localStorage.clear()
})

describe('independent control demo pages', () => {
  it('redirects the old URL and resolves six distinct lazy pages', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/controls')
    expect(router.currentRoute.value.path).toBe('/controls/input-number')
    const pages = new Set()
    for (const slug of ['input-number', 'select', 'color-picker', 'pagination', 'modal', 'popup']) {
      await router.push(`/controls/${slug}`)
      expect(router.currentRoute.value.name).toBe(`controls-${slug}`)
      pages.add(router.currentRoute.value.matched[0].components?.default)
    }
    expect(pages.size).toBe(6)
  })

  it('changes the example theme without remounting and disposes once when leaving', async () => {
    const control = { setTheme: vi.fn(), dispose: vi.fn() }
    const attach = vi.fn(() => control)
    const wrapper = mount(ControlExamplePage, {
      props: { title: 'Test', description: 'Demo', source: 'example source', mount: attach },
    })
    expect(attach).toHaveBeenCalledTimes(1)
    expect(control.setTheme).toHaveBeenLastCalledWith('auto')
    const select = wrapper.get('[aria-label="示例主题"]')
    await select.setValue('dark')
    expect(control.setTheme).toHaveBeenLastCalledWith('dark')
    await select.setValue('light')
    expect(control.setTheme).toHaveBeenLastCalledWith('light')
    await select.setValue('global')
    expect(control.setTheme).toHaveBeenLastCalledWith('auto')
    expect(attach).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    expect(control.dispose).toHaveBeenCalledTimes(1)
  })

  it('removes demo handlers and disposes nested instances in reverse ownership order', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const example = createExample(host)
    const order: number[] = []
    example.own({ setTheme: vi.fn(), dispose: () => order.push(1) })
    example.own({ setTheme: vi.fn(), dispose: () => order.push(2) })
    const clicked = vi.fn()
    const button = example.button(example.section('Test', 'Demo'), 'Click', clicked)
    button.click()
    example.dispose()
    button.click()
    example.dispose()
    expect(clicked).toHaveBeenCalledTimes(1)
    expect(order).toEqual([2, 1])
    expect(host.childElementCount).toBe(0)
  })
})
