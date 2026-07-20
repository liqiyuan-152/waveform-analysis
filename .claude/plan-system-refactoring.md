# WaveformChart 按系统拆分重构计划

## 🎯 目标

将现有的组件按功能系统重新组织，每个系统有独立的目录，提高代码的可维护性和可理解性。

## 📊 当前结构分析

### 当前组件列表
```
src/components/
├── WaveformChart.vue              # 主容器组件 (~1143 行)
├── WaveformToolbar.vue            # 工具栏 (174 行)
├── WaveformEditor.vue             # 编辑器 (149 行)
├── WaveformTooltip.vue            # 悬浮提示 (111 行)
├── WaveformTrack.vue              # 波形轨道 (317 行)
├── WaveformAnnotationLayer.vue    # 标注层 (281 行)
├── waveform.ts                    # 类型定义
├── waveform-markup.ts             # 标注相关类型和工具
└── index.ts                       # 导出
```

### 功能系统识别

通过分析代码，可以识别出以下核心系统：

1. **基础绘制系统 (Rendering System)**
   - 波形轨道渲染（网格、坐标轴、波形线）
   - SVG 基础图形绘制
   - D3 图表渲染

2. **缩放系统 (Zoom System)**
   - 缩放行为管理
   - 变换状态管理
   - 独立/共享缩放模式

3. **交互系统 (Interaction System)**
   - 鼠标事件处理
   - 悬浮检测
   - 十字线显示
   - 工具栏和模式切换

4. **标注系统 (Annotation System)**
   - 标注管理（创建、编辑、删除）
   - 图形管理（垂直线、时间区间）
   - 标注渲染
   - 编辑器

5. **数据系统 (Data System)**
   - 数据规范化
   - 类型定义
   - 轨道布局计算

## 🏗️ 目标目录结构

```
src/components/
├── WaveformChart.vue                    # 主容器（协调各系统）
├── index.ts                             # 公共导出
│
├── core/                                # 核心系统
│   ├── types.ts                         # 共享类型定义
│   ├── constants.ts                     # 常量（颜色、尺寸等）
│   └── index.ts
│
├── data/                                # 数据系统
│   ├── types.ts                         # 数据相关类型
│   ├── normalize.ts                     # 数据规范化
│   ├── layout.ts                        # 轨道布局计算
│   └── index.ts
│
├── rendering/                           # 基础绘制系统
│   ├── WaveformTrack.vue               # 波形轨道组件
│   ├── Grid.vue                        # 网格组件（可选）
│   ├── Axis.vue                        # 坐标轴组件（可选）
│   ├── types.ts                        # 渲染相关类型
│   └── index.ts
│
├── zoom/                                # 缩放系统
│   ├── useZoom.ts                       # 缩放组合式函数
│   ├── types.ts                         # 缩放相关类型
│   └── index.ts
│
├── interaction/                         # 交互系统
│   ├── WaveformToolbar.vue             # 工具栏
│   ├── WaveformTooltip.vue             # 悬浮提示
│   ├── useInteraction.ts               # 交互组合式函数
│   ├── useHover.ts                     # 悬浮逻辑
│   ├── types.ts                        # 交互相关类型
│   └── index.ts
│
└── annotation/                          # 标注系统
    ├── WaveformAnnotationLayer.vue     # 标注渲染层
    ├── WaveformEditor.vue              # 标注编辑器
    ├── useAnnotation.ts                # 标注管理逻辑
    ├── markup.ts                       # 标注工具函数
    ├── types.ts                        # 标注相关类型
    └── index.ts
```

## 📦 系统划分详情

### 1. Core System (核心系统)

**职责**：提供共享的类型、常量和工具

**文件**：
- `core/types.ts` - 基础类型定义
  ```typescript
  export interface DisplaySeries { ... }
  export interface TrackLayout { ... }
  export interface WaveformPoint { ... }
  ```

- `core/constants.ts` - 常量
  ```typescript
  export const channelColors = [...]
  export const margin = { top: 18, right: 24, bottom: 52, left: 64 }
  export const minimumHeight = 180
  ```

**来源**：从 `WaveformChart.vue` 和 `waveform.ts` 提取

---

### 2. Data System (数据系统)

**职责**：数据规范化、轨道布局计算

**文件**：
- `data/types.ts` - 数据类型
  ```typescript
  export type WaveformData = ...
  export type WaveformDisplayMode = ...
  export interface WaveformSeries { ... }
  ```

- `data/normalize.ts` - 数据规范化
  ```typescript
  export function normalizeWaveformData(data: WaveformData): WaveformSeries[]
  export function normalizeWaveformSeries(data: WaveformData): DisplaySeries[]
  ```

- `data/layout.ts` - 轨道布局计算
  ```typescript
  export function computeTrackLayouts(
    series: DisplaySeries[],
    displayMode: WaveformDisplayMode,
    innerWidth: number,
    innerHeight: number,
    ...
  ): TrackLayout[]
  ```

**来源**：
- `waveform.ts` → `data/types.ts` + `data/normalize.ts`
- `WaveformChart.vue` 中的 `trackLayouts` 计算逻辑 → `data/layout.ts`

---

### 3. Rendering System (基础绘制系统)

**职责**：渲染波形轨道、网格、坐标轴、波形线

**文件**：
- `rendering/WaveformTrack.vue` - 波形轨道组件（已存在）
- `rendering/types.ts` - 渲染相关类型
  ```typescript
  export interface RenderingProps { ... }
  export interface AxisConfig { ... }
  ```

**可选优化**：
- `rendering/Grid.vue` - 独立网格组件
- `rendering/Axis.vue` - 独立坐标轴组件

**来源**：
- `WaveformTrack.vue` → `rendering/WaveformTrack.vue`

---

### 4. Zoom System (缩放系统)

**职责**：管理缩放行为、变换状态

**文件**：
- `zoom/useZoom.ts` - 缩放组合式函数
  ```typescript
  export function useZoom(options: ZoomOptions) {
    const sharedTransform = shallowRef<ZoomTransform>(zoomIdentity)
    const independentTransforms = shallowRef<ZoomTransform[]>([])
    
    function configureZoom() { ... }
    function resetViewport() { ... }
    function handleSharedZoom(event: D3ZoomEvent) { ... }
    function handleIndependentZoom(event: D3ZoomEvent, trackIndex: number) { ... }
    
    return {
      sharedTransform,
      independentTransforms,
      configureZoom,
      resetViewport,
      handleSharedZoom,
      handleIndependentZoom,
    }
  }
  ```

- `zoom/types.ts` - 缩放相关类型
  ```typescript
  export interface ZoomOptions { ... }
  export interface ZoomState { ... }
  ```

**来源**：从 `WaveformChart.vue` 提取缩放相关逻辑

---

### 5. Interaction System (交互系统)

**职责**：处理用户交互（悬浮、点击、工具栏）

**文件**：
- `interaction/WaveformToolbar.vue` - 工具栏（已存在）
- `interaction/WaveformTooltip.vue` - 悬浮提示（已存在）

- `interaction/useInteraction.ts` - 交互管理
  ```typescript
  export function useInteraction(options: InteractionOptions) {
    const interactionMode = ref<WaveformInteractionMode>('zoom')
    
    function setInteractionMode(mode: WaveformInteractionMode) { ... }
    function handleOverlayClick(event: PointerEvent, trackIndex?: number) { ... }
    
    return {
      interactionMode,
      setInteractionMode,
      handleOverlayClick,
    }
  }
  ```

- `interaction/useHover.ts` - 悬浮逻辑
  ```typescript
  export function useHover(options: HoverOptions) {
    const hoveredSeriesPoints = ref<HoveredSeriesPoint[]>([])
    const hoveredTrackIndex = ref<number | null>(null)
    const hoverPosition = ref({ x: 0, y: 0 })
    
    function handlePointerMove(event: PointerEvent, trackIndex?: number) { ... }
    function clearHover() { ... }
    function nearestPoint(series: DisplaySeries, xValue: number) { ... }
    
    return {
      hoveredSeriesPoints,
      hoveredTrackIndex,
      hoverPosition,
      handlePointerMove,
      clearHover,
      nearestPoint,
    }
  }
  ```

- `interaction/types.ts` - 交互相关类型
  ```typescript
  export type WaveformInteractionMode = 'zoom' | 'select' | 'annotation' | ...
  export interface InteractionOptions { ... }
  export interface HoverOptions { ... }
  ```

**来源**：
- `WaveformToolbar.vue` → `interaction/WaveformToolbar.vue`
- `WaveformTooltip.vue` → `interaction/WaveformTooltip.vue`
- `WaveformChart.vue` 中的交互逻辑 → `interaction/useInteraction.ts` + `interaction/useHover.ts`

---

### 6. Annotation System (标注系统)

**职责**：管理标注和图形（创建、编辑、删除、渲染）

**文件**：
- `annotation/WaveformAnnotationLayer.vue` - 标注渲染层（已存在）
- `annotation/WaveformEditor.vue` - 标注编辑器（已存在）

- `annotation/useAnnotation.ts` - 标注管理逻辑
  ```typescript
  export function useAnnotation(options: AnnotationOptions) {
    const selection = ref<WaveformMarkupSelection>(null)
    const editingDraft = ref<EditingDraft | null>(null)
    const rangeDraft = ref<RangeDraft | null>(null)
    
    function createAnnotation(point: WaveformPoint, seriesId: string) { ... }
    function editAnnotation(id: string) { ... }
    function deleteAnnotation(id: string) { ... }
    function selectMarkup(kind: 'annotation' | 'shape', id: string) { ... }
    
    return {
      selection,
      editingDraft,
      rangeDraft,
      createAnnotation,
      editAnnotation,
      deleteAnnotation,
      selectMarkup,
    }
  }
  ```

- `annotation/markup.ts` - 标注工具函数
  ```typescript
  export function layoutAnnotationBox(...) { ... }
  export function resolveAnnotationStyle(...) { ... }
  export function resolveShapeStyle(...) { ... }
  export function normalizeRangeShape(...) { ... }
  ```

- `annotation/types.ts` - 标注相关类型
  ```typescript
  export interface WaveformAnnotation { ... }
  export interface WaveformShape { ... }
  export interface RenderedAnnotation { ... }
  export interface RenderedShape { ... }
  ```

**来源**：
- `WaveformAnnotationLayer.vue` → `annotation/WaveformAnnotationLayer.vue`
- `WaveformEditor.vue` → `annotation/WaveformEditor.vue`
- `waveform-markup.ts` → `annotation/markup.ts` + `annotation/types.ts`
- `WaveformChart.vue` 中的标注管理逻辑 → `annotation/useAnnotation.ts`

---

## 🔄 重构策略

### 阶段 1: 创建新目录结构（不破坏现有代码）

1. 创建新的目录结构
2. 复制现有文件到新位置
3. 不修改任何逻辑

### 阶段 2: 提取共享类型和常量

1. 创建 `core/types.ts` 和 `core/constants.ts`
2. 从各个文件中提取共享类型
3. 更新导入路径

### 阶段 3: 重构数据系统

1. 创建 `data/` 目录
2. 将 `waveform.ts` 拆分为 `data/types.ts` 和 `data/normalize.ts`
3. 从 `WaveformChart.vue` 提取布局计算逻辑到 `data/layout.ts`

### 阶段 4: 重构缩放系统

1. 创建 `zoom/useZoom.ts`
2. 从 `WaveformChart.vue` 提取缩放相关逻辑
3. 在主组件中使用组合式函数

### 阶段 5: 重构交互系统

1. 移动 `WaveformToolbar.vue` 和 `WaveformTooltip.vue` 到 `interaction/`
2. 创建 `interaction/useInteraction.ts` 和 `interaction/useHover.ts`
3. 从 `WaveformChart.vue` 提取交互逻辑

### 阶段 6: 重构标注系统

1. 移动 `WaveformAnnotationLayer.vue` 和 `WaveformEditor.vue` 到 `annotation/`
2. 将 `waveform-markup.ts` 拆分为 `annotation/markup.ts` 和 `annotation/types.ts`
3. 创建 `annotation/useAnnotation.ts`
4. 从 `WaveformChart.vue` 提取标注管理逻辑

### 阶段 7: 重构渲染系统

1. 移动 `WaveformTrack.vue` 到 `rendering/`
2. 更新所有导入路径

### 阶段 8: 更新主组件和公共导出

1. 简化 `WaveformChart.vue`，使用各系统的组合式函数
2. 更新 `components/index.ts` 导出
3. 确保向后兼容

### 阶段 9: 测试和验证

1. 运行所有测试
2. 验证功能完整性
3. 检查性能

---

## 📝 重构后的主组件结构

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'

// 数据系统
import { normalizeWaveformSeries, computeTrackLayouts } from './data'
import type { WaveformData, DisplayMode } from './data/types'

// 缩放系统
import { useZoom } from './zoom'

// 交互系统
import { useInteraction, useHover } from './interaction'
import WaveformToolbar from './interaction/WaveformToolbar.vue'
import WaveformTooltip from './interaction/WaveformTooltip.vue'

// 标注系统
import { useAnnotation } from './annotation'
import WaveformAnnotationLayer from './annotation/WaveformAnnotationLayer.vue'
import WaveformEditor from './annotation/WaveformEditor.vue'

// 渲染系统
import WaveformTrack from './rendering/WaveformTrack.vue'

// 核心
import { channelColors, margin } from './core/constants'

const props = defineProps<{
  data: WaveformData
  displayMode?: DisplayMode
  // ...
}>()

// 数据处理
const chartSeries = computed(() => normalizeWaveformSeries(props.data))
const trackLayouts = computed(() => computeTrackLayouts(chartSeries.value, ...))

// 缩放系统
const {
  sharedTransform,
  independentTransforms,
  configureZoom,
  resetViewport,
} = useZoom({ /* options */ })

// 交互系统
const { interactionMode, setInteractionMode } = useInteraction({ /* options */ })
const { hoveredSeriesPoints, handlePointerMove, clearHover } = useHover({ /* options */ })

// 标注系统
const {
  selection,
  editingDraft,
  createAnnotation,
  editAnnotation,
  deleteAnnotation,
} = useAnnotation({ /* options */ })

// 生命周期和监听
watch(() => props.data, resetViewport)
</script>

<template>
  <div class="waveform-chart">
    <svg>
      <!-- 轨道渲染 -->
      <WaveformTrack
        v-for="track in trackLayouts"
        :key="track.index"
        :track="track"
        @pointer-move="handlePointerMove($event, track.index)"
      />
      
      <!-- 标注层 -->
      <WaveformAnnotationLayer
        :annotations="renderedAnnotations"
        :shapes="renderedShapes"
      />
    </svg>
    
    <!-- 工具栏 -->
    <WaveformToolbar
      :interaction-mode="interactionMode"
      @update:interaction-mode="setInteractionMode"
    />
    
    <!-- 编辑器 -->
    <WaveformEditor
      v-if="editingDraft"
      :draft="editingDraft"
    />
    
    <!-- Tooltip -->
    <WaveformTooltip
      :visible="hoveredSeriesPoints.length > 0"
      :series-points="hoveredSeriesPoints"
    />
  </div>
</template>
```

---

## ✅ 收益

### 1. 可维护性 ⭐⭐⭐⭐⭐

- **按功能定位**：需要修改缩放功能？直接到 `zoom/` 目录
- **职责清晰**：每个系统有独立的目录和文件
- **减少耦合**：系统之间通过明确的接口通信

### 2. 可测试性 ⭐⭐⭐⭐⭐

- **独立测试**：每个系统可以独立测试
- **组合式函数**：易于单元测试，不需要挂载组件

```typescript
// 测试缩放系统
describe('useZoom', () => {
  it('should handle zoom transform', () => {
    const { sharedTransform, handleSharedZoom } = useZoom(options)
    // 测试逻辑
  })
})
```

### 3. 可扩展性 ⭐⭐⭐⭐⭐

- **添加新功能**：在对应系统目录下添加
- **替换实现**：可以替换整个系统而不影响其他部分
- **插件化**：各系统可以作为独立插件使用

### 4. 可理解性 ⭐⭐⭐⭐⭐

- **目录即文档**：从目录结构就能理解系统功能
- **代码组织**：相关代码放在一起，容易理解上下文
- **新人友好**：新开发者可以快速定位到相关代码

---

## ⚠️ 风险和注意事项

### 1. 大规模重构风险

**风险**：移动文件可能导致测试失败、功能损坏

**缓解措施**：
- 分阶段重构，每个阶段运行测试
- 保持向后兼容
- 使用 Git 分支，可以随时回滚

### 2. 导入路径变更

**风险**：大量文件的导入路径需要更新

**缓解措施**：
- 使用 IDE 的重构功能
- 在新目录的 `index.ts` 中保持导出一致
- 逐步迁移，保留旧路径的重导出

### 3. 类型依赖复杂

**风险**：类型定义分散后可能产生循环依赖

**缓解措施**：
- 明确类型依赖关系
- 共享类型放在 `core/types.ts`
- 避免系统之间直接依赖类型

### 4. 性能影响

**风险**：拆分可能影响打包体积和加载性能

**缓解措施**：
- 使用 Tree-shaking 优化
- 合理使用动态导入
- 监控打包体积变化

---

## 🎯 实施建议

### 渐进式重构

**推荐方案**：不是一次性重构所有内容，而是：

1. **先提取组合式函数**（最小影响）
   - 创建 `zoom/useZoom.ts`
   - 创建 `interaction/useHover.ts`
   - 创建 `annotation/useAnnotation.ts`
   - 在主组件中使用，不移动其他文件

2. **再按系统移动组件**（中等影响）
   - 移动 `WaveformToolbar.vue` 到 `interaction/`
   - 移动 `WaveformAnnotationLayer.vue` 到 `annotation/`
   - 更新导入路径

3. **最后重构类型定义**（最大影响）
   - 拆分 `waveform.ts` 和 `waveform-markup.ts`
   - 创建 `core/types.ts`
   - 更新所有类型导入

### 向后兼容

在 `components/index.ts` 保持原有导出：

```typescript
// 新的导出路径
export { default as WaveformChart } from './WaveformChart.vue'
export { default as WaveformToolbar } from './interaction/WaveformToolbar.vue'
export { default as WaveformTooltip } from './interaction/WaveformTooltip.vue'

// 类型导出
export type * from './core/types'
export type * from './data/types'
export type * from './annotation/types'
```

---

## 📅 预估时间

- **阶段 1-2**（目录结构 + 类型提取）：2-3 小时
- **阶段 3-4**（数据系统 + 缩放系统）：3-4 小时
- **阶段 5-6**（交互系统 + 标注系统）：3-4 小时
- **阶段 7-8**（渲染系统 + 主组件更新）：2-3 小时
- **阶段 9**（测试和验证）：1-2 小时

**总计**：11-16 小时

---

## 🤔 用户决策点

1. **是否采用组合式函数？**
   - ✅ 推荐：更易测试，逻辑复用
   - ❌ 备选：保持当前结构，只移动文件

2. **是否进一步拆分组件？**
   - 例如：将 `WaveformTrack` 拆分为 `Grid` + `Axis` + `Line`
   - ✅ 更细粒度，更灵活
   - ❌ 可能过度工程化

3. **是否一次性重构？**
   - ✅ 推荐：渐进式重构，每个阶段测试
   - ❌ 备选：一次性完成（风险较大）

4. **公共导出路径？**
   - 选项 A：`import { WaveformChart } from '@/components'`（保持现状）
   - 选项 B：`import { WaveformChart } from '@/components/WaveformChart.vue'`（显式路径）
   - 选项 C：系统级导出 `import { WaveformAnnotationLayer } from '@/components/annotation'`
