import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { provideTheme, themeStorageKey, useTheme, useThemeColor } from '@demo/theme/useTheme'

const wrappers: Array<ReturnType<typeof mount>> = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function setup(saved?: string) {
  localStorage.clear()
  if (saved) localStorage.setItem(themeStorageKey, saved)
  const media = new EventTarget() as EventTarget & { matches: boolean }
  media.matches = false
  const remove = vi.spyOn(media, 'removeEventListener')
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  )
  let root!: ReturnType<typeof provideTheme>
  let child!: ReturnType<typeof useTheme>
  const Consumer = defineComponent({
    setup() {
      child = useTheme()
      return () => h('span', child.dark.value ? 'dark' : 'light')
    },
  })
  const wrapper = mount(
    defineComponent({
      setup() {
        root = provideTheme()
        return () => h(Consumer)
      },
    }),
  )
  wrappers.push(wrapper)
  return {
    root,
    get child() {
      return child
    },
    media,
    remove,
    wrapper,
  }
}

it('shares one preference with descendants, restores it and persists changes', async () => {
  const { root, child } = setup('dark')
  expect(child).toBe(root)
  expect(document.documentElement.dataset.theme).toBe('dark')
  root.preference.value = 'light'
  await nextTick()
  expect(child.dark.value).toBe(false)
  expect(document.documentElement.dataset.theme).toBe('light')
  expect(localStorage.getItem(themeStorageKey)).toBe('light')
})

it('follows system changes only in system mode and removes its listener on disposal', async () => {
  const { root, media, remove, wrapper } = setup('invalid')
  expect(root.preference.value).toBe('system')
  media.matches = true
  media.dispatchEvent(new Event('change'))
  await nextTick()
  expect(root.dark.value).toBe(true)
  root.preference.value = 'light'
  await nextTick()
  media.dispatchEvent(new Event('change'))
  expect(root.dark.value).toBe(false)
  root.preference.value = 'system'
  await nextTick()
  expect(root.dark.value).toBe(true)
  wrapper.unmount()
  wrappers.pop()
  expect(remove).toHaveBeenCalledWith('change', expect.any(Function))
})

it('keeps working when storage is unavailable', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  const { root } = setup()
  root.preference.value = 'dark'
  await nextTick()
  expect(document.documentElement.dataset.theme).toBe('dark')
})

it('updates defaults but preserves explicit colors, including a write equal to the default', () => {
  const dark = ref(false)
  const untouched = useThemeColor(dark, '#ffffff', '#000000')
  const custom = useThemeColor(dark, '#ffffff', '#000000')
  const sameAsDefault = useThemeColor(dark, '#ffffff', '#000000')
  custom.value = '#123456'
  sameAsDefault.value = '#ffffff'
  dark.value = true
  expect(untouched.value).toBe('#000000')
  expect(custom.value).toBe('#123456')
  expect(sameAsDefault.value).toBe('#ffffff')
  dark.value = false
  expect(untouched.value).toBe('#ffffff')
  expect(custom.value).toBe('#123456')
})
