# 波形分析组件项目架构

## 项目概览

这是一个基于 Vue 3、TypeScript 和 D3.js 的响应式波形可视化组件库，面向大规模数据集提供高性能的 SVG 波形渲染、缩放和悬浮取点能力。

- **技术栈**: Vue 3、TypeScript、D3.js、Vite
- **包管理器**: pnpm
- **测试**: Vitest、Vue Test Utils

## 目录结构

```text
src/
├── components/
│   ├── WaveformChart.vue       # 主波形图组件
│   ├── waveform.ts             # 数据规范化兼容入口
│   ├── data/types.ts           # 组件内部数据类型入口
│   ├── interaction/
│   │   └── WaveformTooltip.vue # 悬浮提示
│   ├── rendering/
│   │   └── WaveformTrack.vue   # 单轨道 SVG 渲染
│   ├── core/                   # 常量和组件核心类型
│   └── WaveformChart.test.ts   # 组件与数据测试
├── core/                       # 数据规范化、可见域裁剪和保峰降采样
├── types/                      # 公开数据和图表类型
├── utils/                      # 域、格式化和几何工具
├── data/                       # 示例波形数据
└── App.vue                     # Demo 应用
```

## 分层架构

```text
外部 WaveformData
        │
        ▼
normalizeWaveformData / normalizeWaveformSeries
        │
        ▼
不可变数据缓存 / 坐标域元数据
        │
        ▼
WaveformChart
  ├─ chartSeries / trackLayouts
  ├─ D3 scales、坐标轴和可见域降采样路径
  ├─ 独立或共享模式的 zoom behavior
  ├─ hover 最近点与 WaveformTooltip
  └─ 受控采样点标注与自动布局
        │
        ▼
WaveformTrack（每个 series 一条 SVG 轨道）
```

## 核心组件

### WaveformChart

`WaveformChart` 负责数据归一化后的布局、坐标轴、路径、缩放和跨轨道 hover 协调。

支持三种显示模式：

- `independent`: 每个波形独立坐标和缩放
- `separated`: 波形垂直堆叠，共享 X 轴
- `compact`: 多个波形在紧凑布局中展示

叠加曲线由独立的 `overlayMode` 控制 Y 轴：`single-axis` 共享一个值轴，
`multi-axis` 最多使用四个值轴，超出的曲线复用第 4 轴。

公开输入包括 `data`、显示模式、尺寸、标签、颜色、tooltip、缩放、时间单位、帧号和
受控标注状态；公开事件包括 `point-hover`、`zoom-change` 以及标注 CRUD 生命周期事件。

标注只保存 `seriesId` 与 `x/y` 数据坐标，渲染时根据当前轨道比例尺重新投影。新增支持
工具模式和绘图区任意位置右键快捷创建；创建后的标注通过连接线绑定到对应的数据坐标，已有标注通过右键菜单编辑或删除。

### WaveformTrack

轨道组件渲染网格、坐标轴、端点标签、波形路径、帧号和 hover 十字线。独立模式下，
轨道创建自己的透明交互层；共享模式下由图表创建覆盖整个绘图区的交互层。

### WaveformTooltip

根据当前轨道或共享 X 坐标显示最近数据点、系列名称、单位和格式化时间。tooltip 不
持有数据状态，由 `WaveformChart` 通过 props 控制显示位置和内容。

### WaveformAnnotationLayer

标注层使用 SVG 圆点、箭头、矩形和多行文本渲染标注，不依赖图表库私有 DOM。布局按实际
轨道尺寸计算，并使用确定性的候选偏移避让相邻文字框；无效标注会被忽略但不会从受控
数组中删除。

X、Y 轴在显示域最大绝对值小于 `0.01` 或大于等于 `100` 时使用共享科学计数指数；刻度固定保留两位缩放值，倍率以 `E±NN` 独立显示在轴末端。X 轴按当前时间单位换算后判断，多 Y 轴分别计算。tooltip 和标注编辑器使用各自的普通十进制格式。所有格式化仅作用于展示层，受控数据与比例尺仍使用原始数值。
标注框候选位置按上、下、右、左及四个对角方向排序，优先垂直布局并按轨道独立执行碰撞避让。

## 数据流

1. `normalizeWaveformData` 将 samples 或 points 输入转换为有序有限点。
2. `normalizeWaveformSeries` 为多通道数据提供稳定 ID，并过滤空通道。
3. 数据引用变化时缓存每个通道的有序点和 X/Y 域。
4. `WaveformChart` 截取可见域，并按像素桶保留首点、末点和 Y 极值后生成 SVG path。
5. D3 zoom 更新比例尺变换并发出 `zoom-change`，pointer move 仍基于原始点更新 hover。

内部时间坐标始终使用秒；`timeUnit` 只影响轴、端点和 tooltip 的显示格式。

## 设计约束

- 使用 `shallowRef` 保存 D3 行为和 ResizeObserver，避免深层响应式开销。
- 缩放行为只由 `zoomable`、显示模式、绘图区尺寸和通道数决定。
- 父组件通过 props 提供不可变数据；只有替换 `data` 引用才会刷新内部缓存。
- 空数据和非法数据必须渲染明确的空状态，而不是创建无效 SVG path。

## 测试与验证

`WaveformChart.test.ts` 覆盖数据规范化、空数据、多通道布局、坐标轴、显示模式、hover、
tooltip、缩放和响应式尺寸变化。完成改动后运行：

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```
