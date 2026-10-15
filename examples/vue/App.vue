<script setup lang="ts">
import { computed, ref } from 'vue'
import { exampleData } from '../shared/data'
import { diagnostics } from '../shared/diagnostics'
import WaveformDemo from './WaveformDemo.vue'

const version = ref(0)
const callbackVersion = ref(0)
const mounted = ref(true)
const narrow = ref(false)
const second = ref(false)
const data = computed(() => exampleData(version.value))
</script>

<template>
  <h1>Vue DOM ref 示例</h1>
  <div class="example-controls">
    <button @click="version++">替换数据</button>
    <button @click="callbackVersion++">更新回调</button>
    <button @click="narrow = !narrow">切换宽度</button>
    <button @click="mounted = !mounted">挂载 / 卸载</button>
    <button @click="second = !second">第二个图表</button>
  </div>
  <WaveformDemo
    v-if="mounted"
    :data="data"
    :narrow="narrow"
    :on-rendered="() => diagnostics.rendered(callbackVersion)"
  />
  <WaveformDemo
    v-if="second"
    :data="data"
    :narrow="narrow"
    :on-rendered="() => diagnostics.rendered(callbackVersion)"
  />
</template>
