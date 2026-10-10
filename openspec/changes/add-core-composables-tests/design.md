# Design

## Overview

为核心 composable 函数添加单元测试，提高代码质量和可维护性。

## Architecture

### Test Structure
```
tests/
├── components/
│   ├── core/
│   │   ├── useWaveformChartController.test.ts  ← 新增
│   │   ├── useWaveformChartLifecycle.test.ts   ← 新增
│   │   └── waveformChartTypes.test.ts          ← 新增
│   └── annotation/
│       └── useWaveformChartAnnotations.test.ts ← 新增
└── support/
    ├── composableTestUtils.ts                   ← 新增
    ├── d3Mocks.ts                               ← 新增
    └── domMocks.ts                              ← 新增
```

## Testing Patterns

### Pattern 1: Composable Test Host

```typescript
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'

// 创建测试宿主组件
function createTestHost<T>(composable: () => T) {
  return defineComponent({
    setup() {
      const result = composable()
      return { result }
    },
    template: '<div></div>',
  })
}

// 使用
const TestHost = createTestHost(() =>
  useWaveformChartController(mockProps, mockEmit)
)
const wrapper = mount(TestHost)
expect(wrapper.vm.result.chartWidth.value).toBe(800)
```

### Pattern 2: Mock D3 Behaviors

```typescript
// tests/support/d3Mocks.ts
import { vi } from 'vitest'

export function mockD3Zoom() {
  const zoomBehavior = {
    scaleExtent: vi.fn().mockReturnThis(),
    translateExtent: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
  }

  return {
    zoom: vi.fn(() => zoomBehavior),
    zoomIdentity: { k: 1, x: 0, y: 0 },
    zoomBehavior,
  }
}
```

### Pattern 3: Mock DOM Elements

```typescript
// tests/support/domMocks.ts
export function createMockSVGElement() {
  const element = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  Object.defineProperty(element, 'clientWidth', { value: 800, writable: true })
  Object.defineProperty(element, 'clientHeight', { value: 600, writable: true })
  return element
}

export function mockResizeObserver() {
  return vi.fn().mockImplementation((callback) => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
}
```

## Test Coverage Strategy

### useWaveformChartController (352 lines)
**Target: 80% coverage**

重点测试：
- 状态初始化和管理
- 子 composable 集成
- 响应式依赖追踪
- 公开 API（resetViewport, setViewportDomain）

跳过：
- 复杂的交互场景（由集成测试覆盖）
- D3 内部实现细节

### useWaveformChartLifecycle (394 lines)
**Target: 80% coverage**

重点测试：
- ResizeObserver 生命周期
- 事件监听器注册和清理
- 分页逻辑
- 数据变化响应

跳过：
- 浏览器特定行为
- 复杂的时序依赖

### useWaveformChartAnnotations (397 lines)
**Target: 80% coverage**

重点测试：
- CRUD 操作的不可变性
- 坐标转换准确性
- 编辑器状态管理
- 事件 emit 正确性

跳过：
- UI 渲染细节（由快照测试覆盖）

## Mock Strategy

### Minimal Mocking
只 mock 外部依赖，不 mock 内部模块：
- ✅ Mock: D3、ResizeObserver、DOM APIs
- ❌ 不 Mock: 项目内部的其他 composables

### Partial Mocking
对于复杂的子 composable，可以提供简化的 mock：
```typescript
const mockZoom = {
  canZoomTrack: vi.fn(() => true),
  configureZoom: vi.fn(),
  cancelPendingZoom: vi.fn(),
  clearZoomBindings: vi.fn(),
}
```

## Performance Considerations

- 每个测试文件应在 < 2 秒内完成
- 使用 `vi.useFakeTimers()` 跳过真实等待
- 避免挂载完整的 WaveformChart（太慢）

## Risks and Mitigations

### Risk: Composables 高度耦合
**Mitigation**:
- 接受一定程度的集成测试特性
- 重点测试单个 composable 的职责
- 记录测试边界

### Risk: Mock 设置复杂
**Mitigation**:
- 创建可重用的 test utilities
- 文档化常见 mock 模式
- 逐步完善 mock 库

### Risk: 测试维护成本
**Mitigation**:
- 测试行为而非实现细节
- 使用工厂函数减少重复
- 保持测试简洁清晰
