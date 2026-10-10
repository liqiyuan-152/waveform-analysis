# 为核心 Composables 添加单元测试

## Summary

多个核心 composable 函数缺少单元测试覆盖，需要添加测试以提高代码质量和可维护性。

## Background

CodeGraph 分析显示以下核心组件**没有测试覆盖**：
- `useWaveformChartController` - 核心控制器，协调所有子模块
- `useWaveformChartLifecycle` - 生命周期管理
- `ResolvedWaveformChartProps` - 核心类型定义
- `useWaveformChartAnnotations` - 注解管理

这些是项目的核心逻辑，缺少测试会导致：
- 重构风险高
- 难以发现回归问题
- 新人难以理解代码行为

虽然项目有 86 个测试文件，但主要是集成测试，缺少单元测试。

## Goals

- 为 4 个核心 composables 添加单元测试
- 达到 80%+ 的代码覆盖率
- 建立 composable 单元测试模式供后续参考
- 提高代码质量和重构信心

## Non-goals

- 重写集成测试
- 达到 100% 覆盖率
- 测试私有函数

## Plan

### Phase 1: 设置测试基础设施 (预计 1 小时)
1. 创建 `tests/components/core/` 目录结构
2. 设置 composable 测试的通用 mock 和 helper
3. 参考现有测试模式

### Phase 2: 测试 useWaveformChartController (预计 3 小时)
创建 `tests/components/core/useWaveformChartController.test.ts`

测试场景：
- 初始化状态正确
- 元素引用绑定正常
- 子 composable 正确集成
- 响应式更新正确触发
- 清理函数正确执行

### Phase 3: 测试 useWaveformChartLifecycle (预计 2 小时)
创建 `tests/components/core/useWaveformChartLifecycle.test.ts`

测试场景：
- ResizeObserver 正确监听
- 键盘事件正确处理
- 分页导航正确
- 数据变化时正确清理和重新初始化

### Phase 4: 测试 useWaveformChartAnnotations (预计 3 小时)
创建 `tests/components/annotation/useWaveformChartAnnotations.test.ts`

测试场景：
- 注解创建、编辑、删除
- 右键菜单交互
- 坐标转换正确性
- 系列选择器更新
- 不可变性保证（不修改 props）

### Phase 5: 类型测试 (预计 1 小时)
创建 `tests/components/core/waveformChartTypes.test.ts`

测试场景：
- ResolvedWaveformChartProps 默认值正确
- 类型转换不丢失信息
- 可选属性处理正确

## Testing Strategy

### Composable 测试模式
```typescript
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'

// 创建测试宿主组件
const TestHost = defineComponent({
  setup() {
    const result = useWaveformChartController(/* ... */)
    return { result }
  },
  template: '<div></div>',
})

// 挂载并测试
const wrapper = mount(TestHost)
expect(wrapper.vm.result.chartWidth.value).toBe(800)
```

### Mock 策略
- Mock D3 选择器和行为
- Mock ResizeObserver
- Mock DOM 元素引用
- 使用测试数据工厂

## Risks

- Composable 高度耦合，难以单独测试
- 可能需要重构以提高可测试性
- Mock 设置复杂

## Success Criteria

- [ ] 4 个核心 composables 有单元测试
- [ ] 测试覆盖率达到 80%+
- [ ] 所有测试通过
- [ ] 测试运行时间 < 10 秒（单元测试应该快速）
- [ ] 文档说明如何测试 composables
