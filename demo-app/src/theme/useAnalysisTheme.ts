import { computed } from 'vue'
import { useTheme } from './useTheme'

export function useAnalysisTheme() {
  const { dark } = useTheme()
  return {
    controlTheme: computed(() => (dark.value ? ('dark' as const) : ('light' as const))),
    frameStyle: computed(() => ({ borderColor: dark.value ? '#94a3b8' : '#1f2937' })),
    legendBackground: computed(() =>
      dark.value ? 'rgba(17, 24, 39, 0.85)' : 'rgba(255, 255, 255, 0.8)',
    ),
    titleTextStyle: computed(() => ({ color: dark.value ? '#f1f5f9' : '#1f2937' })),
  }
}
