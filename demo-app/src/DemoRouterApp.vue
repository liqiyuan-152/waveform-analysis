<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { ConfigProvider, Segmented } from 'ant-design-vue'
import { provideTheme } from './theme/useTheme'
import { useRoute } from 'vue-router'

const { preference, config } = provideTheme()
const themeOptions = [
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
  { label: '跟随系统', value: 'system' },
]
const route = useRoute()
const analysisMenu = ref<HTMLDetailsElement>()
const analysisActive = computed(() =>
  ['/', '/fixed-y-domain', '/animation', '/wasm-sampling'].includes(route.path),
)
const controlsMenu = ref<HTMLDetailsElement>()
const navigation = ref<HTMLElement>()
const controlsActive = computed(() => route.path.startsWith('/controls/'))
const controlLinks = [
  ['input-number', 'Input Number 数字输入框'],
  ['select', 'Select 选择器'],
  ['color-picker', 'Color Picker 颜色选择器'],
  ['pagination', 'Pagination 分页'],
  ['modal', 'Modal 模态弹窗'],
  ['popup', 'Popup 定位浮层'],
]
function closeMenus() {
  for (const menu of [analysisMenu.value, controlsMenu.value]) if (menu) menu.open = false
}
function toggleMenu(event: Event) {
  const current = event.currentTarget as HTMLDetailsElement
  if (!current.open) return
  for (const menu of [analysisMenu.value, controlsMenu.value])
    if (menu && menu !== current) menu.open = false
}
function dismissMenu(event: FocusEvent) {
  const menu = event.currentTarget as HTMLDetailsElement
  if (!menu.contains(event.relatedTarget as Node | null)) menu.open = false
}
function escapeMenu(event: KeyboardEvent) {
  const menu = event.currentTarget as HTMLDetailsElement
  menu.open = false
  menu.querySelector('summary')?.focus()
}
function outside(event: PointerEvent) {
  if (!navigation.value?.contains(event.target as Node)) closeMenus()
}
onMounted(() => document.addEventListener('pointerdown', outside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
watch(() => route.path, closeMenus)
</script>

<template>
  <ConfigProvider :theme="config">
    <div class="demo-shell">
      <header class="demo-shell__header">
        <RouterLink class="demo-shell__brand" to="/">Waveform Components</RouterLink>
        <nav ref="navigation" class="demo-shell__nav" aria-label="示例导航">
          <details
            ref="analysisMenu"
            class="demo-shell__menu"
            @focusout="dismissMenu"
            @toggle="toggleMenu"
            @keydown.esc="escapeMenu"
          >
            <summary :class="{ 'is-active': analysisActive }">波形分析</summary>
            <div class="demo-shell__submenu" @click="closeMenus">
              <RouterLink to="/">波形分析</RouterLink>
              <RouterLink to="/fixed-y-domain">固定振幅</RouterLink>
              <RouterLink to="/animation">范围动画</RouterLink>
              <RouterLink to="/wasm-sampling">WASM 采样</RouterLink>
            </div>
          </details>
          <RouterLink to="/display">波形展示</RouterLink>
          <details
            ref="controlsMenu"
            class="demo-shell__menu demo-shell__menu--controls"
            @focusout="dismissMenu"
            @toggle="toggleMenu"
            @keydown.esc="escapeMenu"
          >
            <summary :class="{ 'is-active': controlsActive }">基础组件</summary>
            <div class="demo-shell__submenu" @click="closeMenus">
              <RouterLink
                v-for="[slug, label] in controlLinks"
                :key="slug"
                :to="`/controls/${slug}`"
                >{{ label }}</RouterLink
              >
            </div>
          </details>
        </nav>
        <div class="demo-shell__theme">
          <Segmented
            class="demo-shell__theme-wide"
            v-model:value="preference"
            :options="themeOptions"
            aria-label="界面主题"
          />
          <select class="demo-shell__theme-compact" v-model="preference" aria-label="界面主题">
            <option v-for="option in themeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
      </header>
      <div class="demo-shell__content">
        <RouterView />
      </div>
    </div>
  </ConfigProvider>
</template>
