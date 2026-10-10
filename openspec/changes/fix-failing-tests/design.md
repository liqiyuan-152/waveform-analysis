# Design

## Overview

修复3个失败的测试用例，恢复 CI 健康状态。

## Root Cause Analysis

### 可能的原因
1. **最近的代码修改**：`useWaveformPresentation.ts` 和 `useWaveformZoom.ts` 的修改可能影响了测试
2. **测试环境问题**：测试覆盖率收集时目录被删除的错误
3. **时序问题**：某些测试可能依赖特定的异步时序

### 诊断策略
- 使用 `pnpm test <file>` 单独运行每个测试
- 添加 `--reporter=verbose` 获取详细输出
- 使用 git diff 对比最近的修改

## Fix Approaches

### For xAxisLabelControls.test.ts
- 检查 Demo 控制面板的 X 轴标签配置逻辑
- 验证时间戳和数值格式化是否正确
- 可能需要更新 mock 或快照

### For annotationEditingAndReprojection.test.ts
- 验证注解编辑时是否使用了不可变更新模式
- 检查 `v-model:annotations` 的实现
- 确保 emit 的是新数组而不是修改原数组

### For dataAndHoverPerformance.test.ts
- 检查大数据集的 SVG path 生成逻辑
- 验证裁剪路径是否正确应用
- 可能需要调整性能测试的阈值

## Testing Strategy

```bash
# 诊断命令
pnpm test tests/demo/xAxisLabelControls.test.ts --reporter=verbose
pnpm test tests/components/waveformChartCases/annotationEditingAndReprojection.test.ts --reporter=verbose
pnpm test tests/components/waveformChartCases/dataAndHoverPerformance.test.ts --reporter=verbose

# 完整验证
pnpm test
pnpm test:coverage
```

## Rollback Plan

如果修复困难，考虑：
1. 暂时回滚 `useWaveformPresentation.ts` 和 `useWaveformZoom.ts` 的修改
2. 将问题测试标记为 `test.skip()` 并创建 issue 追踪
3. 优先保持主分支的 CI 健康

## Success Metrics

- 所有测试通过
- 测试覆盖率收集成功
- 无回归问题引入
