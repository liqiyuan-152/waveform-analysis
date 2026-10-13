> **历史参考，非现行规范（2026-10-12 第二轮修订）。** 无 RAF 时直接提交静态终态，不使用 setTimeout 模拟帧循环；浏览器版本表只是历史目标，未做真实浏览器验证，不能作为已支持证据。 原文保留用于追溯，不得覆盖 [现行设计](design.md)、[任务清单](tasks.md) 和 specs 中的要求。

## 浏览器兼容性和降级策略

### 目标浏览器支持

| 浏览器         | 最低版本 | 状态        | 备注                           |
| -------------- | -------- | ----------- | ------------------------------ |
| Chrome         | 90+      | ✅ 完全支持 | 主要开发和测试环境             |
| Firefox        | 88+      | ✅ 完全支持 | 需测试 RAF 性能                |
| Safari         | 14+      | ✅ 完全支持 | 注意 performance.memory 不可用 |
| Edge           | 90+      | ✅ 完全支持 | 基于 Chromium                  |
| iOS Safari     | 14+      | ⚠️ 部分支持 | 后台标签页 RAF 暂停            |
| Chrome Android | 90+      | ⚠️ 部分支持 | 性能可能较低                   |

### 关键 API 兼容性

#### 1. requestAnimationFrame

- **支持度**：所有现代浏览器
- **Polyfill**：不需要（已广泛支持）
- **降级**：无 RAF 则使用 setTimeout(fn, 16)

```typescript
const requestAnimationFrame =
  window.requestAnimationFrame ||
  window.webkitRequestAnimationFrame ||
  ((callback) => setTimeout(callback, 16))

const cancelAnimationFrame =
  window.cancelAnimationFrame || window.webkitCancelAnimationFrame || clearTimeout
```

#### 2. performance.now()

- **支持度**：所有现代浏览器
- **降级**：使用 Date.now()

```typescript
const now = (() => {
  if (performance && performance.now) {
    return () => performance.now()
  }
  const start = Date.now()
  return () => Date.now() - start
})()
```

#### 3. performance.memory

- **支持度**：仅 Chrome/Edge
- **处理**：可选特性，不影响核心功能

```typescript
if (performance.memory) {
  const memoryUsage = performance.memory.usedJSHeapSize
  // ... 内存监控
} else {
  // Safari/Firefox: 跳过内存监控
}
```

#### 4. CSS transform

- **支持度**：所有现代浏览器
- **前缀**：不需要（已标准化）

```typescript
// 直接使用，无需前缀
element.style.transform = 'scale(0.5)'
```

### 浏览器特定问题和解决方案

#### Safari 问题

**问题 1：后台标签页 RAF 暂停**

- **现象**：切换到其他标签页后，动画暂停
- **解决**：使用 Page Visibility API 检测

```typescript
let isPageVisible = true

document.addEventListener('visibilitychange', () => {
  isPageVisible = !document.hidden

  if (isPageVisible) {
    // 页面重新可见，恢复动画
    globalAnimator.resumeAll()
  } else {
    // 页面隐藏，暂停动画（可选）
    globalAnimator.pauseAll()
  }
})
```

**问题 2：高刷新率屏幕不兼容**

- **现象**：iPad Pro (120Hz) 动画速度异常
- **解决**：基于时间而非帧数计算进度

```typescript
// ✅ 正确：基于时间
const elapsed = now - startTime
const progress = elapsed / duration

// ❌ 错误：基于帧数
// const progress = frameCount / totalFrames
```

#### Firefox 问题

**问题：RAF 性能略低**

- **现象**：相同配置下 FPS 比 Chrome 低 5-10
- **解决**：降低 animationThreshold 到 40000

```typescript
const animationThreshold = computed(() => {
  const isFirefox = navigator.userAgent.includes('Firefox')
  return isFirefox ? 40000 : 50000
})
```

#### 移动浏览器问题

**问题 1：性能受限**

- **现象**：移动设备 CPU/GPU 性能较弱
- **解决**：降低阈值或默认禁用动画

```typescript
const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent)

const animationEnabled = computed(() => {
  if (isMobile && totalPoints > 20000) {
    return false // 移动端大数据集禁用动画
  }
  return props.animationEnabled
})
```

**问题 2：电池和流量考虑**

- **解决**：提供用户选项

```vue
<WaveformChart
  :animation-enabled="!userPreference.reduceMotion"
  :animation-threshold="isMobile ? 20000 : 50000"
/>
```

### Feature Detection

```typescript
// src/animation/core/capabilities.ts
export const capabilities = {
  requestAnimationFrame: typeof requestAnimationFrame === 'function',
  performanceNow: !!(performance && performance.now),
  performanceMemory: !!(performance && performance.memory),
  cssTransform: 'transform' in document.createElement('div').style,
  pageVisibilityAPI: 'hidden' in document,
}

export function checkCapabilities(): boolean {
  if (!capabilities.requestAnimationFrame) {
    console.warn('requestAnimationFrame not supported, using setTimeout fallback')
  }

  return capabilities.requestAnimationFrame && capabilities.cssTransform
}
```

### 降级方案

#### 级别 1：完全功能（现代浏览器）

- 所有动画正常工作
- 性能监控可用
- 60fps 流畅体验

#### 级别 2：基础功能（旧版浏览器）

- 使用 setTimeout 替代 RAF
- 跳过性能监控
- 30fps 可接受体验

#### 级别 3：无动画（不支持的浏览器）

- 自动设置 animationEnabled: false
- 直接渲染最终状态
- 功能完全可用

```typescript
// 在 WaveformChart.vue 中
const effectiveAnimationEnabled = computed(() => {
  if (!checkCapabilities()) {
    console.warn('Browser does not support animation features, disabling animations')
    return false
  }
  return props.animationEnabled
})
```

### 用户偏好设置

遵守系统级动画偏好：

```typescript
// 检查用户是否禁用了动画（无障碍功能）
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

const shouldRespectMotionPreference = computed(() => {
  return prefersReducedMotion.matches
})

watch(shouldRespectMotionPreference, (reduced) => {
  if (reduced) {
    animationController.setEnabled(false)
    console.log('Animations disabled due to user preference (prefers-reduced-motion)')
  }
})

// 监听偏好变化
prefersReducedMotion.addEventListener('change', (e) => {
  if (e.matches) {
    animationController.setEnabled(false)
  }
})
```

### 测试策略

#### 跨浏览器测试清单

- [ ] Chrome 最新版：完整功能测试
- [ ] Firefox 最新版：性能对比测试
- [ ] Safari 最新版：后台暂停测试
- [ ] Edge 最新版：兼容性测试
- [ ] iOS Safari 14+：移动端性能测试
- [ ] Chrome Android：移动端性能测试

#### 自动化测试

```typescript
// tests/animation/compatibility.test.ts
describe('Browser Compatibility', () => {
  it('should work with RAF polyfill', () => {
    // 模拟不支持 RAF
    const originalRAF = window.requestAnimationFrame
    delete (window as any).requestAnimationFrame

    // 测试降级到 setTimeout
    const animator = new Animator()
    // ... 验证仍然工作

    // 恢复
    window.requestAnimationFrame = originalRAF
  })

  it('should respect prefers-reduced-motion', () => {
    // 模拟用户偏好
    Object.defineProperty(window, 'matchMedia', {
      value: () => ({ matches: true }),
    })

    const wrapper = mount(WaveformChart, {
      props: { animationEnabled: true },
    })

    // 验证动画被禁用
    expect(wrapper.vm.shouldAnimate).toBe(false)
  })
})
```

### 文档说明

在 README 中添加：

```markdown
## 浏览器兼容性

动画系统支持所有现代浏览器：

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

**注意事项**：

- Safari 不支持 `performance.memory`，内存监控将被跳过
- 移动浏览器建议使用较低的 `animationThreshold`（20000）
- 系统设置了"减少动画"的用户将自动禁用动画

**降级策略**：
如果浏览器不支持必需的 API，动画将自动禁用，功能完全可用。
```
