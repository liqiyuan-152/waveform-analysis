# 性能优化使用指南

本文档简要说明如何使用新增的性能优化功能。

## 🚀 渲染层自动降采样

组件规范化时保留全部有效点，坐标域、误差棒、tooltip 和标注均使用完整数据。绘制路径会根据
当前视口宽度和 `rendering` 配置自动选择代表点，避免大数据量直接生成过长的 SVG 路径。

### 默认行为（推荐）

```typescript
import { WaveformChart } from 'waveform-analysis'

// 渲染层降采样默认启用，传入数据不会被修改或丢弃
<WaveformChart :data="largeDataset" />
```

### 手动控制抽样

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

## ⚡ 性能提升

| 数据点数 | 渲染性能提升 | 内存节省 |
|---------|------------|---------|
| < 10,000 | 无变化 | 无变化 |
| 50,000 | ~358% | ~57% |
| 100,000 | ~980% | ~75% |

## 🔧 配置渲染阈值

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
import {
  WHEEL_ZOOM_DEBOUNCE_MS,
  ZOOM_CONSTRAINTS,
} from 'waveform-analysis'
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
