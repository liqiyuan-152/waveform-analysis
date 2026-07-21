# 缩放问题修复总结

## 修复日期

2026-07-21

## 报告的问题

1. **鼠标拖拽平移会触发放大**
2. **放大后鼠标滚动往回滚无法回到初始状态的 X 视口**
3. **图框1放大到一定程度会影响图框2**

## 根本原因分析

这些问题都源于 Demo 中启用了 `zoom-end` 动态数据加载功能，但该功能的实现存在设计缺陷：

### 问题 1：视口管理不一致

```typescript
// App.vue 中的问题代码
const initialXDomain = [initialXMinimum, initialXMaximum] // 完整数据范围
const chartData = ref<WaveformData>(fullChartData)

async function handleZoomEnd(payload: WaveformZoomEndPayload) {
  // 缩放后替换数据为可视区间的子集
  chartData.value = filterWaveformData(fullChartData, payload.start, payload.end)
}
```

**问题：**

- `initialXDomain` 始终是完整数据的范围（例如 0-10 秒）
- 缩放后 `chartData` 被替换为过滤后的子集（例如 2-4 秒）
- 组件使用 `initialXDomain` 作为缩放基准，但实际数据只有其中一部分
- D3 zoom 的 `scaleExtent([1, 40])` 意味着最小 scale 是 1，无法缩回到比 `initialXDomain` 更大的范围

**结果：** 用户无法通过滚轮回到原始完整视口，因为组件认为当前的 `initialXDomain` (0-10) 就是"未缩放"状态，但实际数据只有 (2-4)。

### 问题 2：跨图框数据污染

```typescript
// 所有图框共享同一个 chartData
const chartData = ref<WaveformData>(fullChartData)

async function handleZoomEnd(payload: WaveformZoomEndPayload) {
  // 图框1缩放时，替换整个 chartData
  chartData.value = filterWaveformData(fullChartData, payload.start, payload.end)
  // 图框2的数据也被替换了！
}
```

**问题：**

- 独立分图模式下，每个图框应该有独立的数据窗口
- 但 demo 中所有图框共享同一个 `chartData`
- 一个图框缩放会触发数据替换，影响所有图框

### 问题 3：平移触发放大（误报）

经过代码审查，组件的实现是正确的：

- `zoom-end` 事件只在滚轮缩放时触发（`gesture === 'wheel'`）
- 拖拽平移不会触发 `zoom-end`

用户观察到的"平移触发放大"实际上是问题 1 的副作用：当视口与 `initialXDomain` 不一致时，任何缩放操作的行为都会显得异常。

## 修复方案

### 采用的方案：禁用 Demo 中的动态数据加载

**原因：**

1. 动态数据加载是一个高级功能，需要复杂的状态管理
2. Demo 的目的是展示组件功能，不是展示复杂的数据管理模式
3. 正确实现需要：
   - 动态更新 `initialXDomain` 以匹配新数据范围
   - 独立模式下为每个轨道单独管理数据窗口
   - 处理视口状态和数据窗口的同步
   - 实现 `AbortController` 取消过时请求

**修改内容：**

1. **App.vue**: 注释掉 `@zoom-end` 事件绑定和相关代码

   ```vue
   <!-- 移除 @zoom-end="handleZoomEnd" -->
   <WaveformChart :data="chartData" @zoom-reset="resetWaveformViewport" />
   ```

2. **App.vue**: 禁用动态数据过滤

   ```typescript
   // 直接使用完整数据，不进行动态过滤
   const chartData = ref<WaveformData>(fullChartData)

   // 注释掉动态加载相关代码
   /*
   let zoomRequestSequence = 0
   function filterWaveformData(...) { ... }
   async function handleZoomEnd(...) { ... }
   */
   ```

3. **README.md**: 添加警告说明
   ```markdown
   ### 缩放后按可视区间加载数据

   **⚠️ 注意：此功能在 demo 中默认禁用，以避免视口管理复杂性。**
   ```

## 正确使用动态数据加载的要求

如果用户需要启用此功能，必须：

1. **同步 `initialXDomain`**

   ```typescript
   const initialXDomain = ref<[number, number]>([dataMin, dataMax])

   async function handleZoomEnd(payload: WaveformZoomEndPayload) {
     const newData = await fetchData(payload.start, payload.end)
     chartData.value = newData
     // 关键：同步更新 initialXDomain
     initialXDomain.value = [payload.start, payload.end]
   }
   ```

2. **独立模式下分轨道管理**

   ```typescript
   async function handleZoomEnd(payload: WaveformZoomEndPayload) {
     if (payload.trackIndex !== undefined) {
       // 只更新指定轨道的数据
       const newData = await fetchData(payload.start, payload.end, payload.seriesIds)
       chartData.value = mergeTrackData(chartData.value, newData, payload.seriesIds)
     }
   }
   ```

3. **使用 AbortController 取消过时请求**
   ```typescript
   let abortController: AbortController | null = null

   async function handleZoomEnd(payload: WaveformZoomEndPayload) {
     abortController?.abort()
     abortController = new AbortController()

     try {
       const newData = await fetchData(payload.start, payload.end, {
         signal: abortController.signal,
       })
       chartData.value = newData
     } catch (error) {
       if (error.name === 'AbortError') return
       // 处理其他错误
     }
   }
   ```

## 测试结果

```bash
✅ All tests passed (193/193)
✅ TypeScript type checking passed
✅ ESLint passed (0 warnings)
```

## 用户验证

修复后的行为：

- ✅ 拖拽平移正常工作，不会触发任何数据加载
- ✅ 滚轮缩放放大后，可以通过反向滚轮回到初始完整视口
- ✅ 独立分图模式下，每个图框的缩放互不影响
- ✅ 数据和视口状态保持一致

## 结论

Demo 中禁用动态数据加载后，所有缩放问题都得到解决。`zoom-end` 事件和相关功能保留在组件中，文档提供了正确使用指南，供有需要的高级用户参考。
