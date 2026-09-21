# WASM 多通道大数据采样目标文档

## 1. 文档用途

本文档用于指导 Codex 分阶段实现 Waveform Analysis 的大数据处理能力。目标是在单条通道
包含 10 万级数据点、同一图表包含多条此类通道时，仍能保持可接受的加载、缩放、悬停和
标注体验。

本文档是目标和验收规范，不代表所有设计已经实现。执行某一阶段前，Codex 必须先检查当前
源码、测试、公开导出和工作区状态，不得依据本文档假设代码尚未发生变化。

## 实现状态（2026-08-30）

- 阶段 0、1、4：已在当前分支完成，包括性能基线、JavaScript 参考算法与共享语义、
  JavaScript 回退和 WASM 数值内核。
- 阶段 2：已完成。TypedArray 输入在规范化、Worker 注册和完整数据查询链路中保持紧凑表示；
  `typed-samples` 只传 Y、采样元数据和必要的空洞索引，不生成完整 X 列；按需点访问器兼容既有
  数组渲染和交互代码。
- 阶段 3：已完成 Worker 数据仓库和有界 latest-wins 调度，同一实例最多一个执行中任务和一个
  最新待处理任务；requestId/revision 继续阻止过期结果提交。
- 阶段 5：已完成。有界 LRU、revision 失效和资源释放已实现；JavaScript 回退与 Rust/WASM 均
  具有按需 Min/Max 和 Sum/Count 多分辨率层，WASM 数据集由可释放 handle 持久管理。
- 阶段 6：已完成。公开配置和兼容映射已稳定；`#/wasm-sampling` 提供 10 x 100k TypedArray
  策略/模式演示与逐系列真实诊断；完整质量门禁、发布包、SSR 导入、Chromium 桌面和小视口均
  已验证，Firefox、Safari、严格 CSP、离线与子路径部署已明确列为发布环境人工检查项。
- 本次阶段覆盖新增索引边界、Sum/Count、缓存命中、revision 失效、重复缩放、LRU 逐出和多系列
  行为测试。完整质量门禁与浏览器验证结果应以本次变更的最终执行记录为准。

## 2. 总目标

在不破坏现有 Vue 组件 API 和数据语义的前提下，引入 Web Worker、WebAssembly 和
TypedArray 支持，使完整波形数据可以在主线程之外保存和处理，并根据当前视口、图框宽度和
可切换的采样策略生成数量受控的渲染数据。

目标场景包括：

- 单条通道至少支持 100,000 个有效数据点。
- 同一图表的多条通道可分别包含至少 100,000 个有效数据点。
- 可见通道总数据量达到百万级时，不能因为生成大量 SVG 节点或同步扫描全部数据而长期阻塞
  主线程。
- 缩放后必须重新查询当前视口对应的完整数据，不能只放大首次加载时生成的采样结果。
- 用户可以切换 ECharts 风格的采样方式和项目自有的峰值保真采样方式。
- 采样执行模式提供 `auto`、`wasm`、`raw` 三态配置，默认使用 `auto`。
- Tooltip、标注、坐标域、误差范围和事件值继续以完整原始数据为准。

## 3. 不可破坏的行为契约

以下约束优先级高于性能优化：

1. 输入数据保持不可变。不得原地排序、修改、转移或清空消费者传入的数组或 ArrayBuffer，
   除非新的公开 API 明确要求消费者主动转移所有权。
2. 替换 `data` 引用必须刷新规范化结果、坐标域、缓存和视口状态。不得依赖数组原地修改触发
   更新。
3. 原始 X 坐标始终使用秒。`timeUnit` 和格式化器只影响显示，不能修改采样边界、视口范围或
   事件值。
4. 多系列必须继续使用唯一且稳定的系列 ID。Worker 或 WASM 内部的数据 ID 不得替代公开的
   系列 ID。
5. 采样结果只用于渲染。坐标域、最近点查询、Tooltip、标注、误差范围、缩放约束和对外事件
   必须使用完整数据或能够等价还原到完整数据的索引。
6. 隐藏系列、标注和其他受控状态继续由消费者持有。Worker 不得成为这些 UI 状态的权威来源。
7. 现有 `WaveformPoint[]`、`number[]` 和公开导出保持向后兼容，除非另行批准 breaking change。

## 4. 当前实现基线

开始修改前应重新验证以下现状：

- `normalizeWaveformData` 会过滤无效点、复制点对象，并在显式 X 无序时排序。
- `prepareWaveformSeries` 会再次扫描完整点数组，计算 X/Y domain 和误差范围。
- `resolveVisiblePointRange` 已使用二分查找定位可见数据范围。
- `peakPreservingPointSelectionStrategy` 会扫描可见范围，并按桶保留
  first/minimum/maximum/last。
- SVG 路径点数已经受到图框宽度和 `maxPointsPerPixel` 限制。
- 普通悬停最近点使用二分查找。
- `lineType: 'none'` 的部分标注候选查询仍可能线性扫描完整序列。
- `downsampleLTTB`、`downsampleMinMax` 和 `adaptiveSampling` 已存在，但不等于组件渲染链路
  已经使用这些算法。
- 现有 100,000 点测试主要验证渲染结果上限，并未构成加载耗时、交互帧耗时或内存上限保证。

## 5. 目标架构

```text
Public Vue API
  |-- existing object-array input
  `-- optional TypedArray input
             |
             v
Main-thread adapter
  |-- compatibility conversion
  |-- request versioning and cancellation
  `-- Vue/D3/SVG integration
             |
             v
Web Worker data store
  |-- dataset registration and disposal
  |-- viewport query scheduling
  |-- cache ownership
  `-- WASM invocation
             |
             v
WASM numeric core
  |-- validation and metrics
  |-- visible-range lookup
  |-- sampling algorithms
  |-- multiresolution indexes
  `-- nearest-source-point lookup
```

### 5.1 主线程职责

- Vue 响应式编排和组件生命周期。
- D3 scale、坐标轴、tick、格式化和 SVG path 生成。
- Tooltip、标注编辑、分页、显隐和交互状态。
- 将当前视口、图框宽度、策略和请求版本发送给 Worker。
- 忽略过期 Worker 响应，避免快速缩放时旧结果覆盖新结果。

### 5.2 Worker 职责

- 持有系列数据仓库和 WASM 实例。
- 批量处理一次视口变化涉及的所有当前可见系列。
- 对当前页面、当前可见系列和正在交互的图框给予更高优先级。
- 缓存重复视口和采样策略的查询结果。
- 在系列替换、删除、组件卸载时释放对应数据。

### 5.3 WASM 职责

- 执行连续数值数组上的批量计算。
- 返回源数据索引或紧凑数值结果，不生成 Vue 对象或 SVG 字符串。
- 不管理 Tooltip、标注、DOM、D3 scale 或 Vue 状态。
- 第一阶段保持单线程，不强制项目使用 `SharedArrayBuffer`、COOP 或 COEP 响应头。

### 5.4 架构边界说明

- Worker 和 WASM 解决的问题不同：Worker 负责把计算移出主线程，WASM 负责提高连续数值计算的
  吞吐量。即使某个 JavaScript 算法在特定浏览器中与 WASM 性能接近，也不应因此退回主线程执行
  大规模同步扫描。
- 不应把 WASM 当作渲染器。SVG 节点数、路径长度和浏览器布局成本仍必须通过按视口限制输出点数
  来控制；WASM 不能消除渲染过量数据造成的瓶颈。
- 主线程、Worker 和 WASM 之间的数据复制次数必须纳入性能预算。默认复制消费者数据以保证输入
  不可变；未来如提供 transfer 模式，必须是显式、可诊断且会清楚说明所有权变化的独立 API。
- Worker/WASM 初始化必须延迟到浏览器运行期。包的模块导入不应直接访问 `window`、`Worker` 或
  WebAssembly 浏览器专用状态，以保持 SSR、测试环境和构建工具的可加载性。

## 6. 数据模型要求

### 6.1 保留现有输入

继续支持：

```ts
type ExistingWaveformInput =
  | { kind: 'samples'; values: number[]; sampleRate: number; startTime?: number }
  | { kind: 'points'; points: WaveformPoint[] }
```

现有输入进入高性能后端时可以复制为 TypedArray，但不得静默转移消费者数据的所有权。

### 6.2 建议新增的紧凑输入

最终公开命名应在实现阶段结合仓库现有类型风格确定。建议能力如下：

```ts
type TypedSampleData = {
  kind: 'typed-samples'
  values: Float32Array | Float64Array
  sampleRate: number
  startTime?: number
}

type TypedPointData = {
  kind: 'typed-points'
  x: Float64Array
  y: Float32Array | Float64Array
  error?: Float32Array | Float64Array
  lowerError?: Float32Array | Float64Array
  upperError?: Float32Array | Float64Array
}
```

要求：

- 等间隔采样优先只保存 Y 数组，通过 `startTime + index / sampleRate` 计算 X。
- 显式坐标的所有字段长度必须一致。
- 必须定义 `Float32Array` 精度损失的责任边界。X 默认优先使用 `Float64Array`。
- 公开 API 必须明确复制模式和可选的所有权转移模式，默认选择不破坏输入的复制模式。
- Worker 内部数据使用稳定的 `datasetId` 和递增 `revision` 标识。

## 7. 采样策略

### 7.1 策略集合

目标策略至少包括：

```ts
type WaveformSamplingStrategy =
  'auto' | 'none' | 'peak' | 'lttb' | 'average' | 'min' | 'max' | 'minmax' | 'sum'
```

语义：

- `none`：返回完整可见范围，仅适用于点数低于安全阈值或消费者明确要求。
- `peak`：项目当前峰值保真方式，每桶按 X 顺序保留 first/min/max/last。
- `lttb`：Largest Triangle Three Buckets，保持整体视觉形状。
- `average`：每桶返回平均值。
- `min`：每桶返回最小 Y 对应的真实源点。
- `max`：每桶返回最大 Y 对应的真实源点。
- `minmax`：每桶按 X 顺序返回最小值和最大值对应的真实源点。
- `sum`：每桶返回 Y 值总和。
- `auto`：根据数据密度、视口范围和可用索引选择策略。初始默认候选应为 `peak` 或
  `minmax`，不得默认使用可能抹除短时尖峰的 `average`。

### 7.2 输出规则

- `peak`、`lttb`、`min`、`max` 和 `minmax` 优先返回 `Uint32Array` 源点索引。
- `average` 和 `sum` 属于合成数据，必须返回新的 X/Y 数值数组，并标记结果不是源点。
- 所有结果必须保持 X 非递减顺序。
- 相邻桶返回同一源点时必须去重。
- 首尾连续性点的保留规则必须明确，并与现有 SVG 路径行为兼容。
- 阶梯线必须保留跳变位置，不能套用会改变阶梯边界语义的普通折线输出规则。
- 误差棒采样必须使用真实源点，或定义经过验证的独立误差聚合规则。

### 7.3 采样数量

目标点数由图框的 CSS 像素宽度决定，而不是固定写死：

```text
targetPoints = plotWidth * maxPointsPerPixel
```

算法可以根据自身输出特征调整桶数，但最终结果必须有可预测的上限。窗口缩放、容器尺寸变化、
采样策略变化和系列显隐变化均应触发新的视口查询。

需要明确区分两个参数：

- `autoThreshold` 只决定是否进入 WASM 采样路径。
- `maxPointsPerPixel` 决定采样后允许返回多少渲染点。

例如可见范围有 100,000 点、图框宽度为 800px、`maxPointsPerPixel` 为 4 时，自动模式应进入
WASM，但目标输出上限仍按约 3,200 点计算，而不是固定输出 1,000 点。

### 7.4 采样执行模式

采样开关必须设计为一个互斥的三态配置，不能使用三个可能同时为 `true` 的布尔字段：

```ts
type WaveformSamplingMode = 'auto' | 'wasm' | 'raw'
```

三种模式的语义如下：

| 模式   | 行为                                                                                                      |
| ------ | --------------------------------------------------------------------------------------------------------- |
| `auto` | 默认模式。当前视口内单条系列的有效点数大于阈值时使用 Worker + WASM 采样，否则直接使用当前视口内的原始点。 |
| `wasm` | 强制通过 Worker + WASM 执行所选采样策略，不受自动阈值限制。                                               |
| `raw`  | 强制绕过 Worker + WASM 采样，直接使用当前视口内的原始点。                                                 |

默认自动阈值为 `1_000` 个点，并允许配置：

- 当前视口内有效点数小于或等于 `1_000` 时使用原始点。
- 当前视口内有效点数大于 `1_000` 时使用 WASM 采样。
- 判断单位是单条系列，不是整个图表中所有系列的点数总和。
- 初次全局视图、缩放、平移和数据替换后均应根据新的可见点数重新判断。
- 放大到不超过阈值的局部范围时，应自动恢复原始点，保证局部细节完整。
- 连续缩放过程中应避免在阈值附近反复切换后端。可以在交互进行期间使用迟滞区间或延迟切换，
  但缩放结束后的稳定状态必须重新按照 `> autoThreshold` 的规则校准。例如阈值为 1,000、
  内部迟滞为 200 时，交互过程中可以使用 1,200/800 的进入和退出边界，交互结束后仍必须保证
  1,001 点使用 WASM、1,000 点使用原始数据。
- `raw` 是消费者明确接受性能风险后的强制配置。多条 100k 系列使用该模式可能生成超长 SVG
  路径，文档和开发环境诊断应明确提示这一风险。
- `wasm` 表示强制使用 WASM 执行路径，即使点数不超过阈值；当目标输出数量不少于源点数量时，
  算法可以等价返回全部源点索引，但请求仍通过 Worker + WASM 完成。

自动阈值只决定是否进入 WASM 采样路径，不替代按图框宽度计算目标渲染点数的规则。

### 7.5 策略建议

默认自动策略应优先面向波形的峰值保真，而不是简单平均：

- ECharts 的 `series-line.sampling` 默认值是不配置采样，而不是某一种降采样算法；这等价于本
  文档策略层的 `none`。本项目默认 `mode: 'auto'` 且在超过阈值时选择峰值保真策略，是针对多
  通道 100k 波形场景作出的有意差异，README 必须明确，不能宣称它是 ECharts 的默认行为。

- `peak` 或 `minmax`：推荐作为普通波形的默认候选，避免丢失短时尖峰和窄谷。
- `lttb`：适合关注整体视觉趋势的场景。
- `average`：适合平滑趋势，但必须明确可能抹除短时极值。
- `min`、`max`：适合只观察单侧极值。
- `sum`：只适用于具有明确区间聚合语义的业务，不应作为普通波形默认值。

切换策略只允许使对应采样缓存失效，不得重置 X/Y 视口、标注、分页或系列显隐状态。

## 8. 多分辨率索引

为了避免每次缩放都重新扫描每条系列的全部可见点，数据注册后应按需构建多分辨率聚合索引。

推荐优先实现：

- MinMax 或 Peak 金字塔，用于 `min`、`max`、`minmax`、`peak` 和 `auto`。
- Sum/Count 聚合层，用于 `sum` 和 `average`。
- LTTB 可以先按视口即时计算并缓存，不要求预计算全部层级。

索引要求：

- 最底层始终保留完整原始数据。
- 每层记录能够追溯到真实源点的索引。
- 查询必须正确处理视口左右边界处的不完整桶。
- 索引内存必须可观测、可释放，并设定合理的增长上限。
- 不得为隐藏或未访问的系列无条件预计算所有算法的全部索引。

采样结果缓存键至少应包含：

```text
datasetId
revision
visibleStartIndex
visibleEndIndex
plotWidth
strategy
maxPointsPerPixel
lineType
```

如果点、误差棒或其他渲染开关会改变采样结果，也必须纳入缓存键。数据 revision 变化后不得复用
旧缓存。

## 9. 查询协议

Worker 协议至少覆盖以下操作，具体名称可以调整：

```ts
type WorkerRequest =
  | RegisterDatasetRequest
  | ReplaceDatasetRequest
  | SampleViewportRequest
  | FindNearestPointRequest
  | GetDatasetMetricsRequest
  | DisposeDatasetRequest
  | DisposeAllRequest
```

`SampleViewportRequest` 至少包含：

- `requestId`
- `datasetId`
- `revision`
- X domain
- 图框宽度
- 当前系列的可见起止索引或足以确定该范围的 X domain
- 采样模式和自动阈值判定结果
- 采样策略
- 每像素最大点数
- 线型和是否需要点、误差棒等渲染信息

响应必须携带相同的 `requestId`、`datasetId` 和 `revision`。主线程只能提交当前仍有效的响应。

推荐一次消息批量包含当前页面所有可见系列，避免每次视口变化发送大量小消息。Worker 内部处理
顺序建议为：当前正在交互的图框、当前页面其他可见系列、其他低优先级预处理任务。允许按系列
分批返回，但主线程必须分别验证每个结果的 requestId 和 revision。

发出新请求时不得立即清空当前 SVG 路径。主线程应保留上一份有效渲染结果，直到收到最新有效
响应后一次性替换；过期结果不得引起闪烁、空白或状态回退。

### 9.1 调度、合并与背压

- 高频 wheel、pan、resize 和连续数据替换产生的请求必须合并，只保留每条系列当前最新的待处理
  视口；不能让 Worker 消息队列无限增长。
- `requestId` 和 `revision` 只能防止旧结果提交，不能代替背压。已经过期但仍在 Worker 中排队的
  重计算也应尽可能跳过，避免用户停止交互后仍长时间处理无用任务。
- 一次批量请求不应被单条超大系列永久占用。实现可在系列边界检查是否已有更新请求，并优先让
  当前页面和当前交互图框得到结果。
- Worker 尚未准备好时，主线程可以显示受图框宽度限制的临时几何或上一份有效结果，但不得同步
  扫描全部可见数据来制造“临时采样”，否则会重新引入首帧阻塞。
- 调度策略必须可测试。至少记录合并请求数、丢弃的过期请求数、最长队列长度和最终稳定视口的
  完成延迟。

## 10. 数据语义

实现前必须为 JS 和 WASM 共同确定以下规则，并写成共享测试向量：

- 非有限 X/Y 值如何过滤。
- 无序 X 是否自动排序，以及排序是否稳定。
- 重复 X 的保留和最近点选择规则。
- 数据空洞是否形成断线；如果支持空洞，应避免规范化阶段直接丢失断点信息。
- `average` 和 `sum` 的输出 X 使用桶中心、平均 X 还是其他定义。
- `min` 和 `max` 必须使用极值真实点的原始 X。
- `minmax` 和 `peak` 同桶内的输出顺序和去重规则。
- 误差值无效、对称误差和非对称误差的优先级。
- 单点、双点、零跨度 domain、反向 domain 和超出数据范围的查询。
- `samples` 的计算 X 与现有秒单位契约完全一致。

JS 回退实现和 WASM 实现必须对这些测试向量产生等价结果。

## 11. API 配置草案

最终命名需结合现有 `WaveformRenderingOptions` 决定，建议形态如下：

```ts
interface WaveformSamplingOptions {
  /** Defaults to `auto`. */
  mode?: 'auto' | 'wasm' | 'raw'
  /** Per-series visible-point threshold used by auto mode. Defaults to 1_000. */
  autoThreshold?: number
  /** Optional interaction-only hysteresis around autoThreshold. */
  autoHysteresis?: number
  strategy?: WaveformSamplingStrategy
  maxPointsPerPixel?: number
  /** Warn or reject before raw mode renders an excessive visible point count. */
  rawPointLimit?: number
  /** Whether forced WASM mode may show a JavaScript fallback after reporting failure. */
  wasmFailureFallback?: 'error' | 'javascript'
}

interface WaveformRenderingOptions {
  sampling?: WaveformSamplingOptions
  // Existing fields remain supported during compatibility period.
  downsample?: boolean
  downsampleThreshold?: number
  maxPointsPerPixel?: number
  pointMinSpacing?: number
  errorBarMinSpacing?: number
}
```

兼容规则必须在实现时明确：

- 未传新配置时，现有默认渲染结果不能发生不可解释的变化。
- 未传 `sampling.mode` 时使用 `auto`，未传 `autoThreshold` 时使用 `1_000`。
- `autoThreshold` 必须规范化为大于或等于 1 的有限整数。
- `autoHysteresis` 只能用于交互过程中的稳定处理，不能改变交互结束后的 1,000/1,001 边界。
- 旧的 `downsample: false` 应能够映射到 `mode: 'raw'`。
- 旧的 `downsample: true` 在没有新配置时应映射到 `mode: 'auto'`。
- 旧的 `maxPointsPerPixel` 与新字段冲突时必须有确定优先级，并在 README 中说明。
- `mode: 'auto'` 在 WASM 初始化失败时回退到 JavaScript 等价采样，不应直接把大数据作为原始
  SVG 路径渲染，也不应导致组件不可用。
- `mode: 'wasm'` 不得静默改用 JavaScript 并假装 WASM 已启用。失败时应发出可诊断的错误或
  降级事件；是否同时显示 JavaScript 临时结果由 `wasmFailureFallback` 明确决定。
- `mode: 'raw'` 不得在后台偷偷执行采样。
- `rawPointLimit` 不得静默改变 `raw` 的语义。超过限制时应提供开发警告，并根据明确配置继续
  渲染或拒绝本次渲染，而不是偷偷改用采样结果。

### 11.1 诊断能力

开发和性能排查需要能够读取最近一次系列采样状态，建议提供只读诊断结构或开发钩子：

```ts
interface WaveformSamplingDiagnostics {
  seriesId: string
  mode: 'auto' | 'wasm' | 'raw'
  backend: 'wasm' | 'javascript' | 'raw'
  strategy: WaveformSamplingStrategy
  sourcePointCount: number
  visiblePointCount: number
  renderedPointCount: number
  durationMs: number
  cacheHit: boolean
  requestId: number
  revision: number
  scheduledRequestCount: number
  coalescedRequestCount: number
  maxPendingRequestCount: number
}
```

调度计数应按稳定且有文档说明的生命周期累计或重置，使一次连续缩放期间是否发生请求合并、
待处理请求是否始终有界能够直接验证。若另行统计过期响应或失败次数，应使用独立字段，不能将
“请求已合并”和“响应因过期被丢弃”混为同一指标。

可考虑增加低频事件：

- `sampling-backend-change`
- `sampling-error`
- `sampling-complete`

不得在每次 pointermove 或每帧产生高频公开事件。生产构建是否保留详细耗时字段应通过包体积和
运行成本评估决定。

## 12. 生命周期和资源管理

必须覆盖：

- 组件挂载时按需初始化 Worker，不在模块导入时阻塞加载。
- 同一页面多个图表实例是否共享 Worker，需要通过基准测试决定；不得直接使用不可释放的全局
  单例。
- 数据引用变化时增加 revision，并释放或替换旧数据。
- 系列被移除、分页长期不可见或组件卸载时释放对应数据和缓存。
- Worker 异常退出、WASM 加载失败和请求超时均有 JavaScript 回退路径。
- 快速连续缩放时取消或忽略旧任务，只提交最新视口结果。
- 不得让过期响应恢复已经隐藏、删除或替换的系列。
- 新采样结果等待期间保留上一份有效路径，只有最新结果可以原子替换显示数据。
- 切换采样策略或模式时保留当前视口、标注、分页和显隐状态。
- Worker 协议从第一版开始包含 revision，即使实时流式追加暂不在第一版范围内。

### 12.1 内存预算

- 分别统计消费者输入、主线程内部数据、Worker 数据副本、WASM 线性内存、索引和输出缓存，不能
  只观察 JavaScript heap 就判断内存是否受控。
- 10 x 100k 只是最低验收场景，不代表可以为每种策略长期保留一份完整副本。索引应共享基础
  聚合信息，输出缓存应按字节和条目双重限制。
- TypedArray 兼容层允许按需生成少量 `WaveformPoint` 对象，但不得因一次数组迭代、响应式追踪或
  调试输出而永久物化整条 100k 系列。按需对象缓存必须有明确上限。
- 任何 transfer、复制或 WASM 内存增长都应有测试证明不会分离消费者的 ArrayBuffer，也不会在
  重复替换数据后持续保留旧 revision。

### 12.2 运行环境和发布兼容

- 明确支持的最低浏览器版本，并至少验证 Chromium、Firefox 和 Safari 的 Worker、WASM、
  TypedArray 与模块加载行为；无法自动化的浏览器必须列为发布前人工检查项。
- 验证严格 CSP、子路径部署、离线资源和 library consumer 场景中的 Worker/WASM URL 解析。
  若 WASM 被内联进 Worker chunk，应在架构和打包文档中明确说明，不应要求消费者额外复制一个
  不存在的 `.wasm` 文件。
- 内联 `data:application/wasm;base64,...` 不能被视为天然兼容任意严格 CSP。发布文档必须说明
  实际需要的 `worker-src`、WASM 编译执行策略及相关浏览器差异；未在目标 CSP 下实际初始化成功
  时，只能列为待验证项，不能宣称兼容。
- Worker/WASM 构建工具链版本必须锁定，并在 CI、发布工作流和本地开发说明中保持一致。
- 功能检测必须基于实际初始化结果，而不是只检查全局对象是否存在；失败原因应进入可序列化诊断。

## 13. 性能目标和基准

不要先写无法验证的绝对性能承诺。第一阶段应建立基准工具并记录测试环境，然后依据结果确定
正式预算。

基准矩阵至少包括：

| 场景       | 数据规模                                                         |
| ---------- | ---------------------------------------------------------------- |
| 单系列     | 100k、500k、1M 点                                                |
| 多系列     | 10 x 100k、20 x 100k                                             |
| 多图框分页 | 当前页可见和非当前页系列                                         |
| 数据类型   | samples、points、typed-samples、typed-points                     |
| 数据状态   | 已排序、无序、含无效值、含重复 X、含误差值                       |
| 操作       | 首次注册、首次渲染、替换数据、缩放、平移、resize、切换策略、悬停 |

至少记录：

- 数据转换和 Worker 注册耗时。
- WASM 初始化耗时。
- 首次可见路径出现时间。
- 单次视口采样耗时和 P95。
- 主线程 Long Task 数量与最长阻塞时间。
- Worker 和主线程内存占用。
- 每条系列返回的渲染点数。
- 自动阈值附近连续缩放时的后端切换次数。
- 请求等待期间是否出现空白帧或路径闪烁。
- 快速连续缩放时过期请求数和最终结果延迟。
- 高频交互期间的最大 Worker 待处理队列长度和请求合并率。
- 从首次输入到临时受控几何、再到最终 WASM 几何的两个时间点。
- 数据注册过程中主线程、Worker、WASM、索引和缓存各自的峰值字节数。

在 CI 中优先使用稳定的算法上限和相对回归阈值。对强依赖机器性能的毫秒级断言，应放在独立
基准任务中，避免普通单元测试不稳定。

## 14. 测试要求

### 14.1 算法一致性

- 每种策略覆盖空数据、单点、双点、小于目标点数和远大于目标点数。
- JS 与 WASM 使用同一组固定测试向量，比较索引和数值结果。
- 覆盖尖峰、窄谷、阶跃、周期波、噪声和直线。
- 覆盖 NaN、Infinity、重复 X、无序 X 和误差字段。
- `minmax` 和 `peak` 必须验证窄峰与窄谷不会丢失。
- `average` 和 `sum` 必须验证桶边界与合成 X 语义。

### 14.2 集成行为

- 多条 100k 系列的 SVG 点数分别受图框宽度限制。
- 自动模式下，单条系列当前视口点数为 1,000 时使用原始数据，1,001 时使用 WASM 采样。
- 自动模式按系列独立判断；同一图表可以同时存在使用原始点和使用 WASM 采样的系列。
- 强制 WASM 模式不受自动阈值影响，强制原始模式不发起采样请求。
- 自动模式在阈值附近连续缩放时不会逐帧反复切换后端，交互结束后仍满足精确边界。
- 图框宽度变化会改变目标渲染点上限，自动阈值不会被误用为固定输出点数。
- 等待 Worker 新结果期间继续显示上一份有效路径，最新结果到达后无空白地替换。
- 强制原始模式超过保护限制时产生明确诊断，不会静默启用采样。
- 缩放到局部后能够显示首次全局采样中没有出现的真实细节。
- Tooltip 返回当前视口附近的真实源点，而不是 average/sum 合成点。
- 标注创建、编辑和重新投影继续绑定真实系列 ID 和原始坐标。
- domain 和误差范围不因采样策略切换而变化。
- 切换策略不会重置不相关的视口和受控状态。
- 缓存键包含数据 revision；替换数据后不会命中旧采样结果。
- 数据引用替换后，旧 Worker 响应不能覆盖新数据。
- WASM 或 Worker 不可用时，JavaScript 回退结果正确。
- 诊断信息能够解释每条系列为何选择 raw、JavaScript 或 WASM 后端。
- SSR 或非浏览器环境导入包入口不会因访问 Worker、window 或 WASM 资源而失败。
- 高频缩放请求会被合并，Worker 队列不会随事件数量无界增长。
- Worker 首次初始化期间不会同步扫描全部 100k 可见点来生成临时路径。
- TypedArray 输入的兼容访问不会因为迭代、`slice`、索引访问或最近点查询而永久展开整条系列。

### 14.3 资源释放

- 组件卸载后 Worker 请求、数据集和缓存能够释放。
- 重复替换数据不会持续增加不可回收内存。
- 多图表实例创建和销毁不会遗留事件监听或后台任务。

## 15. 分阶段实施计划

每个阶段应独立提交、独立验证，不要在一次修改中同时重写数据 API、Worker、WASM 和渲染层。

### 阶段 0：建立可测基线

目标：在修改行为前量化现有瓶颈。

- 增加多系列 100k 数据的基准场景或专用 demo route。
- 测量规范化、domain 扫描、视口选择、SVG path 生成和悬停。
- 记录现有内存模型和浏览器性能轨迹。
- 明确第一版支持的最大可见系列数和正式性能预算。

完成条件：基准可以重复运行，输出包含环境和上述核心指标。

### 阶段 1：纯 TypeScript 整理和算法契约

目标：先建立稳定边界，避免 WASM 固化错误语义。

- 合并可以合并的规范化与指标扫描。
- 定义统一的采样请求、结果和策略接口。
- 为 ECharts 风格策略实现或整理 JavaScript 参考版本。
- 修复或限制 `lineType: 'none'` 标注候选的完整线性扫描。
- 建立 JS/WASM 共用测试向量。

完成条件：所有策略语义被测试覆盖，现有 API 和测试继续通过。

### 阶段 2：TypedArray 公共输入

目标：减少多系列场景下的对象数量和复制成本。

- 增加紧凑 samples 和 points 输入。
- 保持旧输入兼容。
- 明确复制和所有权转移策略。
- 避免等间隔 samples 无条件展开成完整 `{x, y}` 对象数组。
- 更新 `src/index.ts`、README、类型测试和打包检查。

完成条件：对象输入与 TypedArray 输入在 domain、渲染和交互上等价，且基准能展示内存差异。

### 阶段 3：Worker 数据仓库

目标：将重计算和完整数据管理移出主线程。

- 实现数据注册、替换、采样、最近点和释放协议。
- 实现 requestId/revision 防过期机制。
- 批量请求当前页面的可见系列。
- 等待新结果时保留上一份有效路径，并实现最新结果原子替换。
- 增加自动阈值稳定处理和基础诊断信息。
- 合并高频视口请求并实现有界待处理队列，避免仅丢弃响应却继续执行全部过期计算。
- Worker 初始化期间使用上一份有效结果或宽度受控的临时几何，避免主线程全量扫描。
- 先使用 JavaScript 算法运行在 Worker 中，保留同步回退实现。

完成条件：多系列采样不再同步阻塞主线程，快速缩放不会提交旧结果。

### 阶段 4：WASM 数值内核

目标：替换 Worker 内部的批量数值热点。

- 确定仓库采用的 WASM 工具链并锁定版本。
- 实现范围统计、可见范围、peak/min/max/minmax/average/sum。
- 根据基准决定 LTTB 是否进入第一版 WASM。
- 返回 TypedArray 索引或数值结果。
- 保留 JavaScript 回退并运行一致性测试。
- 验证 Vite demo、library build、声明产物和 `pnpm pack --dry-run` 包含必要 WASM 资源。

完成条件：WASM 与 JS 参考结果一致，初始化失败能够回退，发布包可被真实消费者加载。

### 阶段 5：多分辨率索引和缓存

目标：使缩放成本更接近屏幕宽度，而不是完整数据量。

- 实现按需 MinMax/Peak 金字塔。
- 实现 Sum/Count 聚合层。
- 设计有上限的 LRU 缓存。
- 使用包含 datasetId、revision、视口索引、宽度、策略和线型的完整缓存键。
- 处理边界桶和局部细节恢复。
- 对隐藏系列和非当前页系列延迟构建索引。

完成条件：重复和连续缩放的 P95 明显优于阶段 4，内存增长受控且资源可释放。

### 阶段 6：公开配置和完整文档

目标：将能力作为受支持的组件 API 发布。

- 稳定采样配置命名和兼容映射。
- 增加 `auto`、`wasm`、`raw` 模式和采样策略切换 demo。
- 在 demo 或开发面板中显示后端、源点数、可见点数、渲染点数、耗时和缓存命中状态。
- 更新 README、架构文档、性能指南和 `src/index.ts`。
- 验证 SSR 导入、子路径资源加载、严格 CSP 和主要浏览器兼容性，并记录未自动化的发布检查。
- 完成 typecheck、file-length、lint、coverage、build 和 pack 验证。
- 为视觉变化在桌面和小容器下进行浏览器验证。

完成条件：消费者能够按文档启用、切换、回退和诊断采样后端。

## 16. 每次交给 Codex 的执行模板

后续可以使用以下模板启动某一阶段：

```text
请按照 docs/wasm-sampling-goal.md 执行“阶段 N：阶段名称”。

要求：
1. 开始前阅读 AGENTS.md、目标文档和相关当前源码，不假设文档中的基线仍然完全准确。
2. 只完成本阶段，不提前实现后续阶段。
3. 保持输入不可变、原始数据用于交互、采样结果只用于渲染等行为契约。
4. 先运行最接近的测试，再运行本阶段涉及的完整质量门禁。
5. 更新必要的 README、src/index.ts 和测试，但不要修改无关代码。
6. 最终说明公开行为变化、架构决策、实际运行的命令、未验证项和下一阶段入口。
```

对于较大的阶段，应先要求 Codex输出本阶段的文件级计划和风险清单，经确认后再实施。

## 17. 暂不纳入第一版

- WASM 多线程和 `SharedArrayBuffer` 强依赖。
- 强制宿主配置 COOP/COEP。
- WebGL 或 Canvas 渲染器替换现有 SVG。
- 实时流式追加协议和环形缓冲区。
- 服务端预采样或远程分块查询。
- 所有系列和所有算法的无条件全量预计算。
- 删除现有 JavaScript 算法回退。

这些能力可以在百万至千万级常驻数据、实时流或 SVG 本身成为主要瓶颈后另行评估。

## 18. 完成定义

整个目标完成必须同时满足：

- 多条通道各自包含 100,000 点时，可以通过 Worker + WASM 按视口生成受控数量的渲染点。
- 默认 `auto` 模式按单条系列当前视口点数判断：大于 1,000 点使用 WASM，其他情况使用原始
  数据；阈值可以配置。
- `wasm` 和 `raw` 两种强制模式具有明确且经过测试的行为。
- 自动模式在阈值附近交互稳定，并在交互结束后遵守精确的 1,000/1,001 判断边界。
- 采样输出数量由图框宽度和 `maxPointsPerPixel` 控制，不使用自动阈值作为固定输出数量。
- 至少支持 `peak`、`lttb`、`average`、`min`、`max`、`minmax`、`sum` 和 `none`，并可切换。
- 放大后可以恢复并查询完整原始数据细节。
- Tooltip、标注、domain、误差范围和事件保持完整数据语义。
- TypedArray 输入避免无必要的海量对象展开。
- 主线程、Worker、WASM、索引和缓存的内存成本可以分别观测，且重复替换数据不会持续增长。
- 快速交互不会被过期 Worker 响应覆盖。
- 高频交互请求会被合并并受到背压控制，不会形成无界 Worker 队列。
- Worker 计算期间保留上一份有效路径，不出现无必要的空白或闪烁。
- Worker 首次加载期间不会为了临时画面在主线程同步扫描全部大数据。
- 强制原始模式具备可配置的过量点数保护和明确诊断，但不会静默改变模式。
- 每条系列的实际模式、后端、策略、点数、耗时和缓存状态可被诊断。
- Worker、WASM 内存、索引和缓存均有明确生命周期。
- JavaScript 回退可用，且与 WASM 通过共享测试向量验证一致。
- 公共类型、导出、README、架构文档、性能文档、测试和发布包同步更新。
- 包入口可在 SSR/非浏览器环境安全导入，Worker/WASM 资源在支持的部署方式和浏览器中可加载。
- 项目规定的 typecheck、文件长度、lint、coverage、build 和 pack 检查全部实际通过。
