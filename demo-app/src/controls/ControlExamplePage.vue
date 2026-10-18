<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ControlTheme } from 'waveform-analysis/input-number'
import { useTheme } from '../theme/useTheme'
import type { ControlExample, MountExample } from './example'
import lifecycleSource from './example.ts?raw'
import './examples.css'

const props = defineProps<{
  title: string
  description: string
  source: string
  mount: MountExample
}>()
const host = ref<HTMLElement>()
const message = ref('操作组件，查看当前值和事件反馈。')
const override = ref<'global' | ControlTheme>('global')
const { preference } = useTheme()
const theme = computed<ControlTheme>(() =>
  override.value === 'global'
    ? preference.value === 'system'
      ? 'auto'
      : preference.value
    : override.value,
)
let example: ControlExample | undefined
onMounted(() => {
  example = props.mount(host.value!, (value) => {
    message.value = value
  })
  example.setTheme(theme.value)
})
watch(theme, (value) => example?.setTheme(value))
onBeforeUnmount(() => {
  example?.dispose()
  example = undefined
})
</script>

<template>
  <main class="control-example">
    <header>
      <p class="control-example__eyebrow">基础组件 / 使用示例</p>
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
      <label class="control-example__theme"
        >示例主题
        <select v-model="override" aria-label="示例主题">
          <option value="global">跟随顶部设置</option>
          <option value="auto">跟随系统</option>
          <option value="light">浅色</option>
          <option value="dark">深色</option>
        </select>
      </label>
    </header>
    <div ref="host" class="control-example__grid" />
    <p class="control-example__status" role="status" aria-live="polite">{{ message }}</p>
    <details class="control-example__source">
      <summary>查看使用代码</summary>
      <pre><code>{{ source }}</code></pre>
      <details>
        <summary>示例生命周期辅助代码（主题更新与销毁）</summary>
        <pre><code>{{ lifecycleSource }}</code></pre>
      </details>
    </details>
  </main>
</template>
