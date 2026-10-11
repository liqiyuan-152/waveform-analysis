# 修复 Props 类型转换问题

## Summary

`WaveformChart.vue` 中使用了类型断言将 props 转换为 `ResolvedWaveformChartProps`，这表明类型定义存在不匹配，需要修复。

## Background

在 `WaveformChart.vue:38` 中：

```typescript
const controller = useWaveformChartController(props as ResolvedWaveformChartProps, emit)
```

这个类型断言表明：

1. `withDefaults` 返回的类型与 `ResolvedWaveformChartProps` 不完全匹配
2. 可能存在可选属性未正确解析
3. 类型定义可能不够精确

类型断言绕过了 TypeScript 的类型检查，可能隐藏潜在问题。

## Goals

- 消除 `as ResolvedWaveformChartProps` 类型断言
- 修复 `WaveformChartProps` 和 `ResolvedWaveformChartProps` 之间的类型不匹配
- 确保类型安全，让 TypeScript 正确推断类型
- 改进类型定义的清晰度

## Non-goals

- 改变组件的运行时行为
- 重构整个 props 系统
- 修改公共 API

## Plan

### Phase 1: 诊断 (预计 1 小时)

1. 分析 `WaveformChartProps` 类型定义
2. 分析 `ResolvedWaveformChartProps` 类型定义
3. 找出不匹配的具体属性
4. 理解 `withDefaults` 的类型推断逻辑

### Phase 2: 设计解决方案 (预计 1 小时)

可能的方案：

1. **方案 A**：改进 `ResolvedWaveformChartProps` 定义，使其与 `withDefaults` 结果匹配
2. **方案 B**：创建辅助函数 `resolveProps()` 进行类型安全的转换
3. **方案 C**：使用泛型约束确保类型兼容

### Phase 3: 实现 (预计 2 小时)

1. 修改类型定义
2. 更新 `WaveformChart.vue`
3. 确保类型检查通过
4. 更新相关文档

### Phase 4: 验证 (预计 30 分钟)

1. `pnpm typecheck` 通过
2. 所有测试通过
3. 无新的类型错误或警告
4. IDE 类型提示正确

## Technical Details

### 当前类型定义位置

- `src/components/core/waveformChartTypes.ts` - Props 类型定义
- `src/components/WaveformChart.vue` - 组件定义和 defaults

### 常见问题模式

**问题 1: 函数类型默认值**

```typescript
// 问题：函数类型在 withDefaults 中需要用 () => 包裹
xDomainStrategy: () => ({ type: 'integer-ms' })

// ResolvedWaveformChartProps 应该将其解析为函数返回值类型
```

**问题 2: 可选属性处理**

```typescript
// WaveformChartProps 中的可选属性
frameNumber?: number

// 在 ResolvedWaveformChartProps 中可能仍是可选的
// 但使用时假设它总是存在
```

**问题 3: 数组和对象默认值**

```typescript
// 使用工厂函数
annotations: () => []

// 类型需要正确推断
```

## Risks

- 可能暴露之前未发现的类型不安全问题
- 可能需要修改多个文件
- 可能影响下游代码

## Success Criteria

- [ ] 移除 `as ResolvedWaveformChartProps` 类型断言
- [ ] `pnpm typecheck` 通过且无警告
- [ ] 所有测试通过
- [ ] IDE 类型提示准确
- [ ] 类型定义有清晰的文档说明
