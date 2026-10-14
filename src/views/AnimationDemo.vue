<script setup lang="ts">
import { ref } from 'vue'
import { WaveformChart } from '@/index'
import type {
  AnnotationAnimationType,
  LineDrawingDirection,
  WaveformData,
  WaveformAnnotation,
} from '@/index'

const enabled = ref(true)
const enter = ref(true)
const update = ref(true)
const annotationEnabled = ref(true)
const effect = ref<AnnotationAnimationType>('scale')
const gridShape = ref('1x1')
const direction = ref<LineDrawingDirection>('left-to-right')
let generation = 0
function generate(count = 500): WaveformData {
  return {
    kind: 'series',
    series: Array.from({ length: 3 }, (_, channel) => ({
      id: channel === 0 ? 'signal' : `signal-${channel}`,
      name: `信号 ${channel + 1}`,
      data: {
        kind: 'points' as const,
        points: Array.from({ length: count }, (_, i) => ({
          x: i / (count - 1),
          y: Math.sin((i / (count - 1)) * Math.PI * 6 + channel) * (10 + generation * 2),
        })),
      },
    })),
  }
}
const data = ref(generate())
const annotations = ref<WaveformAnnotation[]>([])
const key = ref(0)
function replace(compatible: boolean) {
  generation++
  data.value = generate(compatible ? 500 : 750)
}
function toggleAnnotation() {
  annotations.value = annotations.value.length
    ? []
    : Array.from({ length: 3 }, (_, channel) => ({
        id: channel === 0 ? 'note' : `note-${channel}`,
        seriesId: channel === 0 ? 'signal' : `signal-${channel}`,
        x: 0.4,
        y: 10,
        text: '受控标注',
      }))
}
</script>

<template>
  <main class="animation-demo">
    <h1>波形动画</h1>
    <p>
      分别控制入场、更新和标注效果。分页与网格调整重播波形绘制，标注等待对应系列完成，
      坐标轴立即更新。拖动、缩放与导出会提交最终画面。
    </p>
    <div class="animation-demo__controls">
      <label><input v-model="enabled" type="checkbox" /> 动画</label>
      <label><input v-model="enter" type="checkbox" /> 入场 / 切页 / 网格</label>
      <label><input v-model="update" type="checkbox" /> 更新</label>
      <label><input v-model="annotationEnabled" type="checkbox" /> 标注</label>
      <label
        >入场方向
        <select v-model="direction">
          <option value="left-to-right">从左向右</option>
          <option value="right-to-left">从右向左</option>
          <option value="center-out">从中心展开</option>
        </select></label
      >
      <label
        >标注效果
        <select v-model="effect">
          <option value="fade-in">淡入</option>
          <option value="scale">缩放</option>
          <option value="slide-in">滑入</option>
          <option value="bounce">弹跳</option>
        </select></label
      >
      <label
        >网格
        <select v-model="gridShape" aria-label="网格">
          <option value="1x1">1×1</option>
          <option value="1x2">1×2</option>
          <option value="2x2">2×2</option>
        </select>
      </label>
      <button @click="key++">重新入场</button>
      <button @click="replace(true)">更新振幅</button>
      <button @click="replace(false)">改变点数</button>
      <button @click="toggleAnnotation">增删标注</button>
    </div>
    <WaveformChart
      :key="key"
      :data="data"
      :height="360"
      :grid="{ rowCount: Number(gridShape[0]), columnCount: Number(gridShape[2]) }"
      :animation-enabled="enabled"
      :animation="{ enabled: enter, direction }"
      :animation-update="{ enabled: update }"
      :animation-annotation="{ enabled: annotationEnabled, type: effect }"
      :annotations="annotations"
      @update:annotations="annotations = $event"
    />
  </main>
</template>

<style scoped>
.animation-demo {
  padding: 24px;
  max-width: 1280px;
  margin: auto;
}
.animation-demo__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}
.animation-demo__controls label {
  display: flex;
  align-items: center;
  gap: 4px;
}
button,
select {
  padding: 6px;
}
@media (max-width: 520px) {
  .animation-demo {
    padding: 8px;
  }
}
</style>
