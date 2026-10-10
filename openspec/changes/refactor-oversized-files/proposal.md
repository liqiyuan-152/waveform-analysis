# 拆分超大文件以符合代码规范

## Summary

项目中有10+个文件超过了 ESLint 配置的 400 行限制，需要拆分以提高代码可维护性。

## Background

ESLint 配置了 `max-lines: 400` 规则，但以下核心文件超标：

- `src/core/workerSampling/repository.ts` (400行)
- `src/components/annotation/useWaveformChartAnnotations.ts` (397行) ⚠️ 无测试覆盖
- `src/components/core/useWaveformRenderSampling.ts` (395行)
- `src/core/waveformPointSource.ts` (395行)
- `src/components/core/useWaveformChartLifecycle.ts` (394行) ⚠️ 无测试覆盖
- `src/App.vue` (391行)
- `src/components/WaveformChartView.vue` (379行)
- `src/components/interaction/useWaveformZoom.ts` (376行)
- `src/components/core/layout.ts` (372行)
- `src/components/interaction/useWaveformViewport.ts` (358行)
- `src/components/core/useWaveformChartController.ts` (352行) ⚠️ 无测试覆盖

## Goals

- 将超过 400 行的源文件拆分为更小的模块
- 提高代码可读性和可维护性
- 保持功能完整性和类型安全
- 为后续添加单元测试做准备

## Non-goals

- 改变公共 API
- 优化性能
- 重写业务逻辑

## Plan

### Phase 1: 拆分 Controller 和 Lifecycle (高优先级)

**useWaveformChartController.ts (352行)**
- 提取 `useWaveformRefs.ts` - 元素引用管理
- 提取 `useWaveformState.ts` - 状态管理（transform、domain）
- 保留核心协调逻辑

**useWaveformChartLifecycle.ts (394行)**
- 提取 `useResizeObserver.ts` - 尺寸监听
- 提取 `useKeyboardInteraction.ts` - 键盘事件
- 提取 `usePageNavigation.ts` - 分页逻辑

### Phase 2: 拆分交互模块

**useWaveformZoom.ts (376行)**
- 提取 `useZoomState.ts` - 状态管理
- 提取 `useZoomThrottle.ts` - 节流逻辑
- 提取 `useSharedZoom.ts` - 共享缩放
- 提取 `useIndependentZoom.ts` - 独立缩放

**useWaveformViewport.ts (358行)**
- 提取 `useViewportSelection.ts` - 选区管理
- 提取 `useViewportDrag.ts` - 拖拽逻辑

### Phase 3: 拆分数据和渲染模块

**useWaveformChartAnnotations.ts (397行)**
- 提取 `useAnnotationEditor.ts` - 编辑器逻辑
- 提取 `useAnnotationContextMenu.ts` - 右键菜单
- 提取 `annotationCoordinates.ts` - 坐标转换

**repository.ts (400行)**
- 提取 `repositoryCache.ts` - 缓存逻辑
- 提取 `repositoryLifecycle.ts` - 生命周期管理

### Phase 4: 拆分视图组件

**WaveformChartView.vue (379行)**
- 拆分为多个子组件（坐标轴、网格、图例等）

**App.vue (391行)** - 低优先级
- 这是 Demo 应用，可以暂时保持

## Risks

- 拆分可能影响现有代码
- 循环依赖问题
- 需要大量测试验证

## Success Criteria

- [ ] 所有源文件符合 400 行限制
- [ ] 所有测试通过
- [ ] 类型检查通过
- [ ] 功能验证通过
- [ ] 代码审查通过
