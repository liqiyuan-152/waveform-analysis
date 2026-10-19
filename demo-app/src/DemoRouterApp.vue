<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ConfigProvider, Menu, Segmented } from 'ant-design-vue'
import { provideTheme } from './theme/useTheme'
import { useRoute } from 'vue-router'

const { preference, config } = provideTheme()
const themeOptions = [
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
  { label: '跟随系统', value: 'system' },
]
const route = useRoute()
const { Item: MenuItem, SubMenu } = Menu
const selectedKeys = computed(() => [route.path])
const openKeys = ref<string[]>([])
const controlLinks = [
  ['input-number', 'Input Number 数字输入框'],
  ['select', 'Select 选择器'],
  ['color-picker', 'Color Picker 颜色选择器'],
  ['pagination', 'Pagination 分页'],
  ['modal', 'Modal 模态弹窗'],
  ['popup', 'Popup 定位浮层'],
]
function closeMenus() {
  openKeys.value = []
}
watch(() => route.path, closeMenus)
</script>

<template>
  <ConfigProvider :theme="config">
    <div class="demo-shell">
      <header class="demo-shell__header">
        <RouterLink class="demo-shell__brand" to="/">Waveform Components</RouterLink>
        <nav class="demo-shell__nav" aria-label="示例导航">
          <Menu
            v-model:open-keys="openKeys"
            class="demo-shell__navigation"
            mode="horizontal"
            :selected-keys="selectedKeys"
            trigger-sub-menu-action="click"
            @click="closeMenus"
          >
            <SubMenu key="analysis" title="波形分析">
              <MenuItem key="/"><RouterLink to="/">波形分析</RouterLink></MenuItem>
              <MenuItem key="/fixed-y-domain">
                <RouterLink to="/fixed-y-domain">固定振幅</RouterLink>
              </MenuItem>
              <MenuItem key="/animation">
                <RouterLink to="/animation">范围动画</RouterLink>
              </MenuItem>
              <MenuItem key="/wasm-sampling">
                <RouterLink to="/wasm-sampling">WASM 采样</RouterLink>
              </MenuItem>
            </SubMenu>
            <MenuItem key="/display"><RouterLink to="/display">波形展示</RouterLink></MenuItem>
            <SubMenu key="controls" title="基础组件">
              <MenuItem v-for="[slug, label] in controlLinks" :key="`/controls/${slug}`">
                <RouterLink :to="`/controls/${slug}`">{{ label }}</RouterLink>
              </MenuItem>
            </SubMenu>
          </Menu>
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
