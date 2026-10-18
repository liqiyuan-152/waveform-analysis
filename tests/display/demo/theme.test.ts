// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, effectScope, h, nextTick } from 'vue'
import { provideTheme } from '../../../demo-app/src/theme/useTheme'
import { mount } from '@vue/test-utils'
import App from '../../../demo-app/src/display/App.vue'
import { themeStorageKey, useTheme } from '../../../demo-app/src/display/composables/useTheme'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  document.body.replaceChildren()
})

describe('demo theme', () => {
  it('follows system changes only in automatic mode, persists choice and cleans up', async () => {
    let listener: (() => void) | undefined
    const media = {
      matches: false,
      addEventListener: vi.fn((_event, callback) => {
        listener = callback
      }),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('matchMedia', () => media)
    const scope = effectScope()
    const state = scope.run(useTheme)!
    expect(state.preference.value).toBe('system')
    expect(state.dark.value).toBe(false)
    media.matches = true
    listener!()
    expect(state.dark.value).toBe(true)
    state.preference.value = 'light'
    await nextTick()
    expect(localStorage.getItem(themeStorageKey)).toBe('light')
    listener!()
    expect(state.dark.value).toBe(false)
    scope.stop()
    expect(media.removeEventListener).toHaveBeenCalledWith('change', listener)
    const restored = effectScope()
    expect(restored.run(useTheme)!.preference.value).toBe('light')
    restored.stop()
  })

  it('falls back to system when stored preference is invalid or storage is unavailable', () => {
    localStorage.setItem(themeStorageKey, 'invalid')
    const scope = effectScope()
    expect(scope.run(useTheme)!.preference.value).toBe('system')
    scope.stop()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('unavailable')
    })
    const blocked = effectScope()
    expect(blocked.run(useTheme)!.preference.value).toBe('system')
    blocked.stop()
  })

  it('syncs the SVG with the global theme while preserving waveform geometry', async () => {
    let state!: ReturnType<typeof provideTheme>
    const Host = defineComponent({
      setup() {
        state = provideTheme()
        state.preference.value = 'light'
        return () => h(App)
      },
    })
    const wrapper = mount(Host, { attachTo: document.body })
    await nextTick()
    await nextTick()
    // Finish entrance animation before comparing presentation geometry.
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '结束动画')!
      .trigger('click')
    const svg = wrapper.find('svg.waveform-svg').exists()
      ? wrapper.find('svg.waveform-svg')
      : wrapper.find('.waveform-preview svg')
    const element = svg.element
    expect(element.querySelector('.waveform-frame-background')?.getAttribute('fill')).toBe(
      '#ffffff',
    )
    const geometry = () =>
      [...element.querySelectorAll('path')].map((path) => path.getAttribute('d'))
    const before = geometry()
    for (const preference of ['dark', 'light', 'system'] as const) {
      state.preference.value = preference
      await nextTick()
      expect(wrapper.find('.waveform-preview svg').element).toBe(element)
      expect(element.querySelector('.waveform-frame-background')?.getAttribute('fill')).toBe(
        preference === 'dark' ? '#000000' : '#ffffff',
      )
      expect(geometry()).toEqual(before)
      if (preference !== 'system')
        expect(wrapper.find('main').attributes('data-theme')).toBe(
          preference === 'dark' ? 'dark' : 'light',
        )
    }
    wrapper.unmount()
  })
})
