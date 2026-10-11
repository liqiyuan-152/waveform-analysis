# Design

## Overview

将超过 400 行的文件拆分为更小的模块，符合 ESLint 规范并提高可维护性。

## Principles

### 1. Single Responsibility

每个模块应只负责一个明确的职责。

### 2. Composable Pattern

拆分后的模块仍应遵循 Vue Composable 模式：

```typescript
export function useFeature(context) {
  // 状态
  const state = ref()

  // 计算属性
  const derived = computed(() => ...)

  // 方法
  function action() { }

  // 生命周期
  onMounted(() => { })

  // 返回公共 API
  return { state, derived, action }
}
```

### 3. Minimal Breaking Changes

- 保持公共 API 不变
- 内部重构对外部透明
- 类型导出保持兼容

## Refactoring Strategy

### Strategy A: Extract Sub-Composables

适用于：有明确子功能的 composable

```typescript
// Before: useWaveformZoom.ts (376行)
export function useWaveformZoom(context) {
  // 所有逻辑混在一起
}

// After: useWaveformZoom.ts (150行)
import { useZoomState } from './useZoomState'
import { useSharedZoom } from './useSharedZoom'
import { useIndependentZoom } from './useIndependentZoom'

export function useWaveformZoom(context) {
  const state = useZoomState()
  const shared = useSharedZoom(context, state)
  const independent = useIndependentZoom(context, state)
  return { ...shared, ...independent }
}
```

### Strategy B: Extract Utilities

适用于：包含纯函数工具的文件

```typescript
// Extract from useWaveformChartAnnotations.ts
// To: annotationCoordinates.ts
export function screenToDataCoordinates(
  screenX: number,
  screenY: number,
  scale: ScaleLinear,
): { x: number; y: number } {
  return {
    x: scale.x.invert(screenX),
    y: scale.y.invert(screenY),
  }
}
```

### Strategy C: Split by Responsibility

适用于：管理多个独立关注点的文件

```typescript
// useWaveformChartLifecycle.ts 拆分为：
// - useResizeObserver.ts (DOM 尺寸监听)
// - useKeyboardInteraction.ts (键盘事件)
// - usePageNavigation.ts (分页)
// - useWaveformChartLifecycle.ts (协调以上三者)
```

## File Size Target

| Priority   | Target Lines | Action   |
| ---------- | ------------ | -------- |
| Must Fix   | > 400        | 立即拆分 |
| Should Fix | 350-400      | 考虑拆分 |
| OK         | < 350        | 保持现状 |

## Refactoring Examples

### Example 1: useWaveformChartController

**Before** (352行):

```typescript
export function useWaveformChartController(props, emit) {
  // 20+ ref 声明
  const container = ref()
  const svgElement = ref()
  // ...

  // 多个 composable 调用
  const presentation = useWaveformPresentation(...)
  const layout = useWaveformLayout(...)
  // ...

  // 返回大对象
  return reactive({ ...50+ properties })
}
```

**After** (220行):

```typescript
// useWaveformRefs.ts (50行)
export function useWaveformRefs() {
  return {
    container: ref(),
    svgElement: ref(),
    // ...
  }
}

// useWaveformState.ts (80行)
export function useWaveformState(props) {
  return {
    sharedTransform: shallowRef(),
    independentTransforms: shallowRef([]),
    // ...
  }
}

// useWaveformChartController.ts (220行)
export function useWaveformChartController(props, emit) {
  const refs = useWaveformRefs()
  const state = useWaveformState(props)

  const presentation = useWaveformPresentation({ props, ...refs })
  const layout = useWaveformLayout({ props, ...state })
  // ...

  return reactive({ ...refs, ...state, ...presentation, ...layout })
}
```

### Example 2: useWaveformZoom

**拆分结构**:

```
src/components/interaction/
├── useWaveformZoom.ts (150行) - 主协调器
├── zoom/
│   ├── useZoomState.ts (60行) - 状态管理
│   ├── useZoomThrottle.ts (40行) - 节流
│   ├── useSharedZoom.ts (100行) - 共享缩放
│   └── useIndependentZoom.ts (100行) - 独立缩放
```

## Testing Strategy

### Before Refactoring

1. 确保现有测试通过
2. 记录当前测试覆盖率

### During Refactoring

1. 每次拆分后运行测试
2. 使用 `pnpm typecheck` 验证类型
3. 使用 `pnpm lint` 验证代码规范

### After Refactoring

1. 测试覆盖率不应降低
2. 所有测试应通过
3. 类型检查应通过
4. ESLint 应通过（无 max-lines 错误）

## Risks

### Risk: 循环依赖

**Mitigation**:

- 使用依赖注入模式
- 保持单向依赖流
- 使用 madge 工具检测循环依赖

### Risk: 性能影响

**Mitigation**:

- 拆分不影响运行时性能（只是模块组织）
- 使用 Vite 的 tree-shaking
- 监控打包体积

### Risk: 破坏现有代码

**Mitigation**:

- 保持公共 API 不变
- 渐进式重构
- 充分的测试覆盖

## Success Metrics

- [ ] 所有源文件 ≤ 400 行
- [ ] ESLint 无 max-lines 错误
- [ ] 所有测试通过
- [ ] 类型检查通过
- [ ] 打包体积无显著增加
- [ ] 代码审查通过
