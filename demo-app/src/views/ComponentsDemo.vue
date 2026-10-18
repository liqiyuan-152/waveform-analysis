<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { WaveformChartInstance } from 'waveform-analysis/analysis'
import type { Waveform } from 'waveform-analysis/display'
import { mountAnalysis } from '../examples/analysisExample'
import { mountDisplay } from '../examples/displayExample'
import analysisSource from '../examples/analysisExample.ts?raw'
import displaySource from '../examples/displayExample.ts?raw'
import ExampleSource from '../demo/ExampleSource.vue'

const analysisHost = ref<HTMLElement>()
const displayHost = ref<HTMLElement>()
const mounted = ref(true)
const paused = ref(false)
const animationEnabled = ref(true)
let analysis: WaveformChartInstance | undefined
let display: Waveform | undefined
let version = 0
function attach() {
  if (analysisHost.value) analysis = mountAnalysis(analysisHost.value)
  if (displayHost.value) display = mountDisplay(displayHost.value)
  mounted.value = true
  paused.value = false
  animationEnabled.value = true
}
function detach() {
  analysis?.dispose()
  display?.destroy()
  analysis = undefined
  display = undefined
  mounted.value = false
}
function update(target: 'analysis' | 'display') {
  version++
  const values = Array.from({ length: 200 }, (_, i) => Math.sin(i / 12 + version))
  if (target === 'analysis')
    analysis?.setOption({ data: { kind: 'samples', values, sampleRate: 100 } })
  else display?.updateData(values.map((y, i) => ({ x: i / 100, y })))
}
function togglePause() {
  if (paused.value) display?.animation.resume()
  else display?.animation.pause()
  paused.value = !paused.value
}
function toggleAnalysis() {
  animationEnabled.value = !animationEnabled.value
  analysis?.setOption({ animationEnabled: animationEnabled.value })
}
onMounted(attach)
onBeforeUnmount(detach)
</script>
<template>
  <main class="component-examples">
    <header>
      <h1>双组件示例</h1>
      <p>两个组件使用独立容器和状态，可分别更新。分析使用动画开关，展示提供暂停与恢复。</p>
      <button @click="mounted ? detach() : attach()">
        {{ mounted ? '卸载两个组件' : '重新挂载' }}
      </button>
    </header>
    <section>
      <ExampleSource
        title="波形分析"
        description="原生分析实例：setOption 更新，dispose 释放。"
        :source="analysisSource"
      />
      <div class="example-actions">
        <button :disabled="!mounted" @click="update('analysis')">更新分析数据</button>
        <button :disabled="!mounted" @click="toggleAnalysis">
          {{ animationEnabled ? '关闭分析动画' : '启用分析动画' }}
        </button>
      </div>
      <div ref="analysisHost" class="example-chart" />
    </section>
    <section>
      <ExampleSource
        title="波形展示"
        description="原生展示实例：updateData 更新，animation 控制动画，destroy 释放。"
        :source="displaySource"
      />
      <div class="example-actions">
        <button :disabled="!mounted" @click="update('display')">更新展示数据</button>
        <button :disabled="!mounted" @click="togglePause">
          {{ paused ? '恢复展示动画' : '暂停展示动画' }}
        </button>
      </div>
      <div ref="displayHost" class="example-chart" />
    </section>
  </main>
</template>
<style scoped>
.component-examples {
  padding: 16px;
  display: grid;
  gap: 16px;
}
header,
section {
  min-width: 0;
  background: white;
}
.example-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 16px;
}
.example-chart {
  height: 320px;
  min-width: 0;
}
button {
  cursor: pointer;
  padding: 6px 12px;
}
</style>
