# Design

## Overview

识别并替换项目中所有 `any` 类型使用，提高类型安全性。

## Affected Files

1. `src/components/core/useWaveformPresentation.ts`
2. `src/components/core/xDomain.ts`
3. `src/components/interaction/WaveformTooltip.vue`
4. `src/types/chart.ts`

## Replacement Strategies

### Strategy 1: D3 类型

```typescript
// ❌ Before
const scale: any = scaleLinear()

// ✅ After
import type { ScaleLinear } from 'd3'
const scale: ScaleLinear<number, number> = scaleLinear()
```

### Strategy 2: 事件类型

```typescript
// ❌ Before
function handleEvent(event: any) {}

// ✅ After
import type { D3ZoomEvent } from 'd3'
function handleEvent(event: D3ZoomEvent<SVGElement, unknown>) {}
```

### Strategy 3: 未知结构

```typescript
// ❌ Before
const config: any = { ... }

// ✅ After - 选项1: 定义接口
interface Config {
  width: number
  height: number
}
const config: Config = { ... }

// ✅ After - 选项2: 使用 Record
const config: Record<string, unknown> = { ... }

// ✅ After - 选项3: 使用 unknown + 类型守卫
const config: unknown = { ... }
if (isConfig(config)) { /* ... */ }
```

### Strategy 4: 泛型参数

```typescript
// ❌ Before
function process<T = any>(value: T) {}

// ✅ After
function process<T = unknown>(value: T) {}
// 或
function process<T extends Record<string, unknown>>(value: T) {}
```

## Common D3 Types

```typescript
import type {
  ScaleLinear,
  ScaleTime,
  Selection,
  ZoomBehavior,
  ZoomTransform,
  D3ZoomEvent,
  Axis,
} from 'd3'

// 尺度
const xScale: ScaleLinear<number, number>
const timeScale: ScaleTime<number, number>

// 选择器
const selection: Selection<SVGGElement, unknown, null, undefined>

// 缩放
const zoom: ZoomBehavior<Element, unknown>
const transform: ZoomTransform
const event: D3ZoomEvent<SVGRectElement, unknown>

// 坐标轴
const xAxis: Axis<number | { valueOf(): number }>
```

## File-by-File Plan

### File 1: useWaveformPresentation.ts

可能的 `any` 使用场景：

- CSSProperties 类型
- 动态属性计算

**预期替换**:

```typescript
// 可能的问题
const style: any = { ... }

// 修复
import type { CSSProperties } from 'vue'
const style: CSSProperties = { ... }
```

### File 2: xDomain.ts

可能的 `any` 使用场景：

- D3 scale 类型
- 域计算函数

**预期替换**:

```typescript
import type { ScaleLinear } from 'd3'

// 修复 scale 类型
const scale: ScaleLinear<number, number> = scaleLinear()
```

### File 3: WaveformTooltip.vue

可能的 `any` 使用场景：

- 组件 props 类型
- 事件处理器参数

**预期替换**:

```typescript
// 修复 props
interface TooltipProps {
  position: { x: number; y: number }
  content: string
}

// 修复事件
function handleMouseEvent(event: MouseEvent) {}
```

### File 4: types/chart.ts

可能的 `any` 使用场景：

- 通用数据类型
- 联合类型的逃生舱

**预期替换**:

```typescript
// 如果是真正的"任意值"
type AnyValue = unknown

// 如果是对象
type AnyObject = Record<string, unknown>

// 如果是数组
type AnyArray = unknown[]
```

## ESLint Rules

可以添加规则防止未来引入 `any`：

```javascript
// eslint.config.js
rules: {
  '@typescript-eslint/no-explicit-any': 'error',
}
```

## Risks

### Risk: 某些 D3 API 类型复杂

**Mitigation**:

- 优先使用 D3 官方类型
- 必要时使用 `unknown` + 类型守卫
- 记录为何需要特定类型

### Risk: 第三方库类型缺失

**Mitigation**:

- 创建类型声明文件
- 使用 `@types/*` 包
- 最后手段：使用 `unknown` 而非 `any`

## Success Metrics

- [ ] 项目中无 `any` 类型（除非有注释说明原因）
- [ ] `pnpm typecheck` 通过
- [ ] ESLint 无警告
- [ ] 所有测试通过
