import { computed, inject, onScopeDispose, provide, ref, watch, type InjectionKey } from 'vue'
import { theme } from 'ant-design-vue'

export type ThemePreference = 'system' | 'light' | 'dark'
export const themeStorageKey = 'waveform-demo-theme'
function createTheme() {
  const preference = ref<ThemePreference>('system')
  try {
    const saved = localStorage.getItem(themeStorageKey)
    if (saved === 'light' || saved === 'dark') preference.value = saved
  } catch {
    /* Storage can be unavailable in embedded previews. */
  }
  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  const systemDark = ref(media?.matches ?? false)
  const update = () => {
    systemDark.value = media?.matches ?? false
  }
  media?.addEventListener('change', update)
  onScopeDispose(() => media?.removeEventListener('change', update))
  const dark = computed(
    () => preference.value === 'dark' || (preference.value === 'system' && systemDark.value),
  )
  const config = computed(() => ({
    algorithm: dark.value ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: { colorPrimary: dark.value ? '#2dd4bf' : '#087f6b', borderRadius: 5 },
  }))
  watch(preference, (value) => {
    try {
      localStorage.setItem(themeStorageKey, value)
    } catch {
      /* Keep the in-memory preference. */
    }
  })
  return { preference, dark, config }
}

const themeKey: InjectionKey<ReturnType<typeof createTheme>> = Symbol('demo-theme')

export function provideTheme() {
  const state = createTheme()
  provide(themeKey, state)
  const root = document.documentElement
  const previous = root.getAttribute('data-theme')
  watch(
    state.dark,
    (dark) => {
      root.dataset.theme = dark ? 'dark' : 'light'
    },
    { immediate: true },
  )
  onScopeDispose(() => {
    if (previous === null) root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', previous)
  })
  return state
}

export function useTheme() {
  return inject(themeKey, undefined) ?? createTheme()
}

/** Only consumer writes create an override, even when equal to the current default. */
export function useThemeColor(dark: { readonly value: boolean }, light: string, night: string) {
  const override = ref<string>()
  return computed({
    get: () => override.value ?? (dark.value ? night : light),
    set: (value: string) => {
      override.value = value
    },
  })
}
