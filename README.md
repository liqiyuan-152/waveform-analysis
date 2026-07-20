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

### 绘图区域尺寸

`width` 和 `height` 接收像素数值，并且可以独立设置。指定的维度使用固定尺寸，未指定的
维度自适应填满父容器：

```vue
<div class="chart-container">
  <WaveformChart :data="chartData" :width="960" />
</div>

<style scoped>
.chart-container {
  height: 520px;
}
</style>
```

自适应高度要求父容器具有明确高度；父容器未定高时，组件使用最低 `180px` 高度。
显式高度同样保留 `180px` 下限。非有限尺寸按未指定处理，负宽度归零。

### 图表标题

`title` 在整个波形网格上方渲染一次，支持显隐、对齐、字体样式和旋转：

```vue
<WaveformChart
  :data="chartData"
  :title="{
    visible: true,
    text: 'Shot:4712',
    align: 'center',
    textStyle: {
      color: '#1f2937',
      fontSize: 14,
      fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif',
      rotation: 0,
      fontWeight: 400,
      fontStyle: 'normal',
      textDecoration: 'none',
      letterSpacing: '1px',
    },
  }"
/>
```

对应的公开类型为 `WaveformTitleOptions` 和 `WaveformTitleTextStyle`。未传 `title`、
`visible` 为 `false`，或 `text` 去除首尾空格后为空时，标题不渲染且不占高度。标题默认
居中、字号 `14px`、颜色 `#1f2937`、微软雅黑、常规字重且不旋转。标题区域高度按文字及旋转角度
在 `44px` 至 `160px` 之间计算；超长文字会省略，悬浮可查看完整内容。

`width` 和 `height` 始终表示组件总尺寸。标题显示后会从总高度中扣除标题区域，剩余高度
用于 SVG 绘图区，因此启用标题不会扩大组件或破坏父容器布局。

宿主已有全局标题配置时，可以在未来接入组件库绘图链路时按以下方式映射：

```ts
const waveformTitle = {
  visible: hasQueried && !cleanViewEnabled && titleStyle.enabled,
  text: titleStyle.titleName.trim() || defaultTitleText,
  align: titleStyle.align,
  textStyle: {
    color: titleStyle.color,
    fontSize: titleStyle.fontSize,
    fontFamily: titleStyle.fontFamily,
    rotation: titleStyle.rotation,
    fontWeight: titleStyle.bold ? 700 : 400,
    fontStyle: titleStyle.italic ? 'italic' : 'normal',
    textDecoration: titleStyle.underline ? 'underline' : 'none',
  },
} satisfies WaveformTitleOptions
```

宿主的抽屉折叠状态不需要传给组件。替换绘图链路时应同步移除宿主外层标题，避免重复
渲染；当前宿主实现无需修改。

Demo 左侧控制面板提供标题实时预览，可配置标题名称、显隐、对齐、字体、字号、粗体、
斜体、下划线、旋转和颜色。字号范围为 `8–72px`，旋转范围为 `-180–180°`；样式栏中的
`A` 用于恢复常规字重、非斜体和无下划线，关闭标题不会清除已经填写的配置。

### 图框样式

`frameStyle` 统一设置所有非空图框的边框和背景，颜色支持带 alpha 的 CSS 颜色值：

```vue
<WaveformChart
  :data="chartData"
  :frame-style="{
    borderColor: 'rgba(31, 41, 55, 0.8)',
    borderWidth: 2,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
  }"
/>
```

对应的公开类型为 `WaveformFrameStyle`。默认边框颜色为 `#1f2937`、线宽为 `1`、线型为
`solid`，背景透明。`borderWidth` 为 `0` 时隐藏边框；非有限值或负数会回退到默认线宽。

### 图例样式

`legend.backgroundColor` 设置多曲线图例的背景颜色。该字段接受任意有效 CSS 颜色值，
可通过 `rgba(...)` 或 `hsla(...)` 中的 alpha 通道调整透明度：

```vue
<WaveformChart
  :data="chartData"
  :legend="{
    position: 'top-right',
    orientation: 'auto',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  }"
/>
```

未配置或传入空字符串时，图例背景默认使用 `rgba(255, 255, 255, 0.7)`。

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
