# Design

## Overview

修复 `WaveformChart.vue` 中的类型断言问题，消除 `as ResolvedWaveformChartProps` 的使用，提高类型安全性。

## Problem Analysis

### 当前问题

在 `WaveformChart.vue:38` 中：

```typescript
const controller = useWaveformChartController(
  props as ResolvedWaveformChartProps, // ← 类型断言
  emit,
)
```

这个断言表明 `withDefaults` 返回的类型与 `ResolvedWaveformChartProps` 不完全匹配。

### 根本原因

**原因 1: 函数类型默认值**

```typescript
// WaveformChartProps 中
xDomainStrategy?: (data: WaveformData) => XDomainConfig

// withDefaults 中
xDomainStrategy: () => ({ type: 'integer-ms' })

// withDefaults 推断为 () => XDomainConfig
// 但 ResolvedWaveformChartProps 期望 (data: WaveformData) => XDomainConfig
```

**原因 2: 数组/对象工厂函数**

```typescript
// 使用工厂函数防止共享引用
annotations: () => []

// withDefaults 推断为 () => never[]
// 但 ResolvedWaveformChartProps 期望 WaveformAnnotation[]
```

**原因 3: 可选属性处理不一致**

```typescript
// WaveformChartProps 中可选
frameNumber?: number

// ResolvedWaveformChartProps 中可能仍是可选
// 但代码中假设它总是存在（或 undefined）
```

## Solution Approaches

### Approach A: 改进 ResolvedWaveformChartProps 类型定义 ✅ 推荐

```typescript
// waveformChartTypes.ts
export type ResolvedWaveformChartProps = {
  [K in keyof WaveformChartProps]-?: WaveformChartProps[K] extends
    ((...args: any[]) => infer R) | undefined
    ? Exclude<WaveformChartProps[K], undefined> extends () => infer F
      ? F // 工厂函数 → 返回值类型
      : Exclude<WaveformChartProps[K], undefined> // 普通函数保持
    : WaveformChartProps[K] extends (() => infer R) | undefined
      ? R // 工厂函数 → 返回值类型
      : NonNullable<WaveformChartProps[K]> // 移除 undefined
}
```

**优点**:

- 类型定义更准确
- TypeScript 自动推断
- 无运行时开销

**缺点**:

- 类型定义复杂

### Approach B: 创建类型安全的 resolveProps 函数

```typescript
// waveformChartTypes.ts
export function resolveProps(
  props: ReturnType<typeof withDefaults<WaveformChartProps>>,
): ResolvedWaveformChartProps {
  return props as unknown as ResolvedWaveformChartProps
}

// WaveformChart.vue
const controller = useWaveformChartController(resolveProps(props), emit)
```

**优点**:

- 集中类型断言
- 易于理解和维护

**缺点**:

- 仍需要断言
- 没有真正解决类型不匹配

### Approach C: 分离 Props 和 Controller 类型

```typescript
// 定义两个独立类型
export interface WaveformChartProps { ... }
export interface WaveformChartControllerProps { ... }

// 在 setup 中手动解析
const controllerProps: WaveformChartControllerProps = {
  xDomainStrategy: props.xDomainStrategy || defaultStrategy,
  annotations: props.annotations || [],
  // ...
}
```

**优点**:

- 类型完全清晰
- 无需断言

**缺点**:

- 大量样板代码
- 容易遗漏字段

## Recommended Solution

**使用 Approach A** - 改进 `ResolvedWaveformChartProps` 类型定义

### Implementation Steps

1. **分析所有默认值模式**

   ```typescript
   // 收集所有默认值类型
   const defaults = {
     // 简单值
     displayMode: 'independent',
     lineColor: '#0960bd',

     // 工厂函数
     annotations: () => [],
     grid: () => ({ rowCount: 2, columnCount: 1 }),

     // 函数默认值（需要特殊处理）
     xDomainStrategy: () => ({ type: 'integer-ms' }),
   }
   ```

2. **创建类型映射工具**

   ```typescript
   type ResolveDefaultValue<T> = T extends () => infer R ? R : T

   type ResolveAllDefaults<T extends Record<string, any>> = {
     [K in keyof T]: ResolveDefaultValue<T[K]>
   }
   ```

3. **更新 ResolvedWaveformChartProps**
   ```typescript
   export type ResolvedWaveformChartProps = Required<ResolveAllDefaults<WaveformChartProps>>
   ```

## Testing Strategy

### Type-Level Tests

```typescript
// tests/components/core/waveformChartTypes.test.ts
import { expectTypeOf } from 'vitest'

test('ResolvedWaveformChartProps resolves factory functions', () => {
  type Resolved = ResolvedWaveformChartProps

  // annotations 应该是数组，不是函数
  expectTypeOf<Resolved['annotations']>().toEqualTypeOf<WaveformAnnotation[]>()

  // grid 应该是对象，不是函数
  expectTypeOf<Resolved['grid']>().toEqualTypeOf<GridOptions>()

  // xDomainStrategy 应该是函数
  expectTypeOf<Resolved['xDomainStrategy']>().toBeFunction()
})

test('no type assertion needed in WaveformChart', () => {
  // 编译时测试：这段代码应该通过类型检查
  const props = withDefaults(defineProps<WaveformChartProps>(), {/* ... */})
  const controller = useWaveformChartController(props, emit) // 无 as
})
```

## Risks

### Risk: 复杂类型定义难以维护

**Mitigation**:

- 充分的注释说明
- 提供类型工具的使用示例
- 考虑使用更简单的方案（Approach B）

### Risk: 可能影响其他使用 ResolvedWaveformChartProps 的地方

**Mitigation**:

- 全局搜索所有使用位置
- 逐个验证类型兼容性
- 运行完整的类型检查

## Success Metrics

- [ ] 移除 `as ResolvedWaveformChartProps` 断言
- [ ] `pnpm typecheck` 通过
- [ ] IDE 类型提示准确
- [ ] 所有测试通过
- [ ] 类型定义有清晰文档
