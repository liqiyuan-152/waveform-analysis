# 性能优化使用指南

本文档简要说明如何使用新增的性能优化功能。

## 渲染层自动采样

组件规范化时保留全部有效点，坐标域、误差棒、tooltip 和标注均使用完整数据。绘制路径会根据
当前视口宽度和 `rendering` 配置自动选择代表点，避免大数据量直接生成过长的 SVG 路径。

### 默认行为

```typescript
import { WaveformChart } from 'waveform-analysis'

// 渲染层降采样默认启用，传入数据不会被修改或丢弃
<WaveformChart :data="largeDataset" />
```

### Worker / WASM 配置

`rendering.sampling` 是一个互斥三态配置。`auto` 按每条系列当前视口内的点数决定是否采样；
不超过阈值时仍保留完整的可见线条细节。`wasm` 强制经 Worker + WASM 路径，`raw` 完全绕过
Worker 采样。采样只影响 SVG 连线；tooltip、标注、域和事件始终读取完整数据。

```vue
<WaveformChart
  :data="largeDataset"
  :rendering="{
    sampling: {
      mode: 'auto',
      strategy: 'peak',
      autoThreshold: 1000,
      maxPointsPerPixel: 4,
      wasmFailureFallback: 'javascript',
    },
  }"
/>
```

策略可选 `peak`、`lttb`、`min`、`max`、`minmax`、`average`、`sum` 和 `none`。一般波形优先使用
`peak` 或 `minmax`；`average` 可能平滑尖峰，`sum` 仅适合具有区间累计语义的数据。

### 多分辨率索引与缓存

JavaScript 回退后端和 Rust/WASM 后端首次采样某一数据集时，`peak` 与 extrema 请求会按需建立
Min/Max 分层；`average` 与 `sum` 会建立 Sum/Count 分层。每个索引层只覆盖已经访问的系列，并受
每数据集 8 MiB 上限约束；无法继续建立时会回退到当前视口计算。LTTB 不做全局预计算，而是将
当前视口结果放入缓存。WASM 数据集使用显式 handle，并随数据替换、系列移除或组件卸载释放。

高频缩放、平移和 resize 采用 latest-wins 调度。同一图表仅允许一个采样任务执行，并只保留一个
最新待处理视口；中间请求被合并，避免 Worker 消息队列持续增长。

输出缓存是有边界的 LRU，默认上限为 96 条或 16 MiB。键包含数据 revision、可见索引、图框宽度、
目标密度、策略和渲染维度；替换或释放数据会清空关联项。因此可安全地重复缩放或在策略间切换，
不会跨 revision 复用旧结果。

### 手动控制输入抽样

```typescript
import { downsampleLTTB, adaptiveSampling } from 'waveform-analysis'

// 仅在业务明确接受丢点时手动压缩输入数据
const sampled = downsampleLTTB(points, 1000) // LTTB 算法
const adaptive = adaptiveSampling(points, 5000) // 自适应策略
```

## 📊 抽样算法选择

### LTTB (推荐用于保持形状)

适用于需要保持波形细节和峰值的场景：

```typescript
import { downsampleLTTB } from 'waveform-analysis'

const sampled = downsampleLTTB(originalPoints, 1000)
// 从任意数量降至 1000 点，保持视觉保真度
```

### MinMax (推荐用于超大数据集)

适用于快速预览和展示数据范围：

```typescript
import { downsampleMinMax } from 'waveform-analysis'

const sampled = downsampleMinMax(originalPoints, 500)
// 保证捕获最小值和最大值
```

### 自适应抽样（最简单）

自动选择最佳算法：

```typescript
import { adaptiveSampling } from 'waveform-analysis'

const result = adaptiveSampling(originalPoints, 5000)
console.log(result.algorithm) // 'none' | 'lttb' | 'minmax'
console.log(result.originalCount) // 原始点数
```

## 诊断与基准

监听 `sampling-complete` 可以采集每条系列的 `backend`、源点数、可见点数、渲染点数、耗时、
`cacheHit`、调度次数、合并次数与最大待处理数量。诊断是低频的采样结果事件，不应用于
pointermove 等逐帧逻辑。

`#/wasm-sampling` 路由提供 10 x 100k `Float32Array` 的可重复场景，可切换执行模式、全部策略、
阈值与每像素点数，并在表格中显示每条系列的实际诊断。用它比较首次缩放、重复缩放、策略切换与
局部放大，而不是依赖固定的跨机器绝对耗时承诺。

## 发布兼容检查

库产物将 WASM 内联到模块 Worker，宿主不需要部署独立 `.wasm` 文件。正式发布前应在目标部署
环境逐项检查：

1. Chromium、Firefox 和 Safari 能初始化模块 Worker 与 WASM，并在 10 x 100k 场景中报告真实
   `wasm` 后端。
2. 严格 CSP 明确允许模块 Worker、所需的 `data:` 资源及 WebAssembly 编译；不能满足时确认
   `auto` 使用 JavaScript 回退，强制 `wasm` 发出 `sampling-error`。
3. 子路径与离线部署能够解析发布包内的 Worker asset，不要求复制不存在的 `.wasm` 文件。
4. Node/SSR 环境可导入 ESM 和 CJS 入口，导入期间不访问 `window` 或启动 Worker。

当前仓库自动化覆盖算法、回退、构建、SSR 导入和发布清单；Chromium 已进行桌面与 390 x 844
烟测。Firefox、Safari、目标站点的严格 CSP、离线和子路径部署属于发布环境人工检查项，未实际
验证前不应宣称兼容。

## 配置旧渲染阈值

通过 `rendering` 属性调整渲染层降采样，无需修改组件源码：

```vue
<WaveformChart
  :data="largeDataset"
  :rendering="{ downsample: true, downsampleThreshold: 2000, maxPointsPerPixel: 4 }"
/>
```

## 📝 其他优化

### 常量配置

所有魔法数字已提取到 `src/components/core/constants.ts`，便于统一调整：

```typescript
import { WHEEL_ZOOM_DEBOUNCE_MS, ZOOM_CONSTRAINTS } from 'waveform-analysis'
```

### 性能监控

```typescript
// 监控数据处理时间
console.time('data-processing')
const series = normalizeWaveformSeries(data)
console.timeEnd('data-processing')
```

## 🐛 故障排除

### 抽样后波形失真

如果抽样后的波形不符合预期：

1. 尝试增加目标点数：`downsampleLTTB(data, 10000)`
2. 使用 MinMax 算法保证峰值：`downsampleMinMax(data, 5000)`
3. 将 `rendering.downsample` 设为 `false`，对比完整路径确认是否由渲染采样导致

### 性能仍然不佳

1. 检查数据点数：`console.log(points.length)`
2. 确认 `rendering.downsample` 未被关闭
3. 考虑减少同时显示的系列数量
4. 使用分页功能拆分数据

## 📚 更多信息

完整的优化详情请参考 [OPTIMIZATIONS.md](./OPTIMIZATIONS.md)
