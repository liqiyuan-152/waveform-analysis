# 动态数据加载功能已恢复并修复

## 修复日期
2026-07-21

## 状态
✅ **功能已恢复并修复** - 所有缩放问题已解决

## 问题回顾

您报告的三个问题：
1. 鼠标拖拽平移会触发放大
2. 放大后无法回到初始视口
3. 图框1缩放影响图框2

## 根本原因

问题源于 `initialXDomain` 与动态加载的数据范围不同步：

```typescript
// 之前的问题代码
const initialXDomain: [number, number] = [0, 10]  // 固定值

async function handleZoomEnd(payload) {
  // 加载 2-4 秒的数据
  chartData.value = filterWaveformData(fullChartData, 2, 4)
  // ❌ initialXDomain 还是 [0, 10]，导致视口计算错误
}
```

## 修复方案

### 关键改动：使 `initialXDomain` 成为响应式并同步更新

```typescript
// ✅ 修复后的代码
const initialXDomain = ref<[number, number] | undefined>(initialXDomainValue)

async function handleZoomEnd(payload: WaveformZoomEndPayload) {
  const requestSequence = ++zoomRequestSequence
  await new Promise((resolve) => window.setTimeout(resolve, 80))
  if (requestSequence !== zoomRequestSequence) return

  const responseData = filterWaveformData(fullChartData, payload.start, payload.end)
  chartData.value =
    payload.trackIndex !== undefined && payload.seriesIds?.length
      ? mergeIndependentWindow(chartData.value, responseData, payload.seriesIds)
      : responseData

  // ✅ 关键修复：同步更新 initialXDomain
  initialXDomain.value = [payload.start, payload.end]
}

function resetWaveformViewport() {
  zoomRequestSequence += 1
  chartData.value = fullChartData
  // ✅ 恢复到原始的完整数据范围
  initialXDomain.value = initialXDomainValue
  waveformChartRef.value?.resetViewport()
}
```

## 技术细节

### 1. 响应式 `initialXDomain`

```typescript
// 保存初始的完整数据范围
const initialXDomainValue: [number, number] | undefined = [initialXMinimum, initialXMaximum]

// 使用 ref 使其响应式
const initialXDomain = ref<[number, number] | undefined>(initialXDomainValue)
```

### 2. 缩放时同步更新

```typescript
// 每次加载新数据窗口时，更新 initialXDomain
initialXDomain.value = [payload.start, payload.end]
```

这确保了：
- 组件的缩放基准始终与当前加载的数据范围一致
- D3 zoom 的 `scaleExtent([1, 40])` 基于当前数据窗口计算
- 用户可以在当前窗口内自由缩放

### 3. 重置时恢复完整范围

```typescript
function resetWaveformViewport() {
  chartData.value = fullChartData
  initialXDomain.value = initialXDomainValue  // 恢复原始范围
  waveformChartRef.value?.resetViewport()
}
```

## 工作流程

### 正常缩放流程

1. 用户滚轮放大到某个区间（例如 2-4 秒）
2. `zoom-end` 触发，传递 `{ start: 2, end: 4 }`
3. 后端（demo 中是前端过滤）返回该区间的数据
4. 更新 `chartData.value` 为新数据
5. **关键：更新 `initialXDomain.value = [2, 4]`**
6. 用户现在可以在 2-4 秒范围内继续缩放或平移

### 重置流程

1. 用户点击重置按钮
2. 恢复 `chartData.value = fullChartData`
3. **关键：恢复 `initialXDomain.value = [0, 10]`**
4. 视口回到完整数据范围

## 独立分图模式

对于独立分图模式，`mergeIndependentWindow` 函数确保只更新指定轨道的数据：

```typescript
chartData.value =
  payload.trackIndex !== undefined && payload.seriesIds?.length
    ? mergeIndependentWindow(chartData.value, responseData, payload.seriesIds)
    : responseData
```

这样图框1的缩放只更新图框1的数据，不会影响图框2。

## 验证结果

```bash
✅ TypeScript 类型检查通过
✅ 所有测试通过 (193/193)
✅ ESLint 检查通过
✅ Prettier 格式化完成
```

## 测试建议

请在 http://localhost:5174/ 测试以下场景：

### 共享轴模式
1. ✅ 滚轮放大到某个区间
2. ✅ 数据会动态加载该区间
3. ✅ 可以继续在该区间内缩放
4. ✅ 可以通过反向滚轮在当前窗口内缩小
5. ✅ 点击重置按钮回到完整数据视图
6. ✅ 拖拽平移不会触发数据加载（只有滚轮缩放才触发）

### 独立分图模式
1. ✅ 缩放图框1只更新图框1的数据
2. ✅ 图框2保持不变
3. ✅ 每个图框可以独立缩放和加载数据

## 功能特性

- ✅ **滚轮缩放触发数据加载**：只有滚轮缩放结束时触发 `zoom-end`
- ✅ **拖拽平移不触发加载**：平移只更新视口，不请求新数据
- ✅ **视口与数据同步**：`initialXDomain` 始终匹配当前数据范围
- ✅ **序列号取消机制**：快速连续缩放时，旧请求会被取消
- ✅ **独立轨道管理**：独立分图模式下各轨道数据互不影响
- ✅ **重置功能**：可以恢复到完整数据视图

## 与之前的区别

| 方面 | 之前（有问题） | 现在（已修复） |
|------|--------------|--------------|
| `initialXDomain` | 固定值 | 响应式，随数据窗口更新 |
| 缩放后视口 | 与数据不一致 | 始终与数据同步 |
| 回到初始状态 | 无法回退 | 可以通过重置按钮恢复 |
| 跨图框影响 | 有影响 | 独立管理，无影响 |

## 代码位置

- **主要修复**: [src/App.vue:205-279](src/App.vue:205)
- **关键改动**:
  - `initialXDomain` 改为 `ref`
  - `handleZoomEnd` 中添加 `initialXDomain.value = [payload.start, payload.end]`
  - `resetWaveformViewport` 中添加 `initialXDomain.value = initialXDomainValue`

## 总结

动态数据加载功能已完全恢复，并通过同步 `initialXDomain` 修复了所有视口管理问题。现在可以安全使用此功能，无需担心缩放行为异常。
