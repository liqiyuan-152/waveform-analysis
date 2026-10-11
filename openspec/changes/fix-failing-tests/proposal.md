# 修复3个失败的单元测试

## Summary

测试覆盖率运行发现3个测试失败，需要立即修复以恢复 CI 健康状态。

## Background

当前测试套件有3个失败的测试用例：

1. **tests/demo/xAxisLabelControls.test.ts** - "configures numeric and timestamp labels from the sidebar" (失败耗时 11216ms)
2. **tests/components/waveformChartCases/annotationEditingAndReprojection.test.ts** - "edits and immediately deletes existing annotations without mutating props" (失败耗时 5436ms)
3. **tests/components/waveformChartCases/dataAndHoverPerformance.test.ts** - "keeps a 100k-point SVG path bounded by the plot width" (失败耗时 6492ms)

当前有未提交的修改可能导致了测试失败：

- `src/components/core/useWaveformPresentation.ts`
- `src/components/interaction/useWaveformZoom.ts`
- `tests/components/waveformChartCases/edgeCompactLayout.test.ts`
- `tests/components/waveformChartCases/zoomCustomerRegression.test.ts` (新增)

## Goals

- 诊断3个失败测试的根本原因
- 修复测试失败，确保所有测试通过
- 不破坏现有功能
- 确保修复后测试覆盖率收集正常运行

## Non-goals

- 重构测试代码结构
- 优化测试性能
- 添加新的测试用例

## Plan

### Phase 1: 诊断 (预计 30 分钟)

1. 单独运行每个失败的测试，收集详细错误信息
2. 检查最近修改的文件与失败测试的关联
3. 确定是代码问题还是测试问题

### Phase 2: 修复 (预计 1-2 小时)

1. 修复 xAxisLabelControls 测试
2. 修复 annotationEditingAndReprojection 测试
3. 修复 dataAndHoverPerformance 测试

### Phase 3: 验证 (预计 30 分钟)

1. 运行完整测试套件确认所有测试通过
2. 运行测试覆盖率收集确认无错误
3. 提交修复

## Risks

- 可能需要回滚部分正在进行的修改
- 性能测试可能存在环境相关的不稳定性

## Success Criteria

- [ ] 所有3个测试用例通过
- [ ] 完整测试套件通过（无新的失败）
- [ ] 测试覆盖率收集成功完成
- [ ] 修改已提交并通过 CI
