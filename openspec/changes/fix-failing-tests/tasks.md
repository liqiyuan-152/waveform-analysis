# Tasks

## Task 1: 诊断失败原因

- [ ] 单独运行 `tests/demo/xAxisLabelControls.test.ts` 收集错误日志
- [ ] 单独运行 `tests/components/waveformChartCases/annotationEditingAndReprojection.test.ts` 收集错误日志
- [ ] 单独运行 `tests/components/waveformChartCases/dataAndHoverPerformance.test.ts` 收集错误日志
- [ ] 检查最近修改的文件：`useWaveformPresentation.ts` 和 `useWaveformZoom.ts`
- [ ] 确定失败是由代码更改还是测试本身导致

## Task 2: 修复 xAxisLabelControls 测试

- [ ] 分析测试失败的具体断言
- [ ] 检查侧边栏控件逻辑是否被破坏
- [ ] 修复代码或更新测试断言
- [ ] 验证测试通过

## Task 3: 修复 annotationEditingAndReprojection 测试

- [ ] 分析注解编辑和删除的不可变性检查
- [ ] 检查是否意外修改了 props 数组
- [ ] 修复注解 CRUD 逻辑
- [ ] 验证测试通过

## Task 4: 修复 dataAndHoverPerformance 测试

- [ ] 分析 SVG path 边界检查逻辑
- [ ] 检查 100k 点渲染是否正确裁剪
- [ ] 修复路径生成或裁剪逻辑
- [ ] 验证测试通过

## Task 5: 全面验证

- [ ] 运行完整测试套件：`pnpm test`
- [ ] 运行测试覆盖率：`pnpm test:coverage`
- [ ] 确保覆盖率收集目录不被删除
- [ ] 提交修复并标记问题已解决
