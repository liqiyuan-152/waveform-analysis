> **历史参考，非现行规范（2026-10-12 第二轮修订）。** 通用引擎非法配置在注册前抛错；组件非法字段回退默认。duration=0 合法且直接结束，不能替换为 1000ms；暂停、清理和异常隔离以引擎/控制器规格为准。 原文保留用于追溯，不得覆盖 [现行设计](design.md)、[任务清单](tasks.md) 和 specs 中的要求。

## 错误处理和边界情况

### 异常场景处理

#### 场景 1：无效配置参数

- **duration < 0** → 抛出错误或使用默认值？
- **delay < 0** → 如何处理？
- **loop = 0** → 是否允许？
- **无效的 easing 字符串** → 回退到 'linear' 还是报错？

**建议决策**：

```typescript
// AnimationConfig 验证
if (duration <= 0) duration = 1000 // 回退到默认值
if (delay < 0) delay = 0
if (loop === 0) loop = 1
if (!easingMap[easing]) easing = 'linear'
```

#### 场景 2：组件卸载时动画未完成

- **问题**：用户快速切换页面，组件卸载但动画仍在运行
- **解决**：onUnmounted 时 animationController.destroy()
- **测试**：验证无内存泄漏

#### 场景 3：数据快速连续变化

- **问题**：用户连续修改数据（如滑块拖动），产生大量动画
- **解决**：自动取消旧动画，启动新动画
- **性能**：确保不累积动画队列

#### 场景 4：浏览器标签页后台运行

- **问题**：requestAnimationFrame 在后台标签页暂停
- **解决**：页面重新可见时，动画从当前状态继续
- **测试**：使用 Page Visibility API 测试

#### 场景 5：系统时间跳变

- **问题**：用户调整系统时间，performance.now() 可能不连续
- **解决**：使用 elapsed 差值而非绝对时间
- **已实现**：tick 方法使用 elapsed 差值

#### 场景 6：极大数据集导致内存溢出

- **问题**：100,000+ 点 + 动画可能导致浏览器崩溃
- **解决**：animationThreshold 自动禁用
- **建议**：添加内存监控和降级策略

### 错误码定义

建议在 AnimationConfig.ts 中添加：

```typescript
export enum AnimationError {
  INVALID_DURATION = 'ANIMATION_INVALID_DURATION',
  INVALID_DELAY = 'ANIMATION_INVALID_DELAY',
  INVALID_EASING = 'ANIMATION_INVALID_EASING',
  CALLBACK_ERROR = 'ANIMATION_CALLBACK_ERROR',
  MEMORY_LIMIT = 'ANIMATION_MEMORY_LIMIT',
  ALREADY_DESTROYED = 'ANIMATION_ALREADY_DESTROYED',
}

export class AnimationException extends Error {
  constructor(
    public code: AnimationError,
    message: string,
  ) {
    super(message)
    this.name = 'AnimationException'
  }
}
```

### 降级策略

```typescript
// 在 WaveformAnimationController 中
class WaveformAnimationController {
  private memoryThreshold = 100 * 1024 * 1024 // 100MB

  checkMemoryUsage(): boolean {
    if (performance.memory) {
      const used = performance.memory.usedJSHeapSize
      if (used > this.memoryThreshold) {
        console.warn('Memory limit reached, disabling animations')
        this.setEnabled(false)
        return false
      }
    }
    return true
  }
}
```
