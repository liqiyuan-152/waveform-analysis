# Waveform Analysis

基于 Vue 3、TypeScript 和 D3 的响应式波形图组件库与示例项目。

组件使用 SVG 绘制坐标轴和波形；大数据会按当前可见范围和屏幕像素自动保峰降采样，
tooltip 与标注仍使用完整原始数据。

## 开始使用

```bash
pnpm install
pnpm dev
```

开发环境要求 Node.js 22、pnpm，以及支持 Vue 3 的宿主项目。组件库会将 Vue、D3、
Ant Design Vue 和 vue3-colorpicker 作为 peer dependency；直接安装到业务项目时请一并
安装这些依赖：

```bash
pnpm add waveform-analysis vue d3 ant-design-vue vue3-colorpicker
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

## 发布

发布由推送版本 tag 触发。先将 `package.json` 的 `version` 更新为目标版本并提交，再创建同版本 tag：

```bash
git tag -a v0.1.7 -m "Release v0.1.7"
git push origin main --follow-tags
```

支持稳定版 `vX.Y.Z` 与预发布版 `vX.Y.Z-rc.1`。tag 去掉 `v` 后必须与 `package.json` 的
`version` 完全一致。稳定版发布为 npm `latest` 并更新服务器下载目录的 latest 链接；预发布版发布为
npm `next`，不会覆盖稳定版 latest。流水线会创建 Gitea Release，并上传 `.tgz` 与 SHA-256 校验文件。

仓库 Actions 需要配置 `NPM_PUBLISH_TOKEN`（npm 包发布权限）和 `GITEA_RELEASE_TOKEN`（仓库 Release
写入权限）两个 Secret。
### 数据结构

单通道可以使用采样值（`sampleRate` 为每秒采样数）或显式坐标点：

```ts
import type { WaveformData } from 'waveform-analysis'

const samples: WaveformData = {
  kind: 'samples',
  values: [0.2, 0.4, 0.1],
  sampleRate: 1000,
  startTime: 0,
}

const points: WaveformData = {
  kind: 'points',
  points: [
    { x: 0, y: 12 },
    { x: 0.001, y: 15, lowerError: 0.4, upperError: 0.8 },
  ],
}
```

多通道使用 `kind: 'series'`。同一个 `trackId` 的系列会绘制在同一图框中；没有
`trackId` 的系列默认各占一个图框。建议为每个系列提供全图唯一且稳定的 `id`。

```ts
const chartData: WaveformData = {
  kind: 'series',
  series: [
    { id: 'ch-a', name: '通道 A', trackId: 'group-1', data: samples },
    { id: 'ch-b', name: '通道 B', trackId: 'group-1', data: points },
  ],
}
```

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

### 缩放后按可视区间加载数据

组件会在一次缩放手势结束后触发 `zoom-end`，调用方可以使用端点请求后端，再通过 `data`
传回新数据。共享 X 轴模式的 payload 为 `{ start, end }`；独立分图模式还会包含
`trackIndex` 和稳定的 `seriesIds`。

```vue
<WaveformChart :data="chartData" @zoom-end="loadVisibleData" />
```

`zoom-change` 仍会在缩放过程中持续触发，适合更新外部状态；后端请求应使用
`zoom-end` 或在 `zoom-change` 上自行防抖。标注数据应由父组件独立持有，替换波形数据时
不要清空标注，组件会根据当前数据域自动隐藏或恢复对应标注。

调用方应处理加载失败的情况（网络错误、超时等），并保持旧数据或显示加载状态。生产环境建议使用
`AbortController` 取消过时的请求。

多通道数据应为每个 `WaveformSeries` 提供稳定的 `id`。内部时间坐标始终使用秒，
`timeUnit` 只控制坐标轴和 tooltip 的显示单位。

### 线型、点型与误差棒

每条序列可以独立设置连线方式、数据点符号和误差棒：

```ts
const series = {
  id: 'temperature',
  name: '温度',
  lineType: 'step-end',
  pointType: 'circle',
  errorBar: { visible: true, width: 1.5, capWidth: 8 },
  data: {
    kind: 'points',
    points: [
      { x: 0, y: 12, error: 0.5 },
      { x: 1, y: 15, lowerError: 0.4, upperError: 0.8 },
    ],
  },
} satisfies WaveformSeries
```

`lineType` 支持 `none`、`linear`、`step-start`、`step-middle` 和 `step-end`；兼容值
`step-after` 与 `step-end` 等价。三个阶梯值分别在区间起点、中点和终点跳变。`pointType`
支持 `none`、`circle`、`square`、`triangle` 和 `diamond`。默认使用普通直线且不显示数据点；
设置 `lineType: 'none'` 可以隐藏数据点之间的连接线，只保留点符号和误差棒；将其改为
`linear` 或阶梯类型即可同时显示对应连接线。误差棒仅在 `errorBar.visible` 为 `true` 时显示，
并参与 Y 轴范围计算；当误差棒可见时，`lineType` 和 `pointType` 可以同时为 `none`，用于展示
纯误差棒。只有连接线、点符号和误差棒全部关闭时才会回退为普通直线。`lowerError`、
`upperError` 分别覆盖对称的 `error`，图例会同步显示实际线型、点型和误差棒样式。

### 叠加与多值轴

为多条曲线设置相同的 `trackId`，可将它们叠加到同一图框。`overlayMode` 控制叠加
曲线共享一根 Y 轴还是使用独立值轴：

```vue
<WaveformChart :data="chartData" display-mode="independent" overlay-mode="multi-axis" />
```

`overlayMode` 对应公开类型 `WaveformOverlayMode`，可选值为 `single-axis` 和
`multi-axis`，默认值为 `single-axis`。多值轴最多渲染四根 Y 轴；超过四条曲线时，
后续曲线复用第 4 根轴，该轴的范围覆盖绑定到它的全部曲线。轴顺序依次为左侧、
右侧；三轴时第 3 根位于右侧外部，四轴时顺序为左侧、左侧外部、右侧、右侧外部。

`overlayMode` 与 `displayMode` 相互独立。`displayMode` 仍可使用 `independent`、
`separated` 或 `compact` 控制图框布局和 X 轴共享方式；未共享 `trackId` 的单曲线
图框不会因为切换叠加方式而改变。

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

### 图例与曲线显隐

`legend.backgroundColor` 设置多曲线图例的背景颜色。该字段接受任意有效 CSS 颜色值，
可通过 `rgba(...)` 或 `hsla(...)` 中的 alpha 通道调整透明度：

```vue
<script setup lang="ts">
import { ref } from 'vue'

const hiddenSeriesIds = ref<string[]>([])
</script>

<WaveformChart
  :data="chartData"
  v-model:hidden-series-ids="hiddenSeriesIds"
  :legend="{
    position: 'top-right',
    orientation: 'auto',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    interactive: true,
  }"
/>
```

未配置或传入空字符串时，图例背景默认使用 `rgba(255, 255, 255, 0.7)`。
`legend.interactive` 默认为 `false`；开启后可以单击或使用键盘操作图例项切换曲线显隐。
调用方可通过 `hiddenSeriesIds` 和 `update:hidden-series-ids` 控制状态，也可使用
`defaultHiddenSeriesIds` 设置非受控模式的初始隐藏项。隐藏状态同步作用于坐标轴、tooltip、
悬浮点和标注交互；允许隐藏全部曲线，并可通过保留的图例恢复显示。

显隐状态以规范化后的 `series.id` 为键。要在数据刷新和重新排序后稳定保留状态，每个系列都应
提供全图唯一且稳定的显式 `id`；自动生成的索引 ID 或重复 ID 添加的后缀不保证跨排序稳定。

### 网格、分页与交互模式

`grid` 控制独立图框的行列数（范围 `1–10`）以及是否显示分页器。默认值为 `2` 行、
`1` 列并开启分页；当图框数量超过网格容量时，分页器会显示在图表右下角。

```vue
<WaveformChart
  :data="chartData"
  :grid="{ rowCount: 2, columnCount: 2, showPagination: true }"
  v-model:interaction-mode="interactionMode"
  :show-annotation-toolbar="true"
/>
```

`interactionMode` 可选 `zoom` 或 `annotation`。默认不渲染标注工具栏，推荐通过右键
打开标注编辑器；设置 `showAnnotationToolbar` 可显示兼容工具栏。`zoomable` 和
`showTooltip` 可分别关闭缩放和 tooltip。空数据或过滤后没有有效点时，组件会保留图框
布局并显示“暂无有效波形数据”。

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
    pointMinSpacing: 10,
    errorBarMinSpacing: 12,
  }"
/>
```

全量视图只绘制均匀分布的真实数据点，放大后会自动恢复更多源标记。`pointMinSpacing` 和
`errorBarMinSpacing` 分别控制点符号和误差棒的最小水平间距，单位为 CSS 像素。两者同时
显示时共用一批采样点，并采用两个间距中的较大值，确保误差棒与对应点符号保持共心；仅显示
一类装饰时仍使用各自的间距。仅显示一类装饰时可将对应间距设为 `0`；两者同时显示时需将
两个间距都设为 `0` 才会关闭共同限制。设置 `downsample: false` 会关闭曲线和装饰的全部降采样。

降采样仅作用于 SVG 中的曲线、点符号和误差棒。点符号和误差棒在每个系列中分别合并为
单个 SVG path；最近点查询、tooltip、标注插值、Y 轴误差范围和受控数据不会损失精度。

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

默认不显示标注工具栏；右键绘图区任意位置即可弹出居中编辑器，标注会吸附到当前 X 位置最近的真实采样点，右键已有标注可以编辑或删除。需要兼容旧工具栏时可显式设置 `showAnnotationToolbar`。
标注框可以直接拖动进行手动避让，拖动只改变标签框位置，不会改变 `x/y` 数据锚点；偏移会以 `labelOffsetX/labelOffsetY` 像素字段保存在标注中。标注文本最多 40 个字符，边框色、文字色和背景色均支持取色与透明度调整。组件只负责内存中的受控数据，
业务层负责会话或后端持久化。

X、Y 轴会根据各自完整显示域选择格式：最大绝对值在 `[0.01, 100)` 时显示两位普通小数；大于等于 `100`，或大于 `0` 且小于 `0.01` 时，刻度显示两位缩放值，并在轴末端单独显示共享倍率 `E±NN`。X 轴先按 `timeUnit` 转换为秒或毫秒再判断范围，多 Y 轴则分别计算倍率。tooltip 使用最多 4 位小数的本地化普通数字；标注编辑器的 X 坐标跟随 `timeUnit` 并固定 3 位小数，Y 坐标显示完整普通十进制。所有格式化都只发生在展示层，内部坐标值保持原始精度。
标注框默认布局在采样点正上方，只做绘图区边界裁剪；文本框通过连接箭头指向标注位置，多个标注重叠时可通过拖动手动避让。

## 事件

组件提供以下事件，名称与 Vue 模板写法一致：

| 事件                                                            | 说明                                                       |
| --------------------------------------------------------------- | ---------------------------------------------------------- |
| `point-hover`                                                   | 当前最近点变化时触发，离开图表时传入 `null`                |
| `zoom-change`                                                   | 缩放过程中触发，参数为 `[start, end]`                      |
| `zoom-end`                                                      | 缩放结束后触发；独立分图模式附带 `trackIndex`、`seriesIds` |
| `page-change`                                                   | 分页变化，参数为当前页和总页数                             |
| `series-visibility-change`                                      | 图例切换曲线显隐时触发                                     |
| `annotation-create` / `annotation-update` / `annotation-delete` | 标注新增、更新或删除                                       |

`annotations`、`annotations-visible`、`interaction-mode` 和 `hidden-series-ids` 均支持
`v-model`；业务层应负责将标注和显隐状态持久化。

## 项目结构

- `src/index.ts`：组件库公开入口和工具函数导出
- `src/components/WaveformChart.vue`：图表容器、缩放、tooltip、图例和标注编排
- `src/components/{core,data,rendering,interaction,annotation}`：数据、布局、渲染和交互模块
- `src/App.vue`：可交互 demo，`src/data` 中提供示例波形数据

构建后，`dist/` 是可发布的组件库，`dist-demo/` 是 demo 静态产物；两者均为生成目录，
不要手工编辑。
