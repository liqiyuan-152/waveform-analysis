# Tasks

## Task 1: 拆分 useWaveformChartController (352行)

- [ ] 提取 `useWaveformRefs.ts` - 元素引用管理（~50行）
- [ ] 提取 `useWaveformState.ts` - 状态声明（~80行）
- [ ] 重构主文件，保留协调逻辑（~220行）
- [ ] 更新导入和类型导出
- [ ] 运行测试验证功能

## Task 2: 拆分 useWaveformChartLifecycle (394行)

- [ ] 提取 `useResizeObserver.ts` - 尺寸监听（~80行）
- [ ] 提取 `useKeyboardInteraction.ts` - 键盘事件（~60行）
- [ ] 提取 `usePageNavigation.ts` - 分页逻辑（~50行）
- [ ] 重构主文件，保留生命周期协调（~200行）
- [ ] 更新导入和类型导出
- [ ] 运行测试验证功能

## Task 3: 拆分 useWaveformZoom (376行)

- [ ] 提取 `useZoomState.ts` - 状态管理（~60行）
- [ ] 提取 `useZoomThrottle.ts` - 节流逻辑（~40行）
- [ ] 提取 `useSharedZoom.ts` - 共享缩放处理（~100行）
- [ ] 提取 `useIndependentZoom.ts` - 独立缩放处理（~100行）
- [ ] 重构主文件，保留协调逻辑（~150行）
- [ ] 更新导入和类型导出
- [ ] 运行测试验证功能

## Task 4: 拆分 useWaveformViewport (358行)

- [ ] 提取 `useViewportSelection.ts` - 选区管理（~80行）
- [ ] 提取 `useViewportDrag.ts` - 拖拽逻辑（~100行）
- [ ] 重构主文件（~180行）
- [ ] 更新导入和类型导出
- [ ] 运行测试验证功能

## Task 5: 拆分 useWaveformChartAnnotations (397行)

- [ ] 提取 `useAnnotationEditor.ts` - 编辑器状态管理（~120行）
- [ ] 提取 `useAnnotationContextMenu.ts` - 右键菜单（~80行）
- [ ] 提取 `annotationCoordinates.ts` - 坐标转换工具（~60行）
- [ ] 重构主文件（~140行）
- [ ] 更新导入和类型导出
- [ ] 运行测试验证功能

## Task 6: 拆分其他大文件

- [ ] 拆分 `repository.ts` (400行) → `repositoryCache.ts` + `repositoryLifecycle.ts`
- [ ] 拆分 `useWaveformRenderSampling.ts` (395行)
- [ ] 拆分 `waveformPointSource.ts` (395行)
- [ ] 拆分 `layout.ts` (372行)

## Task 7: 视图组件优化

- [ ] 分析 `WaveformChartView.vue` (379行)，提取子组件
- [ ] 分析 `App.vue` (391行) - Demo 应用，低优先级

## Task 8: 验证和文档

- [ ] 运行完整测试套件：`pnpm test`
- [ ] 运行类型检查：`pnpm typecheck`
- [ ] 运行 ESLint：`pnpm lint`
- [ ] 验证所有文件 ≤ 400 行
- [ ] 更新架构文档
- [ ] 代码审查
