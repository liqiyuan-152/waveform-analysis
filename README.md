# Waveform Analysis

基于 Vue 3、TypeScript 和 D3 的响应式波形图组件库与示例项目。

组件使用 SVG 绘制坐标轴和波形；大数据会按当前可见范围和屏幕像素自动保峰降采样，
tooltip 与标注仍使用完整原始数据。

## 开始使用

```bash
pnpm install
pnpm dev
```

## 常用命令

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:coverage
pnpm build
```

`pnpm build` 同时生成 `dist` 组件库产物和 `dist-demo` 演示应用。正式公开入口为
`src/index.ts`；发布后使用包入口：

```ts
import { WaveformChart, type WaveformData } from 'waveform-analysis'
import 'waveform-analysis/style.css'
```

Vue、D3、Ant Design Vue 和 vue3-colorpicker 是 peer dependencies，需要由使用方安装。
`WaveformChart` 支持采样值与采样率，也支持显式的 `{ x, y }[]` 点数组。

## 波形图

组件内置缩放、悬浮取点和 tooltip。调用方只需要提供波形数据：

```vue
<script setup lang="ts">
import { WaveformChart } from './index'
</script>

<template>
  <WaveformChart :data="chartData" />
</template>
```

多通道数据应为每个 `WaveformSeries` 提供稳定的 `id`。内部时间坐标始终使用秒，
`timeUnit` 只控制坐标轴和 tooltip 的显示单位。

## 大数据渲染

组件按不可变数据处理：替换 `data` 引用会重新过滤、排序和缓存坐标域，并重置视口；
原地修改已有数组不会触发缓存刷新。建议通过 `shallowRef` 保存大数据并整体替换引用。

默认在可见点超过 2,000 时进行降采样，每个像素最多渲染 4 个保峰点。可按业务调整：

```vue
<WaveformChart
  :data="chartData"
  :rendering="{
    downsample: true,
    downsampleThreshold: 2000,
    maxPointsPerPixel: 4,
  }"
/>
```

降采样仅作用于 SVG path。最近点查询、tooltip、标注插值和受控数据不会损失精度。

## 采样点标注

标注由父组件通过 `v-model:annotations` 持有，标注使用 `seriesId` 和 `x/y` 数据坐标，
不依赖数组下标：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { WaveformChart, type WaveformAnnotation, type WaveformInteractionMode } from './index'

const annotations = ref<WaveformAnnotation[]>([])
const annotationsVisible = ref(true)
const interactionMode = ref<WaveformInteractionMode>('zoom')
</script>

<template>
  <WaveformChart
    :data="chartData"
    v-model:annotations="annotations"
    v-model:annotations-visible="annotationsVisible"
    v-model:interaction-mode="interactionMode"
  />
</template>
```

默认不显示标注工具栏；右键绘图区任意位置即可弹出居中编辑器，标注会通过连接线绑定到该位置，右键已有标注可以编辑或删除。需要兼容旧工具栏时可显式设置 `showAnnotationToolbar`。
标注文本最多 40 个字符，边框色、文字色和背景色均支持取色与透明度调整。组件只负责内存中的受控数据，
业务层负责会话或后端持久化。

Y 轴会根据整条轴域选择展示格式：绝对值范围在 `[0.01, 100)` 时使用普通小数，超出该范围时所有刻度共享一个科学计数指数，并只在最上方刻度显示 `E±NN`。tooltip 使用最多 4 位小数的本地化普通数字；标注编辑器的 X 坐标跟随 `timeUnit` 并固定 3 位小数，Y 坐标显示完整普通十进制。所有格式化都只发生在展示层，内部坐标值保持原始精度。
标注框布局优先选择采样点正上方，其次正下方，再按左右方向自动避让；文本框通过连接箭头指向标注位置。
