# Waveform Analysis

基于 TypeScript 和 D3 的框架无关 SVG 波形引擎，提供 Vue 3 薄适配和 React/vanilla DOM ref 示例。
适合展示单通道、多通道和大规模采样数据，内置缩放、tooltip、图例、误差棒、标注、分页和多 Y 轴叠加。

组件使用不可变数据模型：替换 `data` 引用后会重新计算数据域和视口；大数据会按当前可见范围
和屏幕像素自动保峰降采样，而 tooltip、最近点查询和标注仍使用完整原始数据。

## 在线示例

线上 Demo：[波形分析组件在线示例](https://lqycustomsite.online/waveform-analysis/)。

## 特性

- 框架无关 DOM 实例 API；Vue 3 可通过 `/vue` 按需导入 `WaveformChart`
- 采样值、显式坐标点和多系列数据模型
- `independent`、`separated`、`compact` 三种布局模式
- 曲线、阶梯线、点符号和对称/非对称误差棒
- 实线、虚线和点划线，可按系列独立配置
- 缩放过程事件、缩放结束按可视区间加载和视口重置
- 可选的空格拖拽平移，默认关闭并隔离多图表实例
- 多系列图例、受控显隐、网格分页和最多四根 Y 轴
- 自动 Y 轴范围，以及全局、按轨道或按系列配置的固定振幅范围
- 按轨道控制水平/垂直网格线的显隐与颜色
- 系列入场、数据更新、标注动画及分页/网格入场重播，支持独立配置与静态降级
- 受控标注、右键编辑、拖拽避让和自定义颜色
- 标题、图框、坐标轴、零值参考线、净图和渲染参数可配置

## 单包双组件

本包同时提供波形分析与波形展示，两个原生组件共享基础能力，分别使用独立实例。

```ts
import { init, Waveform } from 'waveform-analysis'
// 需要明确的按需边界时：
import { init as initAnalysis } from 'waveform-analysis/analysis'
import { Waveform as Display, type WaveformOptions } from 'waveform-analysis/display'
import 'waveform-analysis/style.css' // 分析组件需要；展示组件不需要此样式

const display = new Display(displayContainer, [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
])
display.updateData([
  { x: 0, y: 1 },
  { x: 1, y: 0 },
])
display.destroy()
```

`/native` 仍为根入口兼容别名。`/vue` 仅公开分析组件 `WaveformChart`；展示是原生类，
Vue 消费者在挂载时创建、卸载时 `destroy()`。根入口展示类型采用 `WaveformDisplay` 前缀，
例如 `WaveformDisplayOptions`，默认配置为 `waveformDisplayDefaultOptions`。
`/display` 保留原展示包的 `WaveformOptions`、`WaveformData`、`defaultOptions` 等名称。
从 `waveform-display` 迁移时将导入路径改为 `waveform-analysis/display`，无需修改原数据和配置。
分析 X 坐标仍为秒；展示保留原始 X 坐标，轴单位只用于显示。

两组件使用同一动画任务引擎和共享绘图/格式化基础能力，各实例的暂停、销毁与数据保持隔离。

X/Y 轴共用内部 `src/shared/axis` 核心（SVG 绘制、增量更新、刻度系数和文字测量），
通过方向与渲染计划组合使用。刻度密度、范围扩展、单位格式、端点避让和标题布局仍由各组件
适配层决定；不会将分析组件的秒坐标或展示组件的刻度规则相互替换。共享轴类不属于公共 API。
展示动画默认关闭，使用 `animationEnabled: true` 开启后可调用
`display.animation.pause()` / `resume()` / `finish()`。分析保持原有动画配置和接口；
其图表实例没有直接的 `pause/resume` 方法。展示 `toSVGString()` 同步提交终态并导出，
分析 `exportImage()` 仍为等待稳定状态的异步导出。

统一 Demo 的 `/display` 提供原展示配置面板、科学数据和动画场景；`/components` 提供双组件
同页使用及可查看的实际示例代码。旧分析路由保持可用。原展示源码的 MIT 通知保留于
`src/display/LICENSE`。包内共享模块属于实现细节，不支持从内部路径深层导入。

## 安装

Vue 是可选 peer dependency；只有 `/vue` 组件入口需要业务项目显式安装 Vue。
D3 是运行时依赖；router 和旧色选包仅作为开发依赖，图表使用原生颜色/透明度控件。
发布包随附 [第三方许可证通知](THIRD_PARTY_NOTICES.md)，包含外部依赖清单及 WASM 绑定通知。
分页、标注弹窗与时间输入使用组件自有控件，无需安装 Ant Design Vue 或加载 antd.css。
原生实例无需安装 Vue 或 React；使用 Vue 组件时另行提供兼容 Vue：

```bash
pnpm add waveform-analysis
# Vue 组件消费者
pnpm add vue
```

### 原生实例与 Vue 适配

`waveform-analysis` 提供 `init(dom, options?, initOptions?)`、
`getInstanceByDom(dom)` 和 `dispose(domOrInstance)`。传入真实 HTMLElement，
React 使用 `ref.current`，Vue 使用 DOM `ref.value`；原生入口和
`waveform-analysis/style.css` 的导入与声明无需安装 Vue 或 React。
`/native` 是根入口的兼容别名，共享全部函数与 DOM 实例注册表；两条样式路径内容相同。
目前已接入基础 SVG、尺寸、配置、命令、采样、轨道动画、滚轮/框选/平移手势、远程视口恢复、
hover/交叉线/tooltip、受控标注绘制/标签拖拽/菜单删除、标注编辑器的文本/时间/系列选择、
原生颜色/透明度控件、标注动画、工具栏/分页和自包含 SVG/PNG 导出。
Vue 组件是原生实例的薄适配，从 `waveform-analysis/vue` 导入。根入口不再导出 Vue
`WaveformChart`，原有纯工具与类型保持可用。旧 Vue 项目将组件 import 改为 `/vue`，props、
事件参数和组件 ref handle 保持兼容。

`0.2.0-rc.1` 是包含破坏性导入迁移的候选版本，使用 `pnpm add waveform-analysis@next` 安装。
从 `0.1.x` 升级时，请将 Vue 组件导入改为 `/vue`；稳定版仍可通过 `@latest` 安装。

```ts
import { WaveformChart } from 'waveform-analysis/vue'
import 'waveform-analysis/style.css'
```

Vue 薄适配保留原 props、事件参数和组件 ref handle。挂载时创建原生实例，卸载时销毁；
替换 `data` 引用刷新数据，其他配置变化不重复归一化。受控配置由父组件回传，移除可选 prop
会将对应原生 option 恢复为默认或内部状态。嵌套配置支持 Vue 响应式更新，数据仍遵循不可变契约。

```ts
import { init } from 'waveform-analysis'
import 'waveform-analysis/style.css'

const chart = init(
  containerElement,
  {
    data: { kind: 'samples', values: [0, 1, 0], sampleRate: 1000 },
  },
  { autoResize: true },
)
const cancel = chart.on('rendered', ({ revision }) => console.log(revision))
chart.setOption({ data: nextData }) // 替换数据引用
cancel()
chart.dispose() // 宿主卸载时调用
```

多系列局部更新时，保留未变化系列的稳定 `id` 和 `SingleWaveformData` 子对象引用，可复用其
归一化源和已注册的采样数据。只复用 `id` 不够：有变化的系列必须替换子 `data` 引用；不要原地
修改点数组或 TypedArray。外层 `data` 仍需替换，域、查询和标注继续使用完整数据。

仅实际改变 `lineColor` 时会复用布局和采样，并保留框选/平移、待提交滚轮、标注草稿及焦点/选区、
标注拖拽和动画时间线。这改进了之前颜色更新会取消活动交互的行为；混合更新仍执行其必要的重排和
取消策略。有效颜色更新仍产生新的渲染 revision，使旧导出返回 `export-stale`；无变化更新不增加
revision。原生与 Vue 入口一致。

采样 Worker 请求使用内部有限 deadline（当前 30 秒）。失联后终止旧 Worker 并结束相关等待，
允许 JavaScript 回退的模式从当前快照恢复；强制 `wasm` 且配置 `error` 时仍按原语义报告采样错误。
替换或删除数据产生的正常内部取消不会报告 `sampling-error`，迟到结果不会覆盖当前数据。

交互图例使用原生按钮，可通过 Tab、Enter、Space 操作；受控显隐须由宿主回传后才反映新状态。
非交互图例按钮禁用且不暴露切换状态。图表 SVG 使用分组语义，使内部控件可被辅助技术发现。

同一 DOM 重复 `init` 返回原实例且忽略第二次配置；更新请调用 `setOption`。
该方法按顶层部分更新，嵌套对象和数组整体替换，未传字段保留；可选字段传
`undefined` 恢复默认或解除受控，`data: undefined` 无效。`annotations` 缺省为 `[]`，
始终由宿主持久化；显隐和交互模式解除受控后恢复内部状态。X 坐标和事件值始终为秒。
DOM 更新可合并到下一帧，后续命令和 `getControlState()` 同步采用新数据。
非法配置以 `invalid-option` 和 `field` 拒绝整次更新；typed 输入只接受 Float32/Float64，
显式 X 列须为 Float64。无效数值点、采样率及列长度不匹配仍按既有归一化规则容错。
`finished` 等待当前采样、测量、有限轨道/标注动画和补绘完成，每个业务版本至多一次。
原生悬停始终查询完整归一化点源；`point-hover` 返回秒坐标的最近点快照，离开时返回 `null`。
`showTooltip: false` 隐藏 tooltip 和交叉线，保留悬停事件；`presentationMode` 同时停用悬停。
悬停更新不创建新的业务 revision 或 `finished` 周期，正在进行的轨道动画会先稳定到目标几何。
`control-state-change` 在微任务中合并同步更新，仅当有效模式、目标视口或命令能力快照变化时
通知；未回传的受控请求不触发它。初始化快照请同步调用 `getControlState()`。
原生标注拖拽只发出 `update:annotations` 替换数组，不触发 `annotation-update`；
宿主通过 `setOption({ annotations })` 回传后提交，未回传时仅保留临时拖拽预览。
菜单删除先发替换数组，再发 `annotation-delete` 快照，未回传时原标注继续显示。
编辑器支持最多 40 个 UTF-16 字符，保存时去除文本首尾空白；修改时间失焦或保存时
吸附当前完整数据中的最近样本，时间输入按 `timeUnit` 显示，事件坐标仍为秒。
保存前重新校验当前数据范围，取消不发替换数组；Ctrl/⌘+Enter 保存，Esc 取消。
图表内置 Select、Input/InputNumber 与 ColorPicker 使用原生 TypeScript、DOM 和隔离 CSS，
以 Ant Design 5 默认浅色主题为参照（32px 高、14px 字号、6px 圆角、主色 #1677ff），
无需框架或第三方控件运行时。它们是内部控件，不作为通用组件导出；Demo 设置面板仍使用第三方组件。
Select 按 Ant Design 5.29.3 默认单选样式显示选中背景，不额外显示勾号；方向键展开后循环跳过禁用项，
Home/End 定位首尾，Enter 或展开时首次 Tab 确认，Escape 取消，后续 Tab 正常移动焦点；支持字符定位，
不支持搜索框、多选或虚拟列表。InputNumber 支持方向键、Shift 十倍步进、Enter/失焦校验，
增减按钮按下立即步进，长按 600ms 后每 200ms 重复；普通步长沿用显示单位下的 0.001，提交后仍吸附最近样本。
滚轮不修改数值，输入法组合期间不处理步进和 Enter。
颜色区按照 Ant Design 5 ColorPicker 的 258px 面板布局实现，包含 160px 色板、
8px 色相/透明度滑条、24px HEX/HSB/RGB 输入行、百分比透明度与可折叠预设色。
HEX 输入也接受完整 CSS 颜色文本；不支持渐变、取色器或历史色。
色板支持触摸拖动和方向键（Shift 加速），Escape 优先关闭控件弹层并恢复触发器焦点。
颜色文本支持 hex（含 alpha）、rgb/rgba、hsl/hsla（逗号语法）与 CSS 命名色；alpha 为 0 时全透明、为 1 时不透明。
未编辑的原值保持字符串，非法颜色或透明度禁止保存。
标注弹窗沿用历史版紧凑布局：440px 宽、顶部 100px，标题和底栏保留分隔线，
X/Y 坐标与所属波形使用浅色卡片，颜色编辑显示三列横向色块。
小屏保留两侧留白，低高度窗口减小顶部距离并允许滚动。
弹窗支持 300ms 淡入/缩放过渡和减少动态效果偏好；关闭过渡期间阻止重复提交，完成前再次校验最新数据。
控件弹层在标注 dialog 内显示，随滚动和尺寸变化定位，点击外部关闭。
宿主回传标注后出现/消失动画才生效，离场快照不接受编辑或拖拽；
`animationAnnotation` 保留既有预设，`finished` 等待最后一帧绘制或离场节点删除。
标注标签支持 Enter、Space 或 Shift+F10 打开菜单，方向键/Home/End 导航，Esc 关闭并恢复焦点。
原生工具栏沿用 `toolbar` 的按钮顺序、分组、位置和 hover/always 配置，约 360px 容器可展开；
对当前页执行批量命令，外部 API 可按稳定 `trackId` 指定目标，分页保留独立视口。工具栏命令事件携带
`source: 'toolbar'`，模式按钮高亮使用实际受控状态；分页保留 `page-change(page, pageCount)`。
原生 `exportImage({ format: 'png', scale: 2, backgroundColor: '#fff' })` 返回 `Promise<Blob>`，
实例 API 不自动下载；工具栏提供 SVG/PNG 下载和失败反馈。PNG scale 默认 1，范围为 `(0, 4]`；
SVG 仅允许 scale 为 1。快照包含当前页标题、轴、图例和标注，保留隐藏系列的图例状态，
排除工具栏、分页按钮、悬停与手势操作层，无需宿主 CSS 即可独立打开。
导出等待当前采样、字体、测量及有限动画，最长 5 秒；等待或编码期间配置、视口和尺寸改变
会以 `export-stale` 拒绝，销毁返回 `export-cancelled`，并发请求返回 `export-busy`。
超时返回 `export-timeout`，非法参数与不可用尺寸分别返回 `export-invalid-options`、
`export-unavailable`，解码或编码失败返回 `export-render-failed`；失败后可重新请求。
`dispatchAction` 接受 `zoom-in`、`zoom-out`、`fit`、`reset`、`set-domain`、`set-mode`。
非法动作类型或模式抛出带 `field` 的 `invalid-option`；无效目标和范围分别返回
`invalid-target`、`invalid-domain`。旧数字索引重载仍返回 void 且不派发命令事件。

原生模块支持无 `window/document` 的环境导入，初始化在客户端取得 DOM 后执行。
SSR 只导入类型、算法或入口；Vue DOM ref 在 `onMounted`、React DOM ref 在 effect
取得 HTMLElement 后调用 `init`，不要在模块顶层或服务端 render 中初始化实例。
缺少 ResizeObserver 时调用 `resize()`；关闭自动监听可传 `{ autoResize: false }`。
`dispose()` 幂等且只释放实例资源，销毁后修改、查询和订阅会抛 `instance-disposed`，
取消订阅仍安全，导出以 `export-cancelled` 拒绝。

可运行的 [React 示例](examples/react/WaveformDemo.tsx)、
[Vue DOM ref 示例](examples/vue/WaveformDemo.vue) 与
[原生 DOM 示例](examples/vanilla/VanillaWaveformDemo.ts) 均从 `/native` 导入，
演示宿主保存受控状态、回传标注替换数组、缩放、导出和卸载。启动方式见
[示例说明](examples/README.md)。React Strict Mode 会执行初始化→清理→再初始化，
每次 effect 都必须返回取消订阅及 `dispose()` 的清理函数；稳定订阅通过 ref 读取最新回调。
同一模块格式的多个入口共享 DOM 注册表；不要混用同一包的 ESM/CJS 或重复安装副本来管理同一 DOM。

### 运行时版本要求

组件库当前使用或支持以下运行时版本：

| 依赖 | 支持版本      |
| ---- | ------------- |
| Vue  | `>=3.2.33 <4` |
| D3   | `>=7.9.0 <8`  |

其中 Vue 的版本范围是公开的可选 peer dependency 约束；使用 Vue 组件时显式安装 Vue，
D3 随组件包安装。适配入口已在隔离消费者验证 Vue 3.5.40 + TypeScript 6.0.3，
以及 Vue 3.2.33 + TypeScript 4.7.4，均使用严格声明检查。Vue 3.2.33 自身的声明
不兼容 TypeScript 6；旧 Vue 项目应使用匹配的 TypeScript 版本。

仓库 demo 仍使用 Ant Design Vue，它仅作为开发依赖。图表核心与颜色控件使用普通 TypeScript；
Vue 组件仅负责 props、事件和生命周期适配。
标注弹窗使用浏览器原生 `<dialog>`，需要支持 `showModal()` 的现代浏览器。

## 最小示例

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { WaveformChart } from 'waveform-analysis/vue'
import type { WaveformData } from 'waveform-analysis'
import 'waveform-analysis/style.css'

const data = ref<WaveformData>({
  kind: 'points',
  points: [
    { x: 0, y: 0.2 },
    { x: 0.001, y: 0.4 },
    { x: 0.002, y: 0.1 },
  ],
})
</script>

<template>
  <div class="chart-container">
    <WaveformChart :data="data" />
  </div>
</template>

<style scoped>
.chart-container {
  height: 420px;
}
</style>
```

父容器需要有明确高度；未指定 `width` 或 `height` 时，组件会填充父容器，并保持最小高度
`180px`。Vue `WaveformChart` 从 `waveform-analysis/vue` 导入，对应源码入口 `src/vue.ts`；
样式入口为 `waveform-analysis/style.css`。

## 动画

动画默认开启：系列整体入场 1000ms（cubicInOut），多系列交错 100ms，数据更新和标注
300ms。这改变首次完整显示和替换数据的时机；需要即时画面时关闭：

```vue
<WaveformChart :data="data" :animation-enabled="false" />
```

五个 props 为 `animationEnabled`、`animation`、`animationUpdate`、`animationAnnotation`、
`animationThreshold`。三个配置对象按字段合并，`undefined` 使用默认，`0` 和 `false` 保留。
非法组件字段回退并在开发环境告警；底层引擎非法配置则在注册前抛错。

```vue
<WaveformChart
  :data="data"
  :animation="{
    enabled: true,
    duration: 800,
    delay: 100,
    staggerDelay: 50,
    direction: 'center-out',
  }"
  :animation-update="{ enabled: true, duration: 300, easing: 'cubicInOut' }"
  :animation-annotation="{ enabled: true, type: 'bounce' }"
  :animation-threshold="200000"
/>
```

入场支持 `left-to-right`、`right-to-left`、`center-out`；标注支持 `fade-in`、`scale`（默认）、
`slide-in`、`bounce`。标注效果的默认 easing 分别为 cubicOut、backOut、cubicOut、bounceOut，
可显式覆盖。分类 `enabled: false` 只结束该类，恢复不重播；运行中修改时长/效果只影响
下次任务。`duration: 0` 同步到终态并忽略该阶段的延迟/交错。

总有效规范化点数 **>= threshold** 时静态，默认 threshold=200000，0 始终静态。
计数包括隐藏及非当前页系列，通过 source.length 读取，不按采样点数计算。
系统减少动态效果、缺少 RAF 或导出期间同样静态。页面后台暂停，返回扣除后台时间。

替换 `data` 引用后，成功采样的兼容 X/线型/点型/误差结构进行数值插值；结构不兼容时
整体交叉淡化，第三份几何需求直接落到最新目标。失败/回退采样静态展示已有后端策略结果。
动画只改独立展示状态：原始数据、秒坐标、完整数据查询和受控 annotations 不受改写。
交互、视口命令、布局变化及 PNG/SVG 导出先提交最新最终态；导出不等待无限动画，仍遵守
原有 busy/stale/cancelled/timeout 错误契约和 5 秒上限。Demo `#/animation` 提供分类和效果控制。

切换到不同分页或修改网格行列数（包括 1×2）时，目标页重播首次加载的波形绘制动画，
曲线、散点和误差棒一起逐步出现，标注等待对应系列绘制完成，坐标轴与网格立即更新。
这些操作复用 `animation` 的开关、方向、缓动、延迟及多系列交错配置
（默认从左向右、cubicInOut，系列间隔100ms）。分页的单系列绘制时长固定为500ms；
首次加载与网格调整仍使用 `animation.duration`（默认1000ms）。`animationUpdate` 只控制数据更新。
关闭入场类别或设置 `duration: 0` 直接显示完整新页；全局静态降级同样生效。
连续翻页或调整网格只播放最终目标，不重新请求数据、不做跨页形变；返回已访问页也重播，
同页点击和相同网格尺寸不触发。网格调整引起的页码重置合并为一次重播，其他自动页码重置、
resize及其他展示设置变化仍静态处理。

### 高级数值引擎

根入口导出 `Animation`、`Animator`、`globalAnimator`、`WaveformAnimationController`、
所有配置/轨道/帧/句柄/调度器/预设类型，以及六个纯预设工厂。无需 D3 selection 或深路径导入。
`Animator` 和控制器的终态句柄保留 ID/状态；重复控制调用无操作，句柄不再持有任务、轨道目标或调度器。
模块导入不启动 RAF，SSR 中没有 RAF 时直接完成；注入 `AnimationScheduler` 可控制时钟、RAF、定时器。

```ts
import { Animation, Animator, getEasingFunction } from 'waveform-analysis'

const target = {
  x: 0,
  coordinates: [
    [0, 1],
    [1, 2],
  ],
}
const animator = new Animator()
const handle = animator.animate({
  duration: 1000,
  delay: 100,
  direction: 'alternate',
  loop: 2,
  easing: 'quadInOut',
  tracks: [{ target, property: 'x', to: 10 }],
  during: (progress, frame) => console.log(progress, frame.iteration, frame.terminal),
  done: () => console.log('完成'),
  aborted: () => console.log('中止'),
  onError: (error) => console.error(error),
})
handle.pause()
handle.resume()
handle.finish() // 方向决定最后迭代终点；abort() 保留当前值
animator.pauseAll()
animator.resumeAll()
animator.clear()
animator.destroy()

// 累加只允许一次播放及兼容数值形状；to 表示期望的新合成目标。
animator.animate({ tracks: [{ target, property: 'x', to: 12 }], additive: true })
const manual = new Animation({ force: true, loop: true, during: () => {} })
manual.start(0)
manual.tick(500)
manual.pause(500)
manual.resume(800)
manual.finish()
getEasingFunction('quartIn')(0.5) // 0.0625
```

轨道接受 number、number[]、number[][]，数组每帧替换，不原地改写输入；普通轨道冲突整体
中止旧任务并从当前合成值接续，累加贡献完成/中止后固定，不逐帧漂移。`loop: true` 无限，
数字为正整数，方向还支持 normal/reverse/alternate-reverse。`force: true` 让无变化或空轨道计时，
不能绕过组件禁用策略。31 个缓动是 linear 加 quad/cubic/quart/quint/sine/expo/circ/back/elastic/bounce
的 In/Out/InOut，来自 D3，也支持自定义函数。回弹可越界，域/opacity/裁剪各自安全限幅。

### 纯预设与 owner 控制器

工厂只构造配置，注册事务成功后才初始化；零时长跳过隐藏初态。绑定只读写数值状态：

路径预设在构造时快照 `from`、`to` 和 `compatible`。修改传入对象不会改变已构造配置的
端点或过渡模式；下一次构造配置时才使用新值。

```ts
import {
  Animator,
  WaveformAnimationController,
  createLineDrawingAnimation,
  createStaggeredLineDrawingAnimations,
  createPathTransitionAnimation,
  createYAxisScaleAnimation,
  createAnnotationAppearAnimation,
  createAnnotationDisappearAnimation,
} from 'waveform-analysis'
import type { AnnotationAnimationState, ClipAnimationState } from 'waveform-analysis'

let clip: ClipAnimationState = { x: 0, width: 100 }
const clipBinding = {
  read: () => clip,
  write: (value: ClipAnimationState) => {
    clip = value
  },
}
let style: AnnotationAnimationState = { opacity: 1, scale: 1, offsetY: 0 }
const styleBinding = {
  read: () => style,
  write: (value: AnnotationAnimationState) => {
    style = value
  },
}
let domain: [number, number] = [0, 100]
const domainBinding = {
  read: () => domain,
  write: (value: [number, number]) => {
    domain = value
  },
}
const animator = new Animator()
animator.animate(createLineDrawingAnimation(clipBinding, 100))
createStaggeredLineDrawingAnimations([{ binding: clipBinding, width: 100 }], { staggerDelay: 50 })
animator.animate(
  createPathTransitionAnimation(
    {
      from: { points: [[0, 1]] },
      to: { points: [[0, 2]] },
      compatible: true,
    },
    (frame) => {
      if (frame.kind === 'settled') console.log(frame.values) // 释放旧几何后再通知完成
    },
  ),
)
animator.animate(createYAxisScaleAnimation(domainBinding, [49, 51], { easing: 'backOut' }))
animator.animate(createAnnotationAppearAnimation(styleBinding, { type: 'scale' }))
animator.animate(createAnnotationDisappearAnimation(styleBinding, { type: 'fade-in' }))

const controller = new WaveformAnimationController({
  animator,
  commitFinalState: () => {
    clip = { x: 0, width: 100 }
  },
})
controller.animateSeriesEnter('signal', clipBinding, 100)
controller.animateAnnotationAppear('note', styleBinding)
controller.pauseAll()
controller.resumeAll()
controller.cancel({ kind: 'annotation', id: 'note', scope: 'enter' })
controller.finishAll() // 移除 owner 任务，提交最新业务目标，然后通知 done
controller.destroy() // 仅清理此 owner，不销毁共享 animator
```

控制器还提供 `animateMultiSeriesEnter`、`animateDataUpdate`、`animateYAxisScale`、
`animateAnnotationDisappear`、通用 `animate(key, config)`、`cancelAll`、`setEnabled` 和
`getActiveAnimationCount`。key 包含对象 kind/id/scope；不同控制器同 ID 隔离。
批量结束期间同 owner 重入创建抛 `animation-terminating`；销毁后抛 `animation-disposed`。
完成通知可同步读取最终展示数据，DOM 查询需要 `await nextTick()`。

真实浏览器基准运行 `pnpm test:animation:browser`（首次需 `pnpm exec playwright install chromium`），
输出 OpenSpec evidence 目录。FPS/内存/gzip 是实测优化目标，不能由 jsdom 测试证明，
跨浏览器和移动设备结论只覆盖实际可用环境。
大点数更新和交叉淡化可能增加浏览器物理内存；原 10/20MB 优化目标尚未达到。
对内存敏感的应用可降低 `animationThreshold` 或关闭对应动画类别；卸载清理与几何数量限制
不等于跨设备的绝对内存上限。历史验证产物已清理，可运行上述浏览器基准重新生成测量结果。

## API 速查

### Props

| Prop                       | 类型                                                                               | 默认值                                                                                | 说明                                          |
| -------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------- |
| `data`                     | `WaveformData`                                                                     | 必填                                                                                  | 波形数据                                      |
| `displayMode`              | `'independent' \| 'separated' \| 'compact'`                                        | `'independent'`                                                                       | 图框布局                                      |
| `overlayMode`              | `'single-axis' \| 'multi-axis'`                                                    | `'single-axis'`                                                                       | 叠加曲线的 Y 轴模式                           |
| `layoutPreset`             | `'default' \| 'edge-compact'`                                                      | `'default'`                                                                           | 标题贴边、时间标签与响应式分页布局            |
| `unitDisplayMode`          | `'axis' \| 'legend-single-series' \| 'channel-label' \| 'channel-label-or-legend'` | `'axis'`                                                                              | 可选的图表级单位展示规则                      |
| `timeUnit`                 | `'s' \| 'ms'`                                                                      | `'ms'`                                                                                | 坐标轴和 tooltip 展示单位                     |
| `xLabel` / `yLabel`        | `string`                                                                           | `时间（timeUnit）` / `'幅值'`                                                         | 坐标轴名称                                    |
| `lineColor`                | `string`                                                                           | `'#0960bd'`                                                                           | 单波形默认颜色                                |
| `width` / `height`         | `number`                                                                           | 自适应                                                                                | 组件总尺寸，单位为 CSS 像素                   |
| `zoomable` / `showTooltip` | `boolean`                                                                          | `true` / `true`                                                                       | 缩放和数值 tooltip 开关                       |
| `pannable`                 | `boolean`                                                                          | `false`                                                                               | 空格拖拽平移开关                              |
| `panXDomain`               | `[number, number]`                                                                 | 未设置                                                                                | 远端横向平移边界，使用秒坐标                  |
| `minZoomSpan`              | `number`                                                                           | 未设置                                                                                | 最小缩放跨度，使用原始 X 数据单位             |
| `integerZoom`              | `boolean`                                                                          | `false`                                                                               | 优先对齐整数，小于一个显示单位时保留小数      |
| `minVisiblePoints`         | `number`                                                                           | `0`                                                                                   | 缩放后至少保留的不同 X 坐标数                 |
| `maxZoomScale`             | `number \| null`                                                                   | 未设置                                                                                | 最大缩放倍数；`null` 表示不限制               |
| `initialXDomain`           | `[number, number]`                                                                 | 未设置                                                                                | 所有图框的初始 X 范围（可超出数据，空白显示） |
| `initialXDomains`          | `Record<string, [number, number]>`                                                 | 未设置                                                                                | 按 track/series ID 配置初始范围（可超出数据） |
| `xDomainStrategy`          | `WaveformXDomainStrategy`                                                          | `{ type: 'integer-ms' }`                                                              | 自动 X 轴视口范围策略                         |
| `yDomain`                  | `[number, number]`                                                                 | 未设置                                                                                | 所有波形的固定 Y 轴范围                       |
| `amplitudeLimits`          | `WaveformAmplitudeLimits`                                                          | 未设置                                                                                | 按 normalized series ID 配置严格幅值边界      |
| `yDomains`                 | `Record<string, [number, number]>`                                                 | 未设置                                                                                | 按 track/series ID 配置固定范围               |
| `grid`                     | `WaveformGridOptions`                                                              | `{ rowCount: 2, columnCount: 1, showPagination: true, fillIncompleteLastRow: false }` | 网格和分页                                    |
| `axes`                     | `WaveformAxesOptions`                                                              | 轴线均显示                                                                            | X/Y 轴基线、Y 轴分割数与 X 轴 label 格式化    |
| `rendering`                | `WaveformRenderingOptions`                                                         | `{}`                                                                                  | 降采样与点/误差棒间距                         |
| `plotMargin`               | `WaveformPlotMargin`                                                               | `{ top: 18, bottom: 52 }`                                                             | 绘图区上下边距，单位为 CSS 像素               |
| `title` / `frameStyle`     | 对应公开类型                                                                       | 未设置                                                                                | 标题和图框样式                                |
| `legend`                   | `WaveformLegendOptions`                                                            | `{ position: 'top-right', orientation: 'auto' }`                                      | 图例位置、排列、背景和交互                    |
| `frameNumber`              | `string \| number`                                                                 | 未设置                                                                                | 图框水印内容                                  |
| `frameNumbers`             | `Record<string, string \| number>`                                                 | 未设置                                                                                | 按 `trackId` 覆盖图框水印内容                 |
| `zeroLine`                 | `WaveformZeroLineOptions`                                                          | `{ visible: false }`                                                                  | 零值参考线显隐与样式                          |
| `cleanView`                | `boolean`                                                                          | `false`                                                                               | 保留波形、图框和刻度的净图模式                |
| `presentationMode`         | `boolean`                                                                          | `false`                                                                               | 禁用绘图区交互的展示模式                      |
| `annotations`              | `WaveformAnnotation[]`                                                             | `[]`                                                                                  | 受控标注数据                                  |
| `annotationsVisible`       | `boolean`                                                                          | `true`                                                                                | 标注图层显隐                                  |
| `interactionMode`          | `'zoom' \| 'pan' \| 'annotation' \| 'none'`                                        | `'zoom'`                                                                              | 左键模式；传入时由宿主控制                    |
| `hiddenSeriesIds`          | `string[]`                                                                         | 未设置                                                                                | 受控隐藏系列 ID                               |
| `defaultHiddenSeriesIds`   | `string[]`                                                                         | `[]`                                                                                  | 非受控模式的初始隐藏系列                      |
| `toolbar`                  | `boolean \| WaveformToolbarOptions`                                                | `false`                                                                               | 内置工具栏配置                                |

所有公开类型均可从包入口导入，例如 `WaveformData`、`WaveformSeries`、`TypedSampleData`、
`TypedPointData`、`WaveformAnnotation`、`WaveformLineStyle`、`WaveformRenderingOptions`、
`WaveformPlotMargin`、
`WaveformAxesOptions`、`WaveformYAxisLabelTextStyle`、`WaveformXAxisLabelFormatter`、`WaveformXDomainStrategy`、`WaveformZeroLineOptions`、
`WaveformGridOptions` 和 `WaveformGridTrackLines`。

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

也可使用紧凑的 TypedArray 输入。`typed-samples` 只保存 Y 值，X 始终按
`startTime + index / sampleRate`（秒）计算；`typed-points` 使用 `Float64Array` 存储 X，Y 和
误差字段可使用 `Float32Array` 或 `Float64Array`。所有 `typed-points` 字段长度必须一致；不支持
其他 TypedArray 类型。选择 `Float32Array` 的 Y 或误差值时，精度损失由调用方承担。输入数据和
底层 `ArrayBuffer` 仅被读取，不会排序、写入或转移所有权。

```ts
const compactSamples: WaveformData = {
  kind: 'typed-samples',
  values: new Float32Array([0.2, 0.4, 0.1]),
  sampleRate: 1000,
}

const compactPoints: WaveformData = {
  kind: 'typed-points',
  x: new Float64Array([0, 0.001]),
  y: new Float32Array([12, 15]),
  lowerError: new Float32Array([0.4, 0.4]),
  upperError: new Float32Array([0.8, 0.8]),
}
```

TypedArray 输入在内部保持紧凑列表示。`typed-samples` 只复制 Y 值及采样元数据；遇到无效样本
时用紧凑源索引保留时间空洞，不生成完整 X 列。既有数组式渲染接口通过有界缓存按需构造单个
`WaveformPoint`，Worker 消息使用私有数值副本，不会分离调用方的 `ArrayBuffer`。

多通道使用 `kind: 'series'`。同一个 `trackId` 的系列会绘制在同一图框中；没有
`trackId` 的系列默认各占一个图框。建议为每个系列提供全图唯一且稳定的 `id`。

```ts
const chartData: WaveformData = {
  kind: 'series',
  series: [
    { id: 'ch-a', shotNo: '13300', name: '通道 A', trackId: 'group-1', data: samples },
    { id: 'ch-b', shotNo: '13300', name: '通道 B', trackId: 'group-1', data: points },
  ],
}
```

需要让图框在合并或暂时没有数据时仍保持位置和分页，可传入 `grid.trackOrder`。列表中的
`trackId` 会按给定顺序占用图框；没有对应系列的项显示为空图框，数据中未列出的轨道会追加在末尾。传入
`hideEmptyTracks: true` 可省略空图框，同时按稳定 `trackId` 保留图例、交互和水印映射：

```vue
<WaveformChart :data="chartData" :grid="{ rowCount: 2, trackOrder: ['ch-a', 'ch-b', 'ch-c'] }" />
```

## 波形图

组件内置缩放、悬浮取点和 tooltip。调用方只需要提供波形数据：

```vue
<script setup lang="ts">
import { WaveformChart } from 'waveform-analysis/vue'
import 'waveform-analysis/style.css'
</script>

<template>
  <WaveformChart :data="chartData" />
</template>
```

### 固定振幅上下限

未传入 Y 轴范围时，组件继续根据当前可见系列及其误差棒自动计算范围。传入 `yDomain`
后，所有波形使用同一个固定范围；超出范围的部分只在绘图区裁剪，不会过滤或修改原始数据：

```vue
<WaveformChart :data="chartData" :y-domain="[-80, 80]" />
```

多通道可以通过 `yDomains` 按稳定的 `trackId` 或 `seriesId` 分别配置：

```vue
<WaveformChart
  :data="chartData"
  :y-domain="[-100, 100]"
  :y-domains="{
    voltage: [-65, 65],
    current: [-260, 260],
  }"
/>
```

范围优先级为 `trackId` 配置、`seriesId` 配置、全局 `yDomain`、数据自动范围。上下限必须
是两个有限且不相等的数字；倒序范围会自动调整为升序，无效配置会回退到下一优先级。
固定范围作为 Y 轴刻度算法的初始范围；轴会按漂亮步长经过 D3 的 `nice()` 扩展，确保主刻度
等间距。原始数据和传入的范围值不会被修改。

单值轴叠加模式会合并同一根轴上所有可见系列的有效范围；多值轴模式按系列分别使用配置，
超过四根轴后复用第 4 根轴的系列会取范围并集。隐藏系列不参与公共范围合并。

固定范围存在时，对应图框的 Y 轴不会被平移或视口重置覆盖；X 轴缩放、平移和重置保持原有
行为。运行时更新或移除 `yDomain` / `yDomains` 会立即重新布局，移除后恢复自动范围。

### 严格幅值显示上下限

`amplitudeLimits?: WaveformAmplitudeLimits` 按稳定的**规范化 series ID** 设置幅值显示边界，
不是按 `trackId` 配置，也不绘制阈值线。组件导出以下类型：

```ts
import type { WaveformAmplitudeLimit, WaveformAmplitudeLimits } from 'waveform-analysis'

// WaveformAmplitudeLimit = { lower?: number; upper?: number }
const amplitudeLimits: WaveformAmplitudeLimits = {
  voltage: { lower: -73, upper: 86 },
  current: { upper: 0 },
}
```

```vue
<WaveformChart :data="chartData" :amplitude-limits="amplitudeLimits" />
```

每边可选，`0` 有效；非有限值视为该边未配置。两个有效边界相等或倒置时，整个系列配置
停用，恢复原来的 `yDomain` / `yDomains` 或自动范围逻辑。

有效限幅优先于旧固定范围和手动 Y 视口：配置侧覆盖自动边界并关闭该侧留白，未配置侧
继续根据完整数据（含启用的误差棒）计算自动范围、留白和 nice 刻度。默认启用 nice，
但仅允许未配置侧向外扩展；双边 `[-73, 86]` 始终保持原端点，主刻度在其内部按漂亮步长
生成，边界不必是主刻度。`axes.y.nice: false` 时仍在最终范围上使用线性等分刻度。

单边限幅导致自动侧与配置侧相等或倒置时，只调整自动侧。回退跨度取原自动范围跨度、
配置值绝对值的 10%、`1` 三者的最大值。缩放、平移、复位、分页和替换 `data` 均不会覆盖
配置边界；有限幅时未配置侧始终自动计算。替换或移除配置立即生效。

共享 Y 轴按可见系列的有效配置合并：下限取最小值，上限取最大值，仅启用存在的边。
多值轴按各自系列配置；复用同一根轴的系列也按此规则合并。合并后的双边相等或倒置时
该轴限幅停用。全部系列隐藏时沿用组件按完整系列保留轴范围的规则；空数据沿用原来的
默认处理，不创建额外坐标轴。

越界曲线仅在绘图区裁剪，原始输入、完整规范化数据及数据导出不受影响。标签测量、轴槽
空间和实际渲染使用同一套范围及刻度规则。未使用有效限幅时，旧 API 的行为保持兼容。

### Y 轴自动等分

Y 轴默认以 5 个主刻度为目标，并使用类似 ECharts 的 `1 / 2 / 5 × 10ⁿ` 漂亮
步长，保证主刻度之间数值等间距。可以通过 `axes.y.splitNumber` 指定目标刻度数量；
显式留白或限幅时仅保留范围内的主刻度，边界不必是刻度。每条 Y 轴会独立计算：

```vue
<WaveformChart :data="chartData" :axes="{ y: { splitNumber: 5 } }" />
```

Y 轴图框上边界的普通刻度标签隐藏；开启最大值刻度展示时，边界上的最大值标签仍显示。
下边界标签仍垂直居中对齐图框底边。
上下端点的普通刻度不显示短线；开启最大值刻度展示时，上边界的最大值短线仍显示。
中间刻度、网格和波形坐标保持不变。
科学计数法倍率与单位随最高的可见标签显示，图框内部的原始极值标记仍保留。
尺寸或坐标范围变化后，每根 Y 轴仍保持该对齐方式，左右侧 Y 轴均适用。

默认会将未显式配置留白的 Y 轴边界扩展为便于读取的等距刻度。传入 `nice: false` 可保持数据自动范围或
`yDomain` / `yDomains` 的原始端点：

```vue
<WaveformChart :data="chartData" :axes="{ y: { nice: false } }" />
```

自动 Y 轴范围可通过 `axes.y.upperPaddingRatio` 设置上限留白比例，默认 `0`。
例如 `0.1` 使用 `[min, max + (max - min) * 0.1]`，下限不变。
单值轴按图框合并范围计算，多值轴按各轴对应曲线范围计算；固定范围及手动缩放的 Y
视口不增加留白。常量数据先沿用非零范围回退，再计算留白。设置 `nice: false`
可使用线性等分刻度；显式配置留白的边界在 nice 模式下也不会进一步扩展。

```vue
<WaveformChart :data="chartData" :axes="{ y: { nice: false, upperPaddingRatio: 0.1 } }" />
```

### 缩放后按可视区间加载数据

主 demo 已接入可替换的异步加载器：首次加载、缩放结束、平移结束和重置均通过同一接口
回填数据。默认模拟延迟为 80ms；加载期间显示状态，失败时显示错误并可重试当前范围。
请求使用 `AbortController` 取消，并校验请求版本，取消未生效的旧响应也不会覆盖新视口。
独立图框按稳定 `seriesIds` 分别合并，同次多图框命令可加载所有目标。

记录全域通过 `panXDomain` 固定；`initialXDomain` 是首次及重置窗口，可以是全域的一部分。
它们都不随响应的采样密度、覆盖范围或空结果变化。组件始终保留传入的空系列的身份、图框
及交互能力，不依赖 `panXDomain`；空窗口只隐藏曲线、采样点及误差棒。相同系列 ID 和轨道 ID
的空窗口沿用之前的坐标域，首次为空时使用显式坐标域或默认域；无采样点的系列不参与最少
可见点约束。配置有效 `panXDomain` 后，未加载区域可以继续缩放和平移。
Demo 窗口加载器将响应中缺失的已知系列补为空数据，保留顺序及元信息；独立图框请求只更新
指定系列，新增系列按响应顺序追加。直接从组件 `data` 删除系列仍会删除对应图框，传入
`{ kind: 'series', series: [] }` 可清空全部系列；空系列与 `grid.trackOrder` 的空槽位不同，
不会被 `hideEmptyTracks` 或末行填充过滤。
公开 `normalizeWaveformSeries` 的空系列过滤行为不变。

远程 demo 默认开启整数缩放，使用
`xDomainStrategy: { type: 'integer-ms', includeExplicit: true }` 在首次显示及重置时向外扩展
整数毫秒范围；跨度达到一个显示单位时缩放优先对齐整数，小于一个显示单位时保留小数。
回填和单位切换不会重新对齐当前视口，平移保持窗口跨度。
Demo 的 `panXDomain` 同样使用扩展后的记录范围，避免尺寸变化或视口恢复将整数端点裁回
原始采样端点；加载器元数据和采样坐标仍保留原值。
它还设置 `minVisiblePoints: 2`、`maxZoomScale: null`，在已加载窗口内缩到两个真实采样点后停止放大。
最小跨度从完整模拟记录的相邻采样间隔固定计算，不会根据回填的点数重新计算；未加载或不足两点的
远程窗口仍沿用最小跨度限制。真实后端应通过元数据提供最小跨度；等间隔采样若至少需要 N 点，
可使用 `(N - 1) * sampleIntervalSeconds`。后端抽稀时不宜用返回点数限制原始采样尺度的进一步放大。

仓库内的 demo 接入方式如下。以下 composable 和加载器属于 demo 辅助模块，不是包的公开导出：

```vue
<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { WaveformChart } from 'waveform-analysis/vue'
import { createSimulatedWaveformData } from '@/demo/data/simulatedWaveforms'
import { createMockWindowLoader } from '@/demo/remoteWaveformLoader'
import { useRemoteWaveformWindow } from '@/demo/useRemoteWaveformWindow'
import { alignDemoDomain } from '@/demo/alignDemoDomain'

const chart = ref<{ resetViewport: (trackIndex?: number) => void }>()
const record = shallowRef(createSimulatedWaveformData())
const xDomainStrategy = { type: 'integer-ms' as const, includeExplicit: true }
const {
  chartData,
  recordDomain,
  initialXDomain,
  minZoomSpan,
  loading,
  errors,
  handleZoomIntent,
  handleZoomChange,
  handleZoomEnd,
  handlePanEnd,
  resetWaveformViewport,
  retry,
} = useRemoteWaveformWindow(record, {
  loadWindow: createMockWindowLoader(() => record.value, { delayMs: 80 }),
  resetViewport: (index) => chart.value?.resetViewport(index),
})
const panXDomain = computed(() => alignDemoDomain(recordDomain.value))
onMounted(() => void resetWaveformViewport())
</script>

<template>
  <p v-if="loading" role="status">正在加载当前时间范围…</p>
  <p v-if="errors.length" role="alert">
    {{ errors.join('；') }}
    <button :disabled="loading" @click="retry()">重试</button>
  </p>
  <WaveformChart
    ref="chart"
    :data="chartData"
    :pan-x-domain="panXDomain"
    :initial-x-domain="initialXDomain"
    :min-zoom-span="minZoomSpan"
    :min-visible-points="2"
    :max-zoom-scale="null"
    :integer-zoom="false"
    :x-domain-strategy="xDomainStrategy"
    pannable
    @zoom-intent="handleZoomIntent"
    @zoom-change="handleZoomChange"
    @zoom-end="handleZoomEnd"
    @pan-end="handlePanEnd"
    @zoom-reset="resetWaveformViewport"
  />
</template>
```

加载器签名为 `loadWindow({ start, end, seriesIds? }, signal): Promise<WaveformData>`，
坐标和事件端点始终是秒。模拟加载器还支持 `empty`、`fail` 和 `delayMs`，既可以传固定值，
也可以传按请求计算的函数，以验证空响应、失败和乱序。
主 demo 可通过 Vue `provide(remoteWindowLoaderKey, loadWindow)` 注入替代加载器。
连接真实接口时，在消费页面构造请求并将 `signal` 传给 `fetch`；不要在图表库内写死地址。
真实后端的记录元数据与原始数据请求应分开，模拟器持有完整记录仅用于生成响应。

业务若返回聚合或抽稀点，这些点只代表当前加载精度；需要精确原始点的悬浮查询、标注和
误差范围应另行加载。前端渲染抽稀仍以完整已加载数据进行查询，不能恢复后端未返回的点。

组件支持 Plotly 风格的矩形框选缩放：在 zoom 模式下按住鼠标左键拖拽，松开后同时缩放
X/Y 轴；设置 `pannable` 后，指针位于图表内时按住空格键拖拽可平移当前视口。
鼠标滚轮可放大和缩小，统一通过重置按钮恢复完整视口，双击不再重置。每次有效滚轮事件以鼠标所在的 X 位置为基准，
向上滚动将 X 范围缩小一半，向下滚动将 X 范围扩大一倍；滚动幅度不影响单次倍率。
滚轮与放大/缩小按钮共用边界、整数对齐及最小点数约束，按钮以视口中心为基准。
组件会在真实滚轮或框选确定目标范围时同步触发 `zoom-intent`，可立即取消过时请求并启动
新请求；缩放结束后仍会触发 `zoom-end`。独立分图模式还会包含 `trackIndex` 和稳定的
`seriesIds`。

```vue
<WaveformChart
  ref="chart"
  :data="chartData"
  :initial-x-domain="initialDomain"
  :min-zoom-span="initialDomainSpan / 40"
  pannable
  @zoom-intent="loadVisibleData"
  @zoom-reset="restoreInitialData"
/>
```

`zoom-change` 会在滚轮、框选和平移过程中触发，适合更新外部状态。后端按视口回填数据时，
应使用 `zoom-intent` 使每次用户意图立即使旧请求失效；`zoom-end` 适合只在手势完成后执行
的工作。标注数据应由父组件独立持有，替换波形数据时不要清空标注，组件会根据当前数据域
自动隐藏或恢复对应标注。

`zoom-end.gesture` 用于区分 `wheel`、`box` 和新增的 `command`。单轨道 payload 使用 `yStart/yEnd`；共享
X 轴且包含多个轨道时使用按稳定 track ID 索引的 `yRanges`。平移不会触发 `zoom-end`，
平移结束且 X 范围变化时触发 `pan-end`，可在此请求新的时间段。

远端时间段平移可配置 `panXDomain` 为整条记录的起止时间。启用后，空格 + 拖动只改变 X
范围，保持当前窗口宽度和 Y 轴；到达记录边界时停止。未配置或范围无效（非有限值、起点不小于
终点）时保留原来的数据内 X/Y 平移行为。

```vue
<WaveformChart
  :data="waveformData"
  :pan-x-domain="[recordStartSeconds, recordEndSeconds]"
  pannable
  @pan-end="loadTimeWindow"
/>
```

`pan-end` 的公开类型为 `WaveformPanEndPayload`，包含以秒表示的 `start/end`；独立模式还包含
`trackIndex/seriesIds`，业务页面据此只更新对应图框的数据，保留其他序列及稳定 ID。松开鼠标后
按端点请求，用新的 `data` 引用回填；组件会保持当前 X 视口，包括返回点稀疏、缓存范围更大或
当前视口与旧数据窗口等宽的情况。不要为每次请求修改 `initialXDomain`，它仍表示重置范围。
加载期间超出已加载数据的区域显示空白，加载状态和错误提示由业务页面提供。

配置远端边界时，滚轮、框选和 `setViewportDomain` 在记录范围内约束，最小缩放跨度及倍率
仍基于初始数据域；与已加载数据范围重叠的缩放窗口还会按 `minVisiblePoints` 保留真实采样点，
避免仅满足时间跨度却缩到一个点后停止。未加载区间没有真实点数，因此不会用点数约束将目标窗口拉回
已加载数据。回填时保留 X 范围，不重新应用点数约束。取消拖动或范围没有变化不会触发 `pan-end`。
平移过程中用 `zoom-change` 使旧请求失效，完成后用 `pan-end` 发起请求；对缩放仍使用
`zoom-intent`。业务页面应使用请求序号或取消机制，避免旧响应覆盖更新的目标窗口。

调用方应处理加载失败的情况（网络错误、超时等），并保持旧数据或显示加载状态。生产环境建议使用
`AbortController` 取消过时的请求。

`initialXDomain` 固定首次及重置时的 X 轴视口范围，不要将它改成后端返回的当前窗口；范围可以超出数据的实际时间，超出部分保留空白。独立图框有不同时间范围时，可通过
`initialXDomains` 按 track ID 或 series ID 分别配置。`minZoomSpan` 使用原始 X 数据单位，
可防止每次区间数据回填后重新累计放大。未配置任何缩放约束时保留既有的 40 倍兜底；设置
`minVisiblePoints: 2` 可缩放到两个真实采样点，`maxZoomScale: null` 可显式关闭倍率上限。
最少点数约束检查缩放后的范围；当前已有两个可见点时，滚轮、按钮和框选仍可继续收窄，
直到达到真实最小范围。视口外用于延续折线的邻点不计入可见点数。
共享 X 轴的多图框只需至少一个图框满足最少点数约束：稀疏图框可剩一个点或为空，
仍保留图框、坐标轴及布局；其他图框有余量时继续同步放大，直到没有图框能支持更小窗口。
点数按每个图框内不同 X 坐标的并集计算，不跨图框合并；独立图框分别约束。
空图框及不足最少点数的图框不阻止其他图框缩放，显式最小跨度和最大倍率仍然生效。

设置 `:integer-zoom="true"` 可开启整数缩放，默认关闭。开启后滚轮、框选和
`setViewportDomain` 优先将开始时间向下取整、结束时间向上取整；`timeUnit='ms'` 时对齐整毫秒，
`timeUnit='s'` 时对齐整秒。若跨度小于一个显示单位，
则保留小数范围及小数标签、刻度，例如秒模式下 `1.2～1.8` 和 `1～1.4` 保留小数，
跨整数的 `1.8～2.2` 也保留原范围；负数采用相同规则。初始范围和重置范围也遵循此规则。
整数模式不额外限制最小跨度，配置的最小跨度、最大倍率和最少可见点数限制仍然生效。
滚轮或放大按钮若因向外取整而无法继续缩小，会改用满足相同约束的小数范围；例如
`1988～1991 ms` 可继续放大为 `1988.75～1990.25 ms`，不会因整数对齐提前禁用。
平移时保持当前跨度；小数视窗跨越整数边界时仍保留小数。记录边界和最小跨度约束优先。
动态切换此开关会重置视口；切换时间单位只更新显示，不改变当前原始范围。demo 默认开启此开关。
原始采样坐标不会被修改，缩放事件仍以秒返回实际对齐后的范围；自定义 formatter 不影响对齐粒度。
关闭时 `timeUnit` 仍只影响展示，不改变缩放范围。
显式设置多种限制时采用最严格的一项。点击工具栏重置按钮会
重置组件内部缩放并触发 `zoom-reset`；调用方应在事件中取消区间请求并恢复首次完整数据。
外部重置按钮也可以通过模板引用调用组件公开的 `resetViewport()` 方法，然后执行相同的数据恢复逻辑。

宿主在替换局部数据后如果需要恢复之前保存的 X 视口，可以调用公开的
`setViewportDomain(domain, trackIndex?)`。传入范围使用原始秒坐标，组件会按当前数据边界、
`xDomainStrategy`、`minZoomSpan`、`minVisiblePoints` 和 `maxZoomScale` 重新约束；无效范围会被忽略。共享
X 轴模式直接传入一个范围，独立模式可以按实际 `trackIndex` 分别设置（省略 `trackIndex`
时应用到当前所有图框）：

```ts
chartRef.value?.setViewportDomain(previousDomain)
chartRef.value?.setViewportDomain(trackDomain, trackIndex)
```

建议在 `data` 引用更新后调用该方法。组件也会在数据引用变更时重投影当前内部视口，避免新
数据边界使旧 transform 失效；`resetViewport(trackIndex?)` 的既有行为保持不变。

没有显式配置初始范围时，可以通过 `xDomainStrategy` 将数据范围扩展为便于阅读的视口端点。
默认的 `{ type: 'integer-ms' }` 将数据范围向外贴近合适的整十毫秒边界；`type: 'data'` 保持数据
最小值和最大值不变；`type: 'nice'` 使用固定刻度数量计算
易读边界，且只扩展视口，不修改原始点位、tooltip、标注或缩放事件值：

```vue
<WaveformChart
  :data="chartData"
  :x-domain-strategy="{ type: 'nice', bounds: 'end', tickCount: 10, includeExplicit: true }"
/>
```

例如秒坐标数据范围为 `[0, 4.999999]` 且 `timeUnit='ms'` 时，上述配置会使用
`[0, 5]` 作为初始及重置视口，两端 label 显示 `0` 和 `5000`。`bounds: 'end'`
只扩展右端；默认的 `bounds: 'both'`
会同时扩展两端。`tickCount` 默认为 `10`，只参与边界计算，不随组件宽度变化。
`initialXDomains`、`initialXDomain` 的显式配置默认保持原值；仅当 `includeExplicit: true` 时
也应用 nice 扩展。独立模式在未配置显式范围时
按图框分别计算，共享 X 轴模式则合并所有可见图框后计算。所有范围仍使用原始秒坐标，
`timeUnit` 只影响显示。

若显式配置初始范围也需要贴近整十毫秒边界（例如 `-62881.52` 到 `14999.999`
显示为 `-63000` 到 `15000`），可设置 `xDomainStrategy` 为
`{ type: 'integer-ms', includeExplicit: true }`。该策略依据范围选择主刻度十分之一作为端点
取整步长，不采用可能将末端扩大至 `20000` 的主刻度；短范围保留毫秒精度。
显式初始范围仍须通过 `includeExplicit` 开启，原始数据坐标不变。

独立坐标模式下，回填响应应只替换 `seriesIds` 对应的系列，并调用
`resetViewport(trackIndex)`；其他图框的数据和缩放状态应保持不变。独立模式下通过外部 API 指定目标图框并调用重置，
`zoom-reset` payload 会包含该图框的 `trackIndex` 和 `seriesIds`；选择当前页全部时按图框分别触发事件。
共享 X 范围模式表示全局复位。忽略事件参数的既有监听器可以继续使用。

多通道数据应为每个 `WaveformSeries` 提供稳定的 `id`。内部时间坐标始终使用秒，
`timeUnit` 只控制坐标轴和 tooltip 的显示单位。

X 轴默认以 5 段为目标，按 ECharts 风格的 `1 / 2 / 3 / 5 / 10 × 10ⁿ` 生成规则刻度，
不扩展当前视口。标签保留绝对时间及区分相邻值所需的小数位，不使用公共基准偏移，
也不因超过六位小数而自动切换科学计数法；超出安全定点格式化范围时才回退。
标签渲染后按实际文字边界避让，优先保留首尾端点；两个端点冲突时保留起点，
单个标签超过图框宽度时隐藏。标签之间至少间隔 4px，隐藏文字不改变网格或原始坐标。
自定义 `axes.x.labelFormatter` 的输出同样参与避让，容器变宽后会恢复可容纳的标签。

Tooltip 每个系列按 `炮号：通道  (x:值 y:值)` 格式显示。`WaveformSeries.shotNo` 为空或未提供时，
炮号显示为“未配置炮号”；配置 `series.unit` 时在通道名后显示 `(单位)`，不显示误差附加文本。

### 标题与时间标签贴边布局（可选）

```vue
<WaveformChart
  :data="waveformData"
  layout-preset="edge-compact"
  :title="{ text: 'shot: #1001', textStyle: { fontSize: 18, fontWeight: 700 } }"
  x-label="Time(ms)"
  :plot-margin="{ top: 10, bottom: 44 }"
/>
```

公共类型 `WaveformLayoutPreset = 'default' | 'edge-compact'`，对应
`WaveformChartProps.layoutPreset`。默认 `'default'` 保持既有标题、时间标签、宽窄分页
布局；可与 `unitDisplayMode='legend-single-series'` 一起使用。
综合 demo 默认启用 `edge-compact`，绘图区边距为 `{ top: 10, bottom: 44 }`。
综合 demo 使用 `unit-display-mode="channel-label"`：单位追加到 Y 轴名称后，
刻度只保留数值和科学计数法倍率，多曲线页面仍显示 Y 轴名称。

`'edge-compact'` 下，标题区域使用实际测量的文字显示高度加 8px，顶部约 4px 留白，
不再强制最少 44px。设置 `plotMargin.top=0` 时，标题底部距内部绘图上边框约 4px。
无标题、空标题或 `title.visible=false` 时不预留标题区。
标题字体仍由 `title.textStyle` 控制，保留长标题换行及旋转缩放（旋转标题区域上限
仍为 160px）。测量完成前使用文字尺寸估计，不重复放大已经测量的多行高度。

时间标签（`xLabel`，默认仍为 `时间（ms）` 或 `时间（s）`）在贴边布局中跟随标题字号，
水平居中于绘图区，紧凑模式基线为 `drawingHeight - 9px`，比原位置下移 3px，
增加与上方刻度区域的间隔；默认布局仍为 `drawingHeight - 12px`，不设置额外的
`dominant-baseline`。通过 `xLabel='Time(ms)'` 传入严格的业务文字，组件不自动改写。
贴边布局分页按钮保持组件默认的 32px 高度，可见时统一预留 16px，不随容器宽度、页数或时间标签长度变化；结合已有的 44px 底部总预算，
图框底边距卡片内容下沿共 60px，末尾 X 刻度与右下分页顶部约留 5px 安全间距。
相较预留 40px，图框向下延伸 24px；Time 仍居中，其基线距内容
下沿 25px，与右侧分页处于同一底部水平区域。预留条件与按钮显隐一致：
`grid.showPagination && pageCount > 1 && !cleanView`。
多页、窄容器或长标签均不再触发额外的避让高度；时间标签与分页在空间不足时可能重叠。
没有分页或净图模式不预留按钮区。`cleanView` 仍隐藏时间标签及标题文字，保留既有标题区域策略。

紧凑模式的 `plotMargin.bottom` 最小为 44px（传入 35px 会按 44px 布局），该总预算
已包含最后一行的 30px X 轴刻度带，不再额外叠加；最下面的网格图框底边距绘制 SVG
下沿为 44px（更大的有效边距仍保留）。中间行刻度带不变，尾部空行无 X 轴时不补偿。
净图模式不应用刻度带补偿，保留现有刻度与网格布局。
最高和最低 Y 刻度（含科学指数和单位）与普通刻度保持相同的垂直居中方式，文字中心
对齐刻度位置；上边界普通标签隐藏，开启的最大值标签保留；下边界文字中心对齐图框底边，
不额外向图框内偏移。
建议设置 `plotMargin.top` 至少为 10px，避免顶部文字被 SVG 裁剪；
`top=0` 仍按传入值布局，但顶部标签可能显示不完整。
紧凑模式的图框边框路径向内缩半个实际 `frameStyle.borderWidth`，四边使用同一描边
线宽，完整描边保持在原图框范围内；刻度文字仍需独立预留顶部空间。
外层卡片继续裁切溢出内容，默认布局的边框几何保持不变。
刻度字号保持原值。`plotMargin` 不改变标签距底部的位置。该布局只影响展示尺寸，
既有平移事件与范围、单位模式、tooltip 和 Y 轴上限留白 API 保持不变。

### 客户图例单位规则（可选）

```vue
<WaveformChart :data="waveformData" unit-display-mode="legend-single-series" />
```

公共类型 `WaveformUnitDisplayMode = 'axis' | 'legend-single-series' | 'channel-label' | 'channel-label-or-legend'`，也可通过
`WaveformChartProps.unitDisplayMode` 配置。默认 `'axis'` 保持现有行为（单位在 Y 轴最高
刻度中，单曲线图框不显示图例）。通常仅在图框包含至少两条曲线时显示图例；
`channel-label-or-legend` 模式下，当前页统一隐藏左侧通道名称时，单曲线图框也显示图例。
曲线数量依据完整 series 列表，隐藏曲线仍计数，便于重新显示。以下为客户单位规则：

- 整个图表的所有非空 track 都只有一条曲线时，不展示图例；单位去除两端空白，缺失、
  空白或占位值 `--` 不追加括号。
- 任一 track 包含多条曲线时，整个图表的图例只显示原始名称，所有 Y 轴也隐藏单位。
  判定依据是曲线数量，而非 Y 轴分组数量，同单位共用一根轴的多曲线图框同样适用。
- 判定使用分页前完整的 track 曲线列表，跨页一致；`grid.trackOrder` 的空图框和补齐
  槽位不参与判定；隐藏曲线仍计数，包括全部曲线隐藏的图框，切换可见性不会改变规则。
  替换 `data` 后重新判定。只有从数据中移除曲线才改变曲线数量。
- 客户模式始终隐藏轴单位，科学计数法 `E+04` 等仍保留在最高刻度（左侧 Y 轴顶端
  左侧；多 Y 轴各自保留倍率），刻度缩放和数值不变。多曲线规则不隐藏倍率。

继续将真实单位写入 `series.unit`，名称写入 `series.name`（可已包含炮号）。组件只在
展示层组合图例文字，不修改名称或单位；tooltip 仍使用原始名称和单位字段，例如
`CH1(1001)(V)`，标注元数据也保持原值。图例位置、排列、交互仍由 `legend` 控制，
`cleanView` 仍隐藏图例。`pan-end`、`panXDomain`、`axes.y.upperPaddingRatio` 不受影响。

### 纵轴单位

可在每个 `WaveformSeries` 上设置可选的 `unit`，单位会显示在对应 Y 轴的顶部刻度中：

```ts
const chartData = {
  kind: 'series',
  series: [
    {
      id: 'voltage',
      name: '电压',
      unit: 'V',
      data: {
        kind: 'points',
        points: [
          { x: 0, y: 1200 },
          { x: 1, y: 3000 },
        ],
      },
    },
  ],
} satisfies WaveformData
```

当 Y 轴使用科学计数法时，顶部刻度格式为 `E+03 3`，不追加单位；未使用科学计数法时，格式为
`(V) 3`。单位为空、全为空白或未配置时，不显示 `(单位)`，例如仍显示为 `E+03 3` 或 `3`。
多值轴模式的右侧 Y 轴将指数放在数值右侧，例如 `3 E+03`，不追加单位；不使用科学计数法时显示为 `3 (V)`。
多 Y 轴模式下，每根轴使用该轴首个 series 的单位。

左侧通道名称使用 12px、字重 600 的加粗文字。名称位置和轴外留白共用稳定的轴空间预算，
名称与固定数值区域之间保留 2px 间隔，外侧至少保留 6px；完整刻度所需的额外空间留在名称外侧，不强制两侧等距。
数值区域覆盖普通数字含可见单位、科学计数法尾数；按稳定预算而非当前文字宽度定位，短数字旁可能仍显得更空。
完整倍率仍参与轴外边界预算，但不参与名称避让，倍率与名称共用横向空间以缩小留白。
预算不随当前刻度、名称长度或图框高度变化。同一列中相同轴位分别汇总完整刻度宽度和
名称避让宽度，保证多道名称垂直对齐；右侧 Y 轴使用镜像布局。
图框高度不足 80px 时也不会隔道隐藏名称；例如 5×1 布局中，每个符合名称展示规则的图框
仍显示完整通道名称，允许长名称互相重叠。净图模式及单位展示模式的显隐规则仍然生效。

默认布局和 `edge-compact` 均按 11px/700 sans-serif 的 Y 刻度字体计算稳定宽度预算，
并使用 7px 刻度间距、默认 20px 名称带及名称到数值区域的 2px 间隔确定轴槽位、名称位置和边距。
最外侧槽位包含实际组件边缘留白；右轴按相同规则镜像，额外外边距不改变名称到数值区域的距离。
隐藏的单位不参与预算，科学计数法倍率保留在最高可见刻度同行，完整纳入轴外边界计算。
倍率与通道名碰撞时允许重叠，不移动、隐藏或扩大留白；短图框、长通道名和指数迁移时也遵循此规则。
`edge-compact` 最外侧轴内容左边保留至少 6px 外部留白，为单轴图框右侧 24px 留白的四分之一，不再使用
默认布局的固定 48px 最小左边距。多轴使用各轴位的最大刻度宽度，多列同时预留相邻
图框的轴内容，避免完整刻度越界或侵入相邻图框。默认布局保留原有最小边距。
浏览器通过 Canvas 测量格式化规则所需的文字宽度；无 Canvas 时按数字与小数点字宽估算。
缩放、平移和重置期间，左右留白、轴槽位、名称位置及列间距保持稳定；数据、轴配置、
分页、显隐或容器尺寸变化时允许重新布局。为覆盖缩放后可能出现的较长刻度，部分场景
会比按当前文字测量预留更多横向空间。

`overlayMode='multi-axis'` 下，容器宽度不足以容纳全部轴和每列至少 120px 的绘图区时，
SVG 保持所需的最小内容宽度，由外层容器提供横向滚动，所有轴和通道名称继续保留。
缩放、平移和重置不会改变滚动内容宽度；容器重新获得足够宽度时自动恢复普通布局。
此行为无需新增配置；单轴模式保留小容器下隐藏次要列通道名称的现有规则。

### 线型、点型与误差棒

每条序列可以独立设置连线方式、数据点符号和误差棒：

```ts
const series = {
  id: 'temperature',
  shotNo: '13300',
  name: '温度',
  lineType: 'step-end',
  lineStyle: 'dashed',
  pointType: 'circle',
  pointSize: 4, // 本系列覆盖全局点大小，单位 CSS px
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

`lineType` 支持 `none`、`linear`、`step-start`、`step-middle` 和 `step-end`；它控制连接线的几何形态，兼容值
`step-after` 与 `step-end` 等价。三个阶梯值分别在区间起点、中点和终点跳变。`pointType`
支持 `none`、`circle`、`square`、`triangle` 和 `diamond`。默认使用普通直线且不显示数据点；
`lineStyle` 控制连接线的描边样式，支持 `solid`、`dashed` 和 `dash-dot`，默认值为 `solid`；
设置 `lineType: 'none'` 可以隐藏数据点之间的连接线，只保留点符号和误差棒；将其改为
`linear` 或阶梯类型即可同时显示对应连接线。误差棒仅在 `errorBar.visible` 为 `true` 时显示，
并参与 Y 轴范围计算；当误差棒可见时，`lineType` 和 `pointType` 可以同时为 `none`，用于展示
纯误差棒。只有连接线、点符号和误差棒全部关闭时才会回退为普通直线。`lowerError`、
`upperError` 分别覆盖对称的 `error`，图例会同步显示实际线型、点型和误差棒样式。

全局 `pointSize` 默认 **2**，表示圆点直径（CSS px）；其他形状按等面积圆换算。
原生创建选项或 `chart.setOption({ pointSize: 3 })` 可以设置全图大小，Vue 使用
`:point-size="3"`。系列的 `pointSize` 优先覆盖全局配置；移除该字段并替换 `data`
即可恢复继承。全局只接受有限正数，否则报 `invalid-option`；无效系列值回退全局配置。
点大小不随缩放变化，图例使用相同大小；隐藏点请设置 `pointType: 'none'`。
未配置大小的图表也使用新的 2 px 默认值（此前固定面积为 48 px²）。

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

所有布局模式均隐藏图框上边界的普通 Y 轴标签；开启最大值刻度展示时保留最大值标签及短线。`compact` 多道紧密模式还会在最高可见
普通刻度标签与最低刻度标签重叠时隐藏最高普通标签，开启的最大值标签不参与隐藏。刻度线、网格、
数据范围和文字对齐位置不变，科学计数法倍率与单位随最高的可见标签显示。
上方留白区域内的原始最大值标记及标签始终保留，即使与相邻道的最小值标签重叠。
其他布局模式不应用额外的标签避碰规则。

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
居中、字号 `14px`、颜色 `#1f2937`、微软雅黑、常规字重且不旋转。居中标题和 X 轴标题均
对齐绘图区图框的水平中心（左侧绘图边距 + 绘图区宽度 / 2），随 Y 轴留白及容器尺寸变化
同步调整；适用于默认、紧凑和边缘轴布局。显式左对齐贴齐绘图区左边，右对齐保留原有标题区域。
标题区域高度按文字及旋转角度
在 `44px` 至 `160px` 之间计算；超长文字会省略，悬浮可查看完整内容。

`width` 和 `height` 始终表示组件总尺寸。标题显示后会从总高度中扣除标题区域，剩余高度
用于 SVG 绘图区，因此启用标题不会扩大组件或破坏父容器布局。

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

`frameStyle.borderStyle` 支持 `solid`（实线）、`dashed`（虚线）和 `dotted`（点虚线）。

对应的公开类型为 `WaveformFrameStyle`。默认边框颜色为 `#1f2937`、线宽为 `1`、线型为
`solid`，背景透明。`borderWidth` 为 `0` 时隐藏边框；非有限值或负数会回退到默认线宽。

多道紧凑和多道分离模式中，未填满的网格槽位显示空图框边框（例如 5 行 × 2 列中只有 9 个数据图框时，
右下角补一个空图框），沿用 `frameStyle` 的边框和背景样式，显示默认网格线，
并在启用 `frameNumber` 时按槽位延续图框编号；空图框不添加波形或 Y 轴。
多道分离保留图框间距及每列最后一个数据图框的 X 轴位置。
多道紧凑中相接的图框（包括空图框）共用一条水平分隔线：上方图框省略与下方重合的底边，
由下方图框的顶边绘制，避免交界处出现双倍线宽，也避免不透明背景覆盖共享边框。
不同宽度图框仅省略实际重合的边段；非相接边框保持完整。

### 图例与曲线显隐

每个图框独立管理自己的图例：图框内有两条或更多曲线时显示图例，只有一条曲线时不显示。
在 `channel-label-or-legend` 模式下，若当前页统一隐藏左侧通道名称，单曲线图框也显示图例。
`legend.backgroundColor` 设置图例的背景颜色。该字段接受任意有效 CSS 颜色值，
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
    trackPositions: {
      'group-1': 'top-left',
      'group-2': 'bottom',
    },
    orientation: 'auto',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    interactive: true,
  }"
/>
```

`legend.trackPositions` 按图框 ID 单独覆盖图例位置；同一个 `trackId` 组成的图框以该
`trackId` 为键，未设置 `trackId` 时以规范化后的 `series.id` 为键。未命中的图框继续使用
`legend.position`，两者都未配置时使用 `top-right`。当 `orientation` 为 `auto` 时，每个图框
会根据最终位置独立选择排列方向：`top`、`bottom` 为水平排列，其余位置为垂直排列。

未配置或传入空字符串时，图例背景默认透明（`transparent`），文字字号为 `11px`，
字体为 `Times New Roman`（回退到 `serif`）；组件原生 tooltip 同样使用该字体，字号为 `11px`，与 X、Y 轴刻度一致。
仍可通过 `legend.backgroundColor` 指定其他背景颜色。
`legend.interactive` 默认为 `false`；开启后可以单击或使用键盘操作图例项切换曲线显隐。
调用方可通过 `hiddenSeriesIds` 和 `update:hidden-series-ids` 控制状态，也可使用
`defaultHiddenSeriesIds` 设置非受控模式的初始隐藏项。隐藏状态同步作用于坐标轴、tooltip、
悬浮点和标注交互；允许隐藏全部曲线，并可通过保留的图例恢复显示。图框内全部曲线隐藏时，
仍按该图框的完整数据保留 X/Y 轴刻度值及已启用的网格，显式配置的坐标范围仍然生效。

显隐状态以规范化后的 `series.id` 为键。要在数据刷新和重新排序后稳定保留状态，每个系列都应
提供全图唯一且稳定的显式 `id`；自动生成的索引 ID 或重复 ID 添加的后缀不保证跨排序稳定。

### 零值参考线与净图

`zeroLine` 用于绘制 `y = 0` 的水平参考线，默认显示红色（`#ff0000`）、1px 宽的虚线
（`dash: '6 4'`），透明度默认为 `0.5`。参考线只在对应 Y 轴的当前 domain
严格跨过 0，且距两端均不小于一个主刻度间距的 2% 时渲染；零线位于边界时隐藏。
不会为了显示参考线而扩展数据范围。零线绘制在曲线、点标记及误差棒上方。
多值轴模式下，每根可见 Y 轴分别按自身
scale 定位零线：

```vue
<WaveformChart
  :data="chartData"
  :zero-line="{
    visible: true,
    color: '#ff0000',
    width: 1,
    dash: '6 4',
    opacity: 0.5,
    boundaryThreshold: 0.02,
  }"
/>
```

`dash` 直接对应 SVG 的 `stroke-dasharray`；传入空字符串可显示实线。无效或非正数的
`width` 会回退到 `1`。

只传入颜色或线型时仍默认显示，例如 `:zero-line="{ color: '#0960bd', dash: '' }"`
显示蓝色实线。使用 `:zero-line="{ visible: false }"` 可关闭零线。颜色和线型配置可动态修改。

`boundaryThreshold` 可动态调整边界隐藏比例，例如 `0.05` 表示一个主刻度间距的 5%，
`0` 表示仅在恰好位于边界时隐藏；负数或非有限值回退到 `0.02`。
`opacity` 支持 `0` 到 `1`，越界或非有限值回退到 `0.5`。颜色本身的 Alpha 与该透明度相乘；
若使用 `rgba()` 或八位十六进制颜色的透明度，可设置 `opacity: 1`。
主演示页的“零值参考线”区域可直接调整透明度，修改后立即应用于波形图。

设置 `cleanView` 后，组件保留波形、图框边框、X/Y 轴刻度及刻度值，并隐藏标题内容、图例、
网格、轴标签、图框背景、帧水印、零值参考线、标注和分页器。原图的标题区域、边距和波形
尺寸保持不变；缩放、悬浮、十字线和 tooltip 仍然可用，切换回普通模式后原有配置和标注
不会丢失：

```vue
<WaveformChart :data="chartData" :clean-view="cleanViewEnabled" />
```

### 网格、分页与交互模式

`grid` 控制独立图框的行列数（范围 `1–10`）以及是否显示分页器。默认值为 `2` 行、
`1` 列并开启分页；当图框数量超过网格容量时，分页器会显示在图表右下角。

`fillIncompleteLastRow` 默认关闭，未满页的剩余位置使用与实际图框相同样式的空图框，
保留网格和图框编号，不绘制波形、Y 轴或交互层。开启后，分页容量仍由 `rowCount * columnCount` 决定；
最后一页或未满页会移除没有数据的整行，并将最后一行的实际图框等宽铺满可用宽度。例如 2 列
网格的最后一行只有一个图框时，该图框会占满整行。完整页和关闭该选项时的布局保持不变。

还可以通过 `trackLines` 按轨道 ID 分别控制水平/垂直网格线的显隐和颜色。颜色未配置时，
继续使用组件默认的主/次网格颜色：

```vue
<WaveformChart
  :data="chartData"
  :grid="{
    rowCount: 2,
    columnCount: 2,
    showPagination: true,
    fillIncompleteLastRow: true,
    trackLines: {
      voltage: {
        horizontal: false,
        vertical: true,
        verticalColor: '#2563eb',
      },
    },
  }"
  :interaction-mode="interactionMode"
/>
```

`axes` 可以分别隐藏 X/Y 轴的基线，同时保留刻度短线、刻度数字、科学计数倍率、单位和轴标题。
与关闭网格线、设置 `frameStyle` 组合后，可以只使用图框边框围住绘图区：

```vue
<WaveformChart
  :data="chartData"
  :axes="{
    x: { lineVisible: false },
    y: { lineVisible: false },
  }"
  :grid="{
    trackLines: {
      voltage: { horizontal: false, vertical: false },
    },
  }"
  :frame-style="{
    borderColor: '#1f2937',
    borderWidth: 1,
    borderStyle: 'solid',
  }"
/>
```

X 轴主刻度参考 ECharts 数值轴算法，以当前可视域跨度除以目标分段数，选择
`1 / 2 / 3 / 5 / 10 × 10ⁿ` 的漂亮步长，目标分段数默认为 5，实际数量可能不同。
可通过 `axes.x.splitNumber` 设置目标分段数，例如：

```vue
<WaveformChart :data="chartData" :axes="{ x: { splitNumber: 10 } }" />
```

该值是目标段数，不是强制标签个数；修改后即时更新刻度和网格，不改变当前视口。
有限数值四舍五入并限制为至少 1，未设置或非有限值使用 5；文字重叠时仍自动隐藏。
刻度计算精度为步长的小数精度加两位。该算法只生成域内刻度，不扩展可视域；
自动域、显式域、`xDomainStrategy` 及缩放和平移约束继续决定范围。
左右端点标签优先显示，重叠文字按渲染后的实际边界隐藏；次网格线按完整主刻度间隔三等分生成。
整数缩放在整数视口下使用至少一个显示单位的步长，小数视口仍允许小数刻度。
极端数值或超出刻度安全上限时回退到 D3 刻度算法。回退结果同样会过滤非有限值、
去重并规范化负零；若实际数量超过 3000，会降低目标数量重新生成等距刻度。
无法生成有效刻度时只保留能够容纳的独立端点标签，不修改可视域。

X 轴刻度和左右端点默认先按 `timeUnit` 转换为秒或毫秒，再显示为无千分位的自适应精度
数值。内部刻度的精度随数值决定，不强制补零，不限制为六位小数；消除负零及不影响
可见分辨率的浮点尾差。左右端点在单位换算后最多保留四位小数：左端向下取整、右端向上取整（负数同样向外取整），省略末尾零和负零。此规则仅影响默认显示，不改变原始坐标、视口范围或自定义格式化器接收的值。
内部刻度需要超过 100 位小数或绝对值达到 `1e21` 时回退为科学计数法。原始数据与事件值不变。
可通过 `axes.x.labelFormatter` 对显示值做运算和格式化：

```vue
<WaveformChart
  :data="chartData"
  :axes="{
    x: {
      labelFormatter: (value, context) =>
        `${context.kind === 'tick' ? '' : '[' + context.kind + '] '}${(value / 1000).toFixed(3)}`,
    },
  }"
/>
```

formatter 首参是已按 `timeUnit` 换算的数值；上下文包含 `kind`（`tick`、`start` 或 `end`）、
原始 `rawValue`、`timeUnit`、原始可视域 `domain` 和换算后的 `displayDomain`。formatter 只决定
label 文本，不改变刻度位置、源数据、缩放域或事件中的原始 X 坐标。

Demo 左侧“网格与轴线”支持直接切换数值或固定时间格式。数值模式可设置运算倍率和小数位数；
固定时间模式输出 `YYYY-MM-DD HH:mm:ss[.SSS]`，可选择中国标准时间、本地时区或 UTC，并控制
是否显示毫秒。时间戳数据仍按组件的秒坐标契约传入，使用默认毫秒显示单位时 formatter 会收到
可直接传给 `Date` 的毫秒时间戳。

`interactionMode` 可选 `zoom`、`pan`、`annotation` 或 `none`，默认使用缩放模式。在内置工具栏选择标注或设置
`interactionMode="annotation"` 后，左键单击绘图区可打开标注编辑器，右键不再触发新增标注。
`zoomable`、`pannable` 和 `showTooltip` 分别控制缩放、平移和 tooltip；平移默认关闭，
启用后在 `pan` 模式直接拖拽，`zoom` 模式按 Space 临时平移。传入模式 prop 时请接入更新回传，详见工具栏章节。

展示场景可启用 `presentationMode`，统一禁用绘图区的 tooltip、缩放、平移和
标注交互。该模式不会隐藏任何图形内容，也不会禁用图例切换或分页；关闭后恢复原交互配置。

```vue
<WaveformChart :data="chartData" :presentation-mode="true" />
```

空数据或过滤后没有有效点时，组件会保留图框布局并显示“暂无有效波形数据”。

## 大数据渲染

组件按不可变数据处理：替换 `data` 引用会重新过滤、排序和缓存坐标域，并重置视口；
原地修改已有数组不会触发缓存刷新。建议通过 `shallowRef` 保存大数据并整体替换引用。
规范化始终保留所有有效点，坐标域、误差棒、tooltip 和标注均使用完整数据；绘制路径会根据
当前视口和 `rendering` 配置自动降采样。调用方如需在传入组件前主动压缩数据，应自行保留
原始数据，以免影响 tooltip、标注和误差范围的精度。

默认 `auto` 模式按每条系列的当前可见点数决定渲染路径：不超过 1,000 个点直接使用原始
可视点；超过 1,000 个点时，组件将当前页面的可见系列合并为一次 Web Worker 请求，并在
Worker 内通过 WASM 执行保峰采样。默认采样数量由图框宽度和每像素最大点数控制，默认每个像素
最多渲染 4 个保峰点。多通道场景可通过 `sampling.maxPointCount` 设定每条曲线的固定目标数量；
设置后会优先于像素密度。可按业务调整：

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

`rendering.sampling` 控制 Worker/WASM 渲染路径。默认模式为 `auto`，其单系列可见点阈值为
`1_000`，默认策略为 `peak`。`wasm` 强制发起 Worker+WASM 请求，不受阈值影响；`raw` 完全绕过
Worker 和采样，直接渲染当前可见原始点。`sampling.maxPointCount` 用于每条线的固定采样数量，
`sampling.maxPointsPerPixel` 用于按宽度自适应；两者同时存在时固定数量优先。嵌套的
`sampling.maxPointsPerPixel` 优先于旧的 `rendering.maxPointsPerPixel`。未指定 `sampling.mode` 时，旧的 `downsample: false` 映射为
`raw`，`downsample: true` 映射为 `auto`。

```ts
rendering: {
  sampling: {
    mode: 'auto',
    autoThreshold: 1_000,
    autoHysteresis: 0,
    strategy: 'peak',
    maxPointCount: 1_000,
    maxPointsPerPixel: 4,
    rawPointLimit: 100_000,
    wasmFailureFallback: 'error',
  },
}
```

Worker 或 WASM 初始化不可用时，`auto` 会报告诊断后使用等价 JavaScript 采样，避免把大数据
退回为超长 SVG 路径。强制 `wasm` 模式遵循 `wasmFailureFallback`：`'error'` 保留已有有效路径
或当前同步渲染回退，并发出错误；`'javascript'` 会在错误诊断后显示 JavaScript 等价结果。快速
缩放或数据替换会用 `requestId` 和数据 revision 丢弃过期结果；等待新结果时保留当前有效路径。
采样结果只覆盖 SVG 线条点，完整原始数据仍用于 domain、tooltip、最近点、标注、误差范围和缩放
约束。组件卸载和 `data` 引用替换会终止实例 Worker 并释放其数据集。

高级场景可直接使用独立的 `sampleWaveformWasm` 数值内核。它接收等长的扁平 `Float64Array`
X/Y 坐标，返回真实源点的 `Uint32Array` 索引，或 `average` / `sum` 的新 X/Y 数组。该 API 不会
修改输入：

```ts
import { sampleWaveformWasm } from 'waveform-analysis'

const result = await sampleWaveformWasm({
  x: new Float64Array([0, 1, 2, 3]),
  y: new Float64Array([4, 1, 8, 3]),
  strategy: 'peak',
  targetPointCount: 4,
})
```

`none`、`peak`、`lttb`、`min`、`max` 和 `minmax` 返回源索引；`average` 与 `sum` 返回合成
坐标。`calculateWasmRange` 与 `findWasmVisibleRange` 分别提供完整范围统计和规范化序列上的
半开可见索引范围查询。WASM 初始化失败时这些调用会拒绝，由调用方选择是否使用 JavaScript
参考实现回退。

降采样仅作用于 SVG 中的曲线、点符号和误差棒。点符号和误差棒在每个系列中分别合并为
单个 SVG path；最近点查询、tooltip、标注插值、Y 轴误差范围和受控数据不会损失精度。

## 采样点标注

标注由父组件通过 `v-model:annotations` 持有，标注使用 `seriesId` 和 `x/y` 数据坐标，
不依赖数组下标：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  parseWaveformAnnotations,
  serializeWaveformAnnotations,
  type WaveformAnnotation,
  type WaveformInteractionMode,
} from 'waveform-analysis'
import { WaveformChart } from 'waveform-analysis/vue'
import 'waveform-analysis/style.css'

const annotations = ref<WaveformAnnotation[]>([])
const annotationsVisible = ref(true)
const interactionMode = ref<WaveformInteractionMode>('zoom')
</script>

<template>
  <WaveformChart
    :data="chartData"
    v-model:annotations="annotations"
    :annotations-visible="annotationsVisible"
    :interaction-mode="interactionMode"
  />
</template>
```

标注默认显示。标注模式下左键单击绘图区任意位置即可弹出居中编辑器，标注会吸附到当前 X 位置最近的真实采样点，右键已有标注可以编辑或删除。
标注框可以直接拖动进行手动避让，拖动只改变标签框位置，不会改变 `x/y` 数据锚点；偏移会以 `labelOffsetX/labelOffsetY` 像素字段保存在标注中。标注文本最多 40 个字符，边框色、文字色和背景色均支持取色与透明度调整。组件只负责内存中的受控数据，
业务层负责会话或后端持久化。

标注可以序列化为带版本号的 JSON，并在解析成功后整体替换当前数据：

```ts
const exportedJson = serializeWaveformAnnotations(annotations.value)

async function importAnnotationFile(file: File) {
  annotations.value = parseWaveformAnnotations(await file.text())
}
```

导出格式为 `{ version: 1, annotations: [...] }`。解析会验证全部标注；文件格式、版本或任意
字段无效时会抛出 `TypeError`，不会返回部分结果。导入包含未知 `seriesId` 的标注是允许的，
对应曲线加载后会恢复显示。文件选择、错误提示和下载由业务层实现。

X 轴刻度和左右端点先按 `timeUnit` 转换为秒或毫秒，再显示为不带分组符的自适应精度数值；左右端点默认最多保留四位小数，左端向下取整、右端向上取整并省略末尾零，可通过 `axes.x.labelFormatter` 自定义。Y 轴根据完整显示域的最大绝对值选择格式：大于等于 `10³`，或大于 `0` 且小于等于 `10⁻³` 时，自动使用科学计数法，并在最高可见刻度同行显示共享倍率 `E±NN`；其他范围使用普通数字，零值不触发科学计数法。倍率完整纳入稳定的轴空间预算，缩放切换数字格式时不改变图框和通道名称的位置。Y 轴标签先保留五位有效数字，再本地化为最多四位小数。科学计数法刻度不追加单位；普通刻度在 series 配置了 `unit` 时显示 `(单位)`，多 Y 轴分别使用对应轴首个 series 的单位。tooltip 使用最多 4 位小数的本地化普通数字并省略无意义尾零；标注编辑器的 X 坐标跟随 `timeUnit` 并固定 3 位小数，Y 坐标显示完整普通十进制。所有格式化都只发生在展示层，内部坐标值保持原始精度。
标注框默认布局在采样点正上方，只做绘图区边界裁剪；文本框通过连接箭头指向标注位置，多个标注重叠时可通过拖动手动避让。

## 事件

组件提供以下事件，名称与 Vue 模板写法一致：

| 事件                                                            | 说明                                                      |
| --------------------------------------------------------------- | --------------------------------------------------------- |
| `point-hover`                                                   | 当前最近点变化时触发，离开图表时传入 `null`               |
| `zoom-intent`                                                   | 滚轮、框选或新缩放命令确定范围时触发；fit 不发 intent     |
| `zoom-change`                                                   | 缩放过程中触发，参数为 `[start, end]`                     |
| `pan-end`                                                       | 平移结束且范围变化时返回时间端点，独立模式附带轨道信息    |
| `zoom-end`                                                      | 滚轮、框选或新命令提交后触发；加载器需忽略 action=fit     |
| `zoom-reset`                                                    | 重置按钮或新对象 reset 恢复意图；独立模式标识目标图框     |
| `page-change`                                                   | 分页变化，参数为当前页和总页数                            |
| `series-visibility-change`                                      | 图例切换曲线显隐时触发                                    |
| `annotation-create` / `annotation-update` / `annotation-delete` | 标注新增、更新或删除                                      |
| `sampling-complete`                                             | 每条系列当前采样结果的 `WaveformSamplingDiagnostics`      |
| `sampling-backend-change`                                       | 某系列在 `raw`、`javascript` 或 `wasm` 后端之间切换时触发 |
| `sampling-error`                                                | Worker/WASM 不可用或强制 WASM 无法满足时的降级/失败信息   |
| `update:interactionMode`                                        | 受控模式更新请求，由宿主回传后生效                        |
| `interaction-mode-change`                                       | 实际模式改变后通知                                        |
| `control-state-change`                                          | 合并通知控制状态快照，不作为加载入口                      |
| `update:annotations`                                            | 完整替换数组，宿主回传 `annotations` 后生效               |
| `update:hidden-series-ids`                                      | 完整替换数组，宿主回传 `hiddenSeriesIds` 后生效           |
| `rendered` / `finished`                                         | `{ revision }`；本帧绘制完成 / 当前版本稳定完成           |

原生实例使用 `chart.on(name, handler)`，Vue 包装使用 `@name="handler"`，事件名称与参数
顺序相同；例如 `chart.on('annotation-update', (annotation, previous) => …)` 对应
`@annotation-update="(annotation, previous) => …"`，`page-change` 两个参数依次为页码和总页数。
原生订阅返回取消函数，也可用 `off(name, handler)` 或 `off(name)`；Vue 包装通过
emits 转发到最新监听器。`update:interactionMode` 在 Vue 模板中可写
`@update:interaction-mode` 或 `v-model:interaction-mode`。显示单位不改变事件中的秒坐标。

`annotations` 和 `hidden-series-ids` 支持 `v-model`；`annotations-visible` 与
`interaction-mode` 是受控输入属性。业务层应负责将标注和显隐状态持久化。

`sampling-complete` 的 payload 包含模式、实际后端、策略、完整/可视/渲染点数、耗时、请求号、
revision，以及 `scheduledRequestCount`、`coalescedRequestCount` 和
`maxPendingRequestCount` 三个调度指标；适合性能面板或日志采集。`sampling-error` 不携带原始
`Error` 对象，只提供可序列化的消息、请求模式、回退方式和受影响系列 ID。不要将这些诊断事件
作为 pointermove 处理逻辑。

### 多分辨率索引、缓存与诊断

Worker 的 JavaScript 回退后端和 Rust/WASM 后端都按需建立多分辨率索引。`peak`、`min`、`max`
和 `minmax` 使用可追溯到真实源点的 Min/Max 分层；`average` 与 `sum` 使用可重用的 Sum/Count
分层，LTTB 仍按当前视口即时计算。WASM 数据集通过可释放 handle 持久保存；每个桶的左右边界按
当前可见半开索引范围精确计算，所以局部缩放不会复用首次全局采样而丢失细节。

连续 wheel、pan 和 resize 使用 latest-wins 调度：同一图表最多保留一个执行中任务和一个最新
待处理任务，中间视口会被合并，Worker 消息队列不会随输入事件无界增长。过期请求仍通过
`requestId` 和 revision 双重校验，不能覆盖最终稳定视口。

每个已访问数据集的索引默认最多使用 8 MiB。采样输出缓存使用 LRU，默认最多 96 个条目或
16 MiB；先到达任一上限就逐出最久未使用结果。缓存键包括 dataset ID、revision、可见起止索引、
图框宽度、目标密度、策略、后端及线型/点型/误差棒/装饰间距等渲染维度。替换、删除或清空数据集会
同步释放其索引与缓存项。`sampling-complete.cacheHit` 只在 Worker 实际返回该缓存项时为 `true`。

演示可在 `#/wasm-sampling` 打开。该路由生成 10 条各 100,000 点的 `Float32Array` 通道，可切换
`auto` / `wasm` / `raw`，所有采样策略与自动阈值；Peak 类策略按每像素点数采样，LTTB、Average、
Sum 按每条线的目标渲染点数采样。右侧表格显示每个系列的真实后端、
源点/可见点/渲染点、耗时和缓存命中状态。

库产物会把 WASM 数据内联到 Worker 运行时，消费者无需额外复制 `.wasm` 文件。严格 CSP 部署
仍需允许库的模块 Worker，并允许浏览器编译 WebAssembly；若策略禁止 `data:` Worker/WASM 资源
或 WebAssembly 编译，`auto` 可回退到 JavaScript，而强制 `wasm` 会按配置报告失败。当前自动化
与浏览器回归覆盖 Chromium、Firefox 和 WebKit；实际 Safari、严格 CSP、离线和子路径部署应按
[`docs/performance-guide.md`](docs/performance-guide.md) 的发布清单验证。

## 项目结构

- `src/index.ts`：框架无关公开入口；`src/native.ts` 仅重导出根入口，`src/vue.ts` 提供 Vue 适配
- `src/chart/`：实例门面、初始化注册、事件、调度和资源生命周期
- `src/model/`、`src/data/`、`src/layout/`：配置与受控状态、全量数据查询、域与轨道布局
- `src/rendering/`、`src/view/`：SVG 渲染器及稳定 ID 对应的视图对象
- `src/interaction/`、`src/annotation/`：手势、hover、受控标注与编辑
- `src/controls/`、`src/export/`：原生工具栏、浮层、分页和 SVG/PNG 导出
- `src/sampling/`、`src/animation/`：采样会话/Worker 策略和动画编排
- `src/core/`、`src/types/`、`src/utils/`：共享算法、公开类型和纯辅助函数
- `src/adapters/vue/`：Vue 薄适配；`src/components/WaveformChart.vue` 保留源码兼容转发
- `src/components/{core,data,rendering,annotation}`：仍复用的框架无关算法与兼容类型路径
- `src/styles/`：共享原生样式，根与 `/native/style.css` 产物保持一致
- `examples/{vanilla,react,vue}/`：DOM ref 消费示例；`tests/fixtures/legacy/`：独立旧版对照夹具
- `demo-app/`：private workspace 演示应用，只通过库的公开包入口消费组件
- `demo-app/src/App.vue`：综合可交互 demo，`demo-app/src/demo/data` 提供示例波形数据
- `demo-app/src/router.ts`、`demo-app/src/views/`：Demo 路由与固定振幅、动画、WASM 专用示例
- `demo-app/tests/`：demo 测试；`tests/`：库测试与历史对照夹具
- `wasm/Cargo.toml`、`wasm/src/lib.rs`：Rust/WASM 数值内核源码；`wasm/pkg` 是提交到 Git 的
  WASM 绑定与二进制产物，`wasm/target` 是本地 Rust 构建缓存，不提交到 Git

## 本地开发

日常开发环境要求 Node.js 22、pnpm 10.32.1；`.nvmrc` 固定为与普通 CI 一致的 22.20.0，可先执行 `nvm install && nvm use`。启动直接使用仓库已有的 `wasm/pkg` 产物，
不需要安装或校验 Rust 工具链：

```bash
pnpm install --frozen-lockfile
pnpm dev
```

常用质量检查和构建命令：

```bash
pnpm typecheck
pnpm lint:oxlint
pnpm lint
pnpm lint:all
pnpm format:check
pnpm test                   # 仅组件库测试
pnpm test:coverage          # 仅组件库覆盖率
pnpm test:demo              # 手动执行 demo 测试（含右侧控制栏）
pnpm test:demo:browser      # 手动执行 demo 浏览器测试
pnpm test:browser            # Chromium，原生/Vue、桌面/小容器、交互及 SVG/PNG
pnpm test:browser:resources  # 三引擎重复创建/替换/销毁；Chromium 额外测 JS 堆
pnpm build
```

`WAVEFORM_BROWSER=firefox` 或 `webkit` 可选择浏览器；运行前用 `pnpm exec playwright install --with-deps <browser>` 安装对应引擎。浏览器证据默认写入系统临时目录，可用 `WAVEFORM_BROWSER_EVIDENCE_DIR` 指定保留位置。每周 CI 执行三引擎矩阵，性能阈值固定在 `scripts/browser-performance-budgets.json`，仅耗时超限允许一次重测，功能失败不跳过。

`pnpm lint:oxlint` 使用 Oxlint 的默认 correctness 检查及内置 TypeScript、Unicorn 和 Oxc
插件，自动忽略 `dist/`、`dist-demo/`、`coverage/` 和 `node_modules/`。`pnpm lint` 继续负责
ESLint 的 Vue SFC、TypeScript ESLint 和 `max-lines` 规则；`pnpm lint:all` 会依次运行两者。
`pnpm format:check` 只读检查 Prettier 格式，`pnpm format` 保持原有的写入行为。

根目录 `pnpm dev` 使用现有 WASM 产物构建库和声明，再启动库构建/声明监听与 demo 服务；
修改库 TS、Vue 或 CSS 后会更新 demo 消费的包产物，Ctrl-C 停止服务与监听进程。
demo 的 Ant Design、颜色选择器和路由依赖由 private `demo-app` 声明；库运行时依赖保持独立。
根 `typecheck` 覆盖库、测试、构建配置和 demo。首次运行测试也会先准备公开包入口。
Demo 用例（`demo-app/tests/` 和 `tests/display/demo/`）由独立的 `vitest.demo.config.ts` 管理，
不参与默认测试、CI 或发布门禁，仅在手动执行上述 demo 测试命令时运行。Demo 浏览器路由检查也已从
组件库浏览器检查和包消费者验证中分离；构建、类型检查与 Demo 部署产物校验仍保留。
版本发布时不额外手动执行 Demo 测试或 Demo 覆盖率，部署后核对线上提交版本。
覆盖率测试为库生成未压缩且带 source map 的构建，覆盖率范围限定为 `src/`；
普通构建和发布包仍使用默认构建设置。

GitHub 分支 CI 自动取消同一分支的过期运行，标签由 Release 工作流校验，避免重复触发标签 CI。
GitHub CI 缓存 pnpm 下载和固定版本的 wasm-pack 工具；完整覆盖率与质量门禁保持不变。
覆盖率构建之后，CI/发布流程生成一次正式构建，使用 `pnpm test:browser:built` 复用产物，
再通过 `pnpm --config.ignore-scripts=true pack --pack-destination release-assets` 打包。
`pnpm test:package --tarball release-assets/waveform-analysis-<版本>.tgz` 直接验证指定包，
不会重新打包；此模式要求 `dist/` 已由同一份源码正式构建。
GitHub/Gitea 发布同一个已验证 tarball，发布前检查 SHA-256，防止验证后产物发生变化。
本地 `pnpm test:package` 和 `pnpm pack` 仍会执行 prepack 完整构建，避免使用过期产物。

GitHub 稳定版额外发布 `waveform-demo-<版本>.tar.gz` 和 SHA-256 文件，复用同次正式构建的
Demo（`DEMO_BASE_PATH=/waveform-analysis/`），归档内 `version.txt` 为完整提交 SHA。
腾讯云上的部署检查器每两分钟查询最新稳定 Release，通过 `gh-download` 下载归档，使用
GitHub API 返回的 SHA-256 校验，安全解压后原子切换目录；版本或 HTML 检查失败时恢复旧目录。
Dokploy 使用 raw Compose 管理只读静态容器，不再克隆仓库或重复安装 Node/Rust 工具链。
安装、手动部署及回滚见 [Demo 产物部署](deploy/README.md)。

`pnpm build` 同时生成 `dist/` 组件库产物和根 `dist-demo/` 演示应用。
`pnpm build:demo` 可独立准备库后构建 demo，`pnpm preview` 预览根 `dist-demo/`。
正式公开入口为
`src/index.ts`，共享样式入口为 `src/styles/native.css`；`dist/` 和 `dist-demo/` 均为生成目录，不要手工编辑。

### 通道名称与交互图例

`unit-display-mode="channel-label-or-legend"` 在左侧统一隐藏通道名称时，为每个非空图框
显示带单位的图例，包括只有一条通道曲线的图框。
当前页所有图框均为单曲线时，左侧名称显示为 `DEMO_VOLTAGE(V)`；当前页任一图框
包含两条及以上曲线时，整页隐藏左侧通道名称及多轴通道标题，保留坐标刻度。
当前页均为单曲线时，名称显示在左侧，图框不显示图例。
判断使用当前页原始曲线数量，隐藏曲线仍计数，其他页不会影响当前页。
单位去除首尾空白；缺失、空白或 `--` 时只显示名称。原始数据及 ID 保持不变。
图例显示为 `DEMO_VOLTAGE (V)`，设置 `:legend="{ interactive: true }"` 可点击显隐。
隐藏后保留图例条目，可全部隐藏后恢复；`cleanView` 隐藏名称和图例。
显隐状态可通过 `hiddenSeriesIds` 及 `update:hidden-series-ids` 控制；未传入时使用
组件内部状态，持久化仍由宿主应用负责。已有两种单位展示模式保留各自的单位规则，
但单曲线图框统一不显示图例；多曲线图框仍保留可交互的图例条目。

### WASM 构建准备与源文件长度

`dev`、`typecheck`、`test`、`test:coverage`、`build` 和 `prepack` 使用已有的 `wasm/pkg`，
不调用 Rust 工具链。修改 Rust 源码或缺失 WASM 产物时，显式执行 `pnpm build:wasm` 重新打包，
再运行这些命令；仅修改 Rust 源码不会自动更新演示中的 WASM。
Rust/WASM 打包需要 Rust 1.95（含 `wasm32-unknown-unknown` target）和 wasm-pack 0.14.0。
`pnpm build:wasm` 强制重建；`pnpm prepare:wasm` 则按源码、工具版本和产物摘要校验缓存，
仅在缓存失效时重建。准备记录位于忽略的 `node_modules/.cache/waveform/wasm.json`。
`src/` 和 `demo-app/src/` 文本文件上限为 450 物理行（包含注释和空行），
ESLint 与独立长度检查保持一致。

采样的 `maxPointCount` 是视口内主体点数的目标；为了保持线性和阶梯线在视口边缘连续，
绘图输出还可能包含左右各一个相邻原始点（最多额外 2 点）。`visiblePointCount` 只统计
视口内原始点，`renderedPointCount` 包含连接点。average/sum 仅聚合视口内部数据，连接点
不参与聚合；视口内无采样点但存在跨越视口的线段时，保留两侧连接点。
域、误差范围、悬浮查询及注解仍使用完整数据，时间单位仅影响显示。

### 内置工具栏与外部控制

工具栏默认关闭。`toolbar=true` 开启悬浮工具栏；Demo 默认开启，参数区可关闭。
默认依次显示模式组（框选、平移、注解）、视口组（放大、缩小、重置、显示全部）和导出组。
`items` 按首次出现去重并保留输入顺序，仅相邻同类别项目合组，不提供公共按钮注册或分组 API。

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { WaveformChart } from 'waveform-analysis/vue'
import type { WaveformChartHandle, WaveformData, WaveformInteractionMode } from 'waveform-analysis'

const chart = ref<WaveformChartHandle>()
const mode = ref<WaveformInteractionMode>('zoom')
const data: WaveformData = {
  kind: 'points',
  points: [
    { x: 0, y: 0 },
    { x: 1, y: 2 },
    { x: 2, y: 1 },
  ],
}
// 可在宿主自己的事件中调用；隐藏工具栏后仍可用。
function focusRange() {
  return chart.value?.setViewportDomain([0.5, 1.5], {})
}
async function createImage() {
  return chart.value?.exportImage({ format: 'png', scale: 2 })
}
</script>
<template>
  <WaveformChart
    ref="chart"
    :data="data"
    v-model:interaction-mode="mode"
    pannable
    :toolbar="{ visible: true, display: 'always', position: 'top-right' }"
  />
</template>
```

`toolbar` 支持 `false | true | { visible?, display?: 'hover' | 'always', position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left', offsetX?: number, offsetY?: number, items? }`。
工具栏始终对当前页执行批量视口命令，不提供图框范围选择器。独立模式切页时按图框 ID 保留视口，当前页命令不会重置其他页；替换数据或修改域约束后清除离页缓存。外部 API 仍支持指定 `trackId`。框选、平移和注解按实际操作图框生效。

`position` 默认为 `top-right`。`offsetX`、`offsetY` 分别默认为 `-30`、`18`，单位为像素，水平负数向左、正数向右，垂直负数向上、正数向下，方向不随定位角改变。例如右上角定位时 `offsetX: -200` 向左移动 200px。非有限数按 `0` 处理。零偏移时顶部避让标题、底部避让分页；位置受图表边界限制，防止工具栏被裁切。

例如 `:toolbar="{ position: 'bottom-left', offsetX: 12, offsetY: 8, items: ['zoom-box', 'reset', 'export'] }"` 仅显示这三个按钮。隐藏按钮不会禁用外部 API，也不会改变当前交互模式。主 Demo 参数区提供位置、偏移和按钮勾选控件。工具栏按交互模式、视口操作和导出分组显示半透明白色背景块，搭配浅色边框和圆角。

按钮 ID 为 `zoom-box`、`pan`、`annotate`、`zoom-in`、`zoom-out`、`reset`、`fit`、`export`。
空 `items` 不显示工具栏；关闭工具栏不改变模式或视口。小容器默认折叠为“工具”入口，展开后自动换行，键盘焦点保持可见，触屏常驻。

`interactionMode` 支持 `zoom | pan | annotation | none`。省略时使用内部状态，默认 `zoom`；传入时为受控状态：
命令只发 `update:interactionMode` 请求，宿主回传后才改变模式、高亮和 `aria-pressed`。

再次点击当前选中的平移或注解按钮会退出该模式并返回框选；重复点击框选仍保持框选。
框选被禁用时无法返回框选，保留当前模式。`setInteractionMode()` 始终显式设置模式，重复调用不会切换回框选。
`interaction-mode-change` 只通知实际变化。`pan` 需要 `pannable`，直接拖动；`zoom` 仍支持 Space 临时平移。
`none` 禁止拖动、滚轮和创建注解，但保留悬浮和外部视口方法。展示模式禁用新交互命令，允许导出。

| 方法                                           | 语义                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `zoomIn(target?)` / `zoomOut(target?)`         | X 跨度乘 0.5 / 2，Y 不变，遵守缩放约束                             |
| `fitToData(target?)`                           | 当前已加载可见完整数据的 X 域及自动 Y；固定 Y 优先，不触发远端加载 |
| `resetViewport({ trackId? })`                  | 初始 X/Y，发恢复数据意图；即使 unchanged 也可发 `zoom-reset`       |
| `setViewportDomain([start,end], { trackId? })` | 按当前有效边界设置秒坐标 X 范围                                    |
| `setInteractionMode(mode)`                     | 返回 applied/requested/unchanged/disabled                          |
| `getControlState()`                            | 实际模式、逐目标视口及操作可用性副本                               |
| `exportImage(options?)`                        | 返回 `Promise<Blob>`，外部调用不自动下载                           |

独立模式的默认目标是当前页全部图框，`trackId` 使用稳定图框 ID；未知/非当前页 ID 返回 `invalid-target`，不翻页。
共享 X 模式不接受 `trackId`，返回一个 `shared` 目标。新视口结果为 `{ kind: 'viewport', status, targets }`，
逐目标包含 `trackId/status/before/after`；快照包含 `xDomain/yDomains`。总状态优先级为
`applied > unchanged > disabled > empty-data`，因此 `applied` 不代表全部图框都改变。非法目标/范围不部分执行。
模式结果为 `{ kind: 'mode', status, targets: [] }`。`control-state-change` 按 Vue 更新批次合并，不用作加载入口。

旧 `resetViewport(trackIndex?)`、`setViewportDomain(domain, trackIndex?)` 仍返回 void，保持静默；
无参 reset 是旧接口，使用 `resetViewport({})` 才执行当前页新命令。
fit 后所有手势和新方法共用数据边界，`maxZoomScale`（无其他限制时默认 40 倍）以该边界计算。
reset 或旧数字 setter 退出对应 fit 状态；数据引用、可见系列、初始域改变时清理旧适配边界。

新命令的 intent/end/reset 附带 `commandId`、`source: 'toolbar' | 'api'`、`action`。
同次多图框命令共享 commandId，按页顺序通知。放大/缩小/对象 setter 为 `zoom-intent → zoom-change → zoom-end`；
fit 只有 change/end；对象 reset 只有 reset。其他无变化/禁用/非法/`empty-data` 不发操作事件。
空窗口保留系列时仍可放大、缩小、设置视口和重置；fit 无有效采样点时返回 `empty-data`。
`zoom-change` 仍为 `[start,end]`。`gesture` 新增 `'command'`，穷举旧 wheel/box 或旧 interactionMode 联合的 TypeScript 消费者需适配新增分支。

宿主应在以下加载方式中选择一种，不同时监听 intent 和 end 发请求：

```ts
import type { WaveformZoomEndPayload, WaveformZoomIntentPayload } from 'waveform-analysis'
// 方式一：提交后加载；fit 仅显示已加载数据，必须忽略。
function onZoomEnd(payload: WaveformZoomEndPayload) {
  if (payload.action === 'fit') return
  // 按 payload.start/end 与 seriesIds 加载，替换 data 引用。
  // 多目标按 commandId 聚合或逐目标取消请求，避免后一个目标取消前一个目标。
}
// 方式二：在渲染稳定前加载。只绑定 zoom-intent，不再用 zoom-end 加载。
function onZoomIntent(payload: WaveformZoomIntentPayload) {
  // 根据 payload.start/end 发请求；新请求取消该目标旧请求。
}
// zoom-reset 单独负责取消在途请求并恢复宿主初始数据。
```

导出支持 `format: 'png' | 'svg'`（默认 png）、PNG `scale`（默认 1，有限正数且不超过 4）及 `backgroundColor`。
SVG 不接受非 1 的 scale。图片包含当前页标题、轴、图例、可见曲线/点/误差条和注解，排除工具栏、分页、悬浮和编辑层。
导出等待当前采样、字体和渲染，最长 5 秒；数据/视口/布局等改变则拒绝，不导出混合版本。
工具栏负责下载及显示失败反馈。外部可按错误码处理：

```ts
import type { WaveformChartHandle, WaveformImageExportError } from 'waveform-analysis'
async function exportSvg(chart: WaveformChartHandle): Promise<Blob | undefined> {
  try {
    return await chart.exportImage({ format: 'svg' })
  } catch (error) {
    const { code } = error as WaveformImageExportError
    if (code === 'export-stale' || code === 'export-busy') return undefined
    throw error
  }
}
```

错误码还包括 `export-invalid-options`、`export-unavailable`、`export-cancelled`、`export-render-failed`、`export-timeout`。

### Y 轴名称文字样式

通过 `axes.y.labelTextStyle` 设置“正弦基波”等系列名称的字号、字重、字体、斜体和颜色：

```vue
<WaveformChart
  :data="data"
  :axes="{
    y: {
      labelTextStyle: {
        fontSize: 16,
        fontWeight: 'normal',
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontStyle: 'normal',
        color: '#333333',
      },
    },
  }"
/>
```

`fontSize` 单位为 px，默认为 `12`，零、负数和非有限值回退为默认值。
`fontWeight` 默认为 `600`；使用 `'normal'` 或 `400` 取消加粗，`'bold'` 或 `700` 加粗。
字体默认继承，斜体默认为 `'normal'`，颜色默认使用对应系列颜色。
配置支持响应式更新，适用于单轴和多轴模式的左右 Y 轴名称，不影响刻度数字、图例或 X 轴文字。
字号参与名称与刻度之间的间距及图表边距计算；名称背景保持透明。

### Y 轴上下留白与极值刻度

组件统一计算自动 Y 范围留白，调用方无需修改数据或自行设置扩展后的 `yDomain`：

```ts
const axes: WaveformAxesOptions = {
  y: {
    lineVisible: false,
    nice: true,
    upperPaddingEnabled: true,
    lowerPaddingEnabled: true,
    upperPaddingRatio: 0.1,
    lowerPaddingRatio: 0.1,
  },
}
```

上下分别使用同一个原始自动跨度。例如 `[20, 80]` 上下各 10% 得到 `[14, 86]`。
`upperPaddingRatio` 的旧用法继续生效：只指定 `0.1` 仍仅增加上方留白。
每侧开关显式 `false` 优先关闭；显式 `true` 且未提供比例时使用 `0.1`。
全部省略则不增加留白；零、负数或非有限比例不生效。关闭开关不清除配置比例。

固定 `yDomain` / `yDomains` 和手动 Y 视口不添加比例留白；重置或适应数据后恢复自动规则。
显式配置某侧开关或比例后，该侧边界严格按留白结果确定，nice 不再扩展该侧。
比例为 `0` 或开关为 `false` 时，该侧贴近数据极值；负数或非有限比例按零留白处理。
未配置侧仍沿用 nice 扩域，全部未配置时行为保持兼容。主刻度继续使用
`1 / 2 / 5 × 10ⁿ` 漂亮步长，仅显示最终范围内的刻度；边界不必是主刻度，实际数量可能减少。
例如 `[-73, 86]` 上下各 10% 的图框范围严格为 `[-88.9, 101.9]`。
这改变了旧版显式留白后仍会被 nice 进一步扩域的行为。限幅配置侧优先于比例留白，
未限幅侧仍应用上述规则；手动视口不重复添加留白，显式留白模式下保留手动视口边界。
常量沿用非零范围回退后计算跨度；误差棒开启时包含其端点；单轴合并范围，多轴分别计算。

`axes.y.maximumTickVisible` 和 `axes.y.minimumTickVisible` 分别控制原始最大值、最小值的
额外刻度线和标签，默认都为 `true`。两个开关与上下留白独立，设为 `false` 隐藏对应的
额外最值刻度；关闭留白后仍显示域内已开启的最值。
最大值刻度开启且位于当前 Y 轴范围内时，高于最大值的轴刻度线和文字不显示，
顶部留白、坐标范围及水平网格线保持不变。关闭最大值刻度后恢复普通刻度规则；
最大值在当前范围外时不触发过滤，多轴按各自系列组的最大值分别处理。
普通等距刻度不受开关影响，即使某个普通刻度恰好等于最值，也仍正常显示。
支持响应式切换，不改变数据、Y 轴范围、缩放视口或 tooltip。

```vue
<!-- 只显示最大值的额外刻度 -->
<WaveformChart :axes="{ y: { maximumTickVisible: true, minimumTickVisible: false } }" />
```

常量标记仍为原始值且最大值、最小值合并为一个刻度，误差棒开启时极值包含其端点。
相同值刻度合并；极值标签优先，隐藏距离不足 4px 的相邻普通标签；过近的普通短刻度及
关联水平网格线也会隐藏，图框边框始终保留。不会移动数值位置或为避让扩大范围。
最小值与最大值标签重叠时两者均保留，科学计数法倍率仍跟随最大值标签。手动视口或固定范围中仅显示域内的极值，
不会为显示最值而扩展范围。同轴取可见系列的共同最值，多轴分别计算，使用完整原始数据。
Demo 的“Y 轴留白”配置区默认显式启用上下各 10%，与组件省略配置时的默认值不同；
“显示最大值刻度”和“显示最小值刻度”默认都开启，可分别切换。
原 `extremaTicksVisible` 总开关已移除，请改用上述两个独立配置项。

### 独立基础组件

以下原生 DOM 组件不依赖 Vue，也不会加载波形分析引擎。每个子路径同时提供
ESM、CommonJS 和 TypeScript 类型；样式需要显式导入。使用 ColorPicker 时，其样式
已包含内部 InputNumber、Select 和 Popup 所需样式。

| 入口                             | 导出          | 样式入口                                   |
| -------------------------------- | ------------- | ------------------------------------------ |
| `waveform-analysis/input-number` | `InputNumber` | `waveform-analysis/input-number/style.css` |
| `waveform-analysis/select`       | `Select`      | `waveform-analysis/select/style.css`       |
| `waveform-analysis/color-picker` | `ColorPicker` | `waveform-analysis/color-picker/style.css` |
| `waveform-analysis/pagination`   | `Pagination`  | `waveform-analysis/pagination/style.css`   |
| `waveform-analysis/modal`        | `Modal`       | `waveform-analysis/modal/style.css`        |
| `waveform-analysis/popup`        | `Popup`       | `waveform-analysis/popup/style.css`        |

所有入口导出 `ControlTheme` 和 `ControlThemeOptions`。组件默认 `theme: 'auto'`，
随系统深浅色偏好实时切换，也可指定 `'light'` 或 `'dark'`，或调用
`setTheme('dark')` 动态切换。不同实例可以使用不同主题，切换不会清空输入草稿。
系统偏好不可用时采用浅色。组件内部浮层随所属组件切换主题。

```ts
import { InputNumber } from 'waveform-analysis/input-number'
import { Select } from 'waveform-analysis/select'
import { ColorPicker } from 'waveform-analysis/color-picker'
import { Pagination } from 'waveform-analysis/pagination'
import { Modal } from 'waveform-analysis/modal'
import { Popup } from 'waveform-analysis/popup'
import 'waveform-analysis/input-number/style.css'
import 'waveform-analysis/select/style.css'
import 'waveform-analysis/color-picker/style.css'
import 'waveform-analysis/pagination/style.css'
import 'waveform-analysis/modal/style.css'
import 'waveform-analysis/popup/style.css'

const host = document.createElement('div')
document.body.append(host)
const number = new InputNumber(
  document,
  '数量',
  (value) => number.update(value, false),
  () => console.log('提交', number.input.value),
  { step: 1, shiftStep: 10, min: 0, max: 100, theme: 'auto' },
)
number.update('10', false)
host.append(number.root)

const options = [
  { value: 'a', label: '选项 A' },
  { value: 'b', label: '选项 B' },
]
const select = new Select(document, '选项', (value) => select.update(options, value), 'default', {
  theme: 'auto',
})
select.update(options, 'a')
host.append(select.root)

const color = new ColorPicker(
  document,
  '颜色',
  '#1677ff',
  () => {
    if (color.valid) console.log(color.value)
  },
  { theme: 'auto' },
)
host.append(color.root)

const pagination = new Pagination(
  host,
  (page) => {
    pagination.update({ page, pageCount: 20 })
  },
  { theme: 'auto' },
)
pagination.update({ page: 1, pageCount: 20 })

const modal = new Modal(document, { title: '设置', theme: 'auto' })
modal.body.append(document.createTextNode('可在 body 和 footer 中插入自定义 DOM。'))
modal.open()
// modal.close() 播放关闭动画；同一实例可以再次 open()。

const trigger = document.createElement('button')
trigger.textContent = '显示浮层'
host.append(trigger)
const popup = new Popup(trigger, {
  title: '标题',
  content: '浮层内容',
  trigger: 'click',
  placement: 'top',
  theme: 'auto',
  onOpenChange: (open) => console.log(open),
})

// 宿主卸载时清理监听器、浮层、动画和模态滚动锁。
function disposeControls() {
  for (const control of [popup, modal, pagination, color, select, number]) control.dispose()
  host.remove()
}
```

- `InputNumber.update(value, invalid, description?, { disabled?, readOnly? })` 使用字符串保留
  小数输入草稿。`changed` 回调由消费者校验并回写；支持 `increaseLabel`、`decreaseLabel`
  自定义按钮文案。默认步长保持为 `0.001`，Shift 步长为 `0.01`。
- `Select.update(options, value, disabled?, placeholder?)` 更新受控选项和选中值；
  第四个构造参数为 `'default' | 'compact'`。
- `ColorPicker` 的回调不带参数，通过 `value` 和 `valid` 读取当前颜色及有效性。
- `Pagination.update({ page, pageCount, visible?, disabled? })` 使用从 1 开始的页码，
  自动将页码约束到有效范围（最少一页）；仅用户导航触发回调，更新本身不触发回调。
- `Modal` 支持 `setTitle()`、`isOpen`、`busy` 和 `initialFocus` 配置。可传 `cancel`
  回调接管关闭请求；此时消费者负责调用 `close()`，适合未保存内容确认。
  不传回调时关闭按钮、Escape 和遮罩点击默认关闭。自定义内容可继承主题 CSS 变量；
  自行创建并插入的子组件通过其 `setTheme()` 独立配置。
- `Popup(trigger, className?, width?, maxHeight?, options?)` 暴露 `panel` 和 `isOpen`，
  消费者负责绑定打开动作；外部点击和 Escape 可关闭浮层。宽度默认 240px，最大高度默认
  根据可用视口限制。弹窗内部浮层挂载到对应 dialog，保持浏览器顶层可见性。

波形分析使用 `controlTheme: 'auto' | 'light' | 'dark'` 统一配置以上控件：
原生实例调用 `chart.setOption({ controlTheme: 'dark' })`，Vue 使用
`<WaveformChart control-theme="dark" ... />`。该选项不改变曲线、坐标轴等图表配色。
现有整体样式入口保持兼容；独立组件演示位于 Demo 顶部「基础组件」二级菜单：
`#/controls/input-number`、`#/controls/select`、`#/controls/color-picker`、
`#/controls/pagination`、`#/controls/modal` 和 `#/controls/popup`。
原 `#/controls` 地址会跳转到数字输入框页面。每页包含交互示例、事件反馈、
实际使用源码及独立主题覆盖设置。

### Popup 气泡卡片

`new Popup(trigger, options)` 采用 Ant Design Popover 风格：12px 内边距、8px 圆角、
标题和内容分区、箭头及深浅色浮层背景。默认 `trigger: 'hover'`、`placement: 'top'`，
移入和移出延迟均为 0.1 秒（`mouseEnterDelay` / `mouseLeaveDelay`，单位秒）。
`trigger` 支持 `hover`、`click`、`focus` 或它们的数组。Escape、点击外部或焦点移出会关闭。
`onOpenChange` 在实际开关状态变化时触发。

`placement` 支持 top / bottom / left / right 及 topLeft、topRight、bottomLeft、bottomRight、
leftTop、leftBottom、rightTop、rightBottom。默认自动翻转，居中方向支持边缘平移；
`autoAdjustOverflow: false` 可关闭调整，`arrow: false` 可隐藏箭头。
`width` 默认 240px，`maxHeight` 限制内容滚动高度。
`title`、`content` 接受字符串或 HTMLElement；可用 `setTitle`、`setContent` 更新，
或向 `content` 添加 DOM。浮层默认挂在 body，弹窗内保持在 dialog 顶层中。
旧位置参数构造方式仍支持，维持手动 `open()` / `close()` 控制。
这是原生 DOM 实现，未引入 React/Ant Design 依赖，也不宣称完整兼容其 React API。

实现参考：[Ant Design Popover](https://github.com/ant-design/ant-design/tree/master/components/popover)
及 [共享交互 API](https://github.com/ant-design/ant-design/blob/master/components/tooltip/shared/sharedProps.en-US.md)。
