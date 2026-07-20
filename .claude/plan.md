# WaveformChart 组件拆分计划

## 目标

将 `WaveformChart.vue`（1743 行）拆分为更小的、职责单一的子组件：

1. **WaveformTooltip.vue** - 悬浮提示组件
2. **WaveformTrack.vue** - 单个波形轨道组件
3. **WaveformAnnotationLayer.vue** - 标注层组件

## 当前代码分析

### 主组件职责（过多）

- ✅ 数据管理和状态协调
- ✅ 缩放和交互事件处理
- 🔴 渲染波形轨道（网格、轴、波形线、十字线）
- 🔴 渲染标注和图形
- 🔴 渲染悬浮提示
- ✅ 工具栏管理（已拆分）
- ✅ 编辑器管理（已拆分）

### 模板结构（1055-1743 行）

```vue
<div class="waveform-chart">
  <svg>
    <g transform="translate(margin)">
      <!-- 1. 轨道循环（100+ 行）包含：网格、轴、标签、波形线、十字线 -->
      <g v-for="track in trackLayouts">...</g>

      <!-- 2. 标注和图形层（135 行） -->
      <g class="waveform-chart__markup-layer">
        <g v-for="shape in renderedShapes">...</g>
        <g v-for="annotation in renderedAnnotations">...</g>
        <g v-for="preview in renderedRangePreview">...</g>
      </g>
    </g>
  </svg>

  <!-- 3. Tooltip（15 行） -->
  <div v-if="showTooltip && hoveredPoint" class="waveform-chart__tooltip">...</div>

  <!-- 4. 已拆分组件 -->
  <WaveformToolbar />
  <WaveformEditor />
</div>
```

## 拆分策略

### 组件 1: WaveformTooltip.vue (~80 行)

**职责**：显示鼠标悬浮时的数据点信息

**Props**：

```typescript
interface Props {
  visible: boolean
  position: { x: number; y: number }
  timeUnit: 's' | 'ms'
  hoveredPoint: WaveformPoint | null
  seriesPoints: Array<{
    trackIndex: number
    name: string
    color: string
    unit?: string
    point: WaveformPoint
  }>
}
```

**提取内容**：

- 模板：1463-1478 行（16 行）
- 样式：1682-1742 行（61 行）
- 计算属性：`tooltipStyle`（471-477 行）

---

### 组件 2: WaveformTrack.vue (~300 行)

**职责**：渲染单个波形轨道（网格、坐标轴、波形线、十字线、overlay）

**Props**：

```typescript
interface Props {
  track: TrackLayout
  clipPathId: string
  margin: { top: number; right: number; bottom: number; left: number }
  innerWidth: number
  showTooltip: boolean
  zoomable: boolean
  displayMode: WaveformDisplayMode
  activeInteractionMode: WaveformInteractionMode
  frameNumber?: string | number
  timeUnit: 's' | 'ms'
  hoveredPoint?: HoveredSeriesPoint // 用于显示十字线
}
```

**Emits**：

```typescript
interface Emits {
  (e: 'pointer-move', event: PointerEvent): void
  (e: 'pointer-leave'): void
  (e: 'pointer-down', event: PointerEvent): void
  (e: 'pointer-up', event: PointerEvent): void
  (e: 'pointer-cancel', event: PointerEvent): void
  (e: 'click', event: PointerEvent): void
}
```

**提取内容**：

- 模板：1099-1265 行（166 行）
- 相关函数：
  - `shouldShowYAxisLabel` (247-262)
  - `resolveYAxisLabel` (239-241)
  - `resolveFrameNumber` (804-810)
  - `crosshairX` (794-797)
  - `crosshairY` (799-802)
  - `trackHoverPoint` (790-792)
- 样式：部分轨道相关样式

**注意事项**：

- 轨道组件需要在父组件中接收 D3 渲染的坐标轴
- 或者在 `onMounted` 中自己调用 D3 渲染坐标轴

---

### 组件 3: WaveformAnnotationLayer.vue (~250 行)

**职责**：渲染所有标注和图形（annotations + shapes）

**Props**：

```typescript
interface Props {
  renderedAnnotations: RenderedAnnotation[]
  renderedShapes: RenderedShape[]
  renderedRangePreview: RenderedShape[]
  activeInteractionMode: WaveformInteractionMode
  selection: WaveformMarkupSelection
  innerWidth: number
  clipPathId: string
}
```

**Emits**：

```typescript
interface Emits {
  (e: 'select-markup', kind: 'annotation' | 'shape', id: string): void
  (e: 'edit-markup', kind: 'annotation' | 'shape', id: string): void
}
```

**提取内容**：

- 模板：1285-1419 行（135 行）
- 相关函数：
  - `isSelected` (491-493)
  - `safeDomId` (503-505)
  - `arrowMarkerId` (507-509)
  - `annotationBoxStyle` (511-518)
  - `shapeLabelWidth` (520-522)
  - `shapeLabelX` (524-531)
  - `shapeLabelStyle` (533-538)
- 样式：标注相关样式（1581-1660 行）

---

## 实施步骤

### 阶段 1: 创建 WaveformTooltip.vue ✅

1. 创建组件文件
2. 提取模板和样式
3. 实现计算属性 `tooltipStyle`
4. 更新主组件使用新组件

### 阶段 2: 创建 WaveformAnnotationLayer.vue ✅

1. 创建组件文件
2. 提取标注层模板
3. 提取相关工具函数
4. 提取样式
5. 更新主组件

### 阶段 3: 创建 WaveformTrack.vue ✅

1. 创建组件文件
2. 提取轨道渲染逻辑
3. 处理 D3 坐标轴渲染（使用 `ref` + `onMounted`）
4. 提取相关样式
5. 更新主组件

### 阶段 4: 验证和测试 ✅

1. 运行类型检查 `pnpm typecheck`
2. 运行代码规范检查 `pnpm lint`
3. 运行单元测试 `pnpm test`
4. 手动测试功能完整性

---

## 设计决策

### 1. 类型共享

将 `DisplaySeries`, `HoveredSeriesPoint`, `TrackLayout`, `RenderedAnnotation`, `RenderedShape` 等接口移到独立的类型文件中，供多个组件使用。

**创建** `src/components/waveform-chart-types.ts`

### 2. D3 渲染策略

对于 WaveformTrack 中的坐标轴渲染：

- **方案 A（推荐）**：在 Track 组件内部使用 `ref` + `onMounted` 调用 D3
- **方案 B**：父组件渲染后通知子组件
- **选择 A**：更符合组件封装原则

### 3. 事件冒泡

所有交互事件（click, pointer-move 等）通过 emit 向上传递，保持主组件的事件协调职责。

### 4. 样式隔离

每个组件使用 `<style scoped>`，但共享的样式变量可以提取到 CSS 变量中。

---

## 预期收益

### 代码规模

- **主组件**：1743 → ~1100 行（-37%）
- **新组件**：
  - WaveformTooltip: ~80 行
  - WaveformAnnotationLayer: ~250 行
  - WaveformTrack: ~300 行

### 可维护性

- 每个组件职责清晰
- 修改轨道渲染不影响标注层
- Tooltip 可独立测试和复用

### 可测试性

- 每个子组件可独立单元测试
- 减少主组件测试的复杂度

---

## 风险和注意事项

### 1. D3 上下文问题

坐标轴渲染依赖 D3 操作 DOM，需要确保 ref 正确传递和挂载时机。

**解决方案**：在 Track 组件中使用 `watch` 监听 `track` prop 变化，触发重新渲染。

### 2. 性能影响

拆分组件可能增加 Vue 的更新开销。

**解决方案**：

- 使用 `shallowRef` 存储 D3 对象
- 对于大数组（tracks, annotations），使用稳定的 `:key`
- 如有性能问题，可使用 `v-memo` 指令

### 3. 向后兼容

确保 props 和 emits 接口不变。

**验证方法**：运行现有的 24 个单元测试。

---

## 实施时间估算

- 阶段 1（Tooltip）：30 分钟
- 阶段 2（AnnotationLayer）：1 小时
- 阶段 3（Track）：1.5 小时
- 阶段 4（测试）：30 分钟

**总计**：约 3.5 小时
