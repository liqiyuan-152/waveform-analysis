> **历史参考，非现行规范（2026-10-12 第二轮修订）。** 内置监控类、自动性能降级及示例均为早期设想，未纳入公共 API 承诺。性能使用独立真实浏览器基准，目标不等于已测结果，不以 RAF 回调计数单独证明绘制性能。 原文保留用于追溯，不得覆盖 [现行设计](design.md)、[任务清单](tasks.md) 和 specs 中的要求。

## 性能监控和调试指南

### 性能监控工具

#### 1. 内置性能监控

在开发模式下，动画系统应提供性能监控能力：

```typescript
// src/animation/core/PerformanceMonitor.ts
export class PerformanceMonitor {
  private frameCount = 0
  private lastTime = 0
  private fps = 0
  private animationCount = 0

  startFrame(): void {
    const now = performance.now()
    if (now - this.lastTime >= 1000) {
      this.fps = this.frameCount
      this.frameCount = 0
      this.lastTime = now

      if (this.fps < 30) {
        console.warn(`Low FPS detected: ${this.fps}`)
      }
    }
    this.frameCount++
  }

  logStats(): void {
    console.log(`Animation Stats:
      FPS: ${this.fps}
      Active Animations: ${this.animationCount}
      Memory: ${(performance.memory?.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB
    `)
  }
}

// 在 Animator 中集成
export class Animator {
  private monitor = new PerformanceMonitor()

  private update(): void {
    if (process.env.NODE_ENV === 'development') {
      this.monitor.startFrame()
    }
    // ... 现有更新逻辑
  }
}
```

#### 2. Chrome DevTools 性能分析

**步骤**：

1. 打开 Chrome DevTools → Performance
2. 录制动画执行过程
3. 查看关键指标：
   - **FPS**：应保持 > 55fps
   - **Frame Duration**：单帧 < 16.7ms
   - **Long Tasks**：无超过 50ms 的长任务
   - **Memory**：无持续增长（内存泄漏）

**关键区域**：

- `Animation.tick` 执行时间
- `during` 回调执行时间
- DOM 操作频率

#### 3. 自定义性能标记

```typescript
// 在关键路径添加 Performance API 标记
export class Animation {
  tick(currentTime: number): boolean {
    performance.mark('animation-tick-start')

    // ... 动画逻辑

    performance.mark('animation-tick-end')
    performance.measure('animation-tick', 'animation-tick-start', 'animation-tick-end')

    return finished
  }
}

// 在 Console 中查看
performance.getEntriesByName('animation-tick').forEach((entry) => {
  console.log(`Animation tick: ${entry.duration.toFixed(2)}ms`)
})
```

### 常见性能问题排查

#### 问题 1：动画卡顿（FPS < 30）

**可能原因**：

1. ✅ **数据量过大** → 检查是否超过 animationThreshold
2. ✅ **during 回调过重** → 使用 Chrome Profiler 定位
3. ✅ **DOM 操作频繁** → 批量更新，使用 transform 而非 position
4. ✅ **同时运行过多动画** → 限制并发数量

**排查步骤**：

```typescript
// 添加调试日志
const animationController = new WaveformAnimationController(true)

// 监控活动动画数
setInterval(() => {
  const count = animationController.getActiveAnimationCount()
  if (count > 20) {
    console.warn(`Too many animations: ${count}`)
  }
}, 1000)
```

#### 问题 2：内存持续增长

**可能原因**：

1. ✅ **动画未正确清理** → 检查 onUnmounted 调用 destroy()
2. ✅ **闭包引用泄漏** → 检查 during/done 回调是否持有大对象
3. ✅ **DOM 节点未移除** → 标注消失动画应调用 remove()

**排查步骤**：

```typescript
// Chrome DevTools → Memory → Take Heap Snapshot
// 对比动画前后的快照，查找未释放的对象

// 检查 animationMap 是否正确清理
console.log(globalAnimator.getAnimationCount()) // 应该在动画完成后为 0
```

#### 问题 3：动画不流畅（有跳变）

**可能原因**：

1. ✅ **时间计算错误** → 检查 pauseDuration 累计
2. ✅ **缓动函数不连续** → 验证 f(0)=0, f(1)=1
3. ✅ **数据更新冲突** → 检查是否正确取消旧动画

**排查步骤**：

```typescript
// 记录进度值，检查是否连续
const progressLog: number[] = []
animator.animate({
  duration: 1000,
  during: (progress) => {
    progressLog.push(progress)
    if (progressLog.length > 1) {
      const diff = progress - progressLog[progressLog.length - 2]
      if (diff < 0) {
        console.error('Progress jumped backward!', progressLog)
      }
    }
  },
})
```

### 调试技巧

#### 1. 慢动作播放

```typescript
// 全局减速动画，便于调试
const DEBUG_SLOW_MOTION = 0.1 // 10% 速度

export class Animator {
  private update(): void {
    const now = performance.now() * (DEBUG_SLOW_MOTION || 1)
    // ... 使用调整后的时间
  }
}
```

#### 2. 可视化动画状态

```typescript
// 在组件中添加调试面板
<div v-if="import.meta.env.DEV" class="animation-debug">
  <div>FPS: {{ fps }}</div>
  <div>Active Animations: {{ animationController.getActiveAnimationCount() }}</div>
  <div>Total Points: {{ totalPoints }}</div>
  <div>Animation Enabled: {{ shouldAnimate }}</div>
</div>
```

#### 3. 单步调试动画

```typescript
// 暂停所有动画，手动控制进度
const debugAnimation = {
  currentProgress: 0,
  step(delta = 0.01) {
    this.currentProgress = Math.min(this.currentProgress + delta, 1)
    // 手动调用 during 回调
  },
}
```

### 性能基准测试

在 `tests/animation/performance.test.ts` 中：

```typescript
describe('Animation Performance', () => {
  it('should maintain 55+ fps with 10k points', async () => {
    const data = generateMockData(10000)
    let frames = 0
    let startTime = performance.now()

    const wrapper = mount(WaveformChart, {
      props: { data, animationEnabled: true },
    })

    await nextTick()

    // 监控 1 秒内的帧数
    const checkFPS = () => {
      frames++
      const elapsed = performance.now() - startTime

      if (elapsed < 1000) {
        requestAnimationFrame(checkFPS)
      } else {
        const fps = frames / (elapsed / 1000)
        expect(fps).toBeGreaterThan(55)
      }
    }

    requestAnimationFrame(checkFPS)
  })

  it('should complete 1000ms animation in ~1000ms', async () => {
    const startTime = performance.now()

    await new Promise((resolve) => {
      globalAnimator.animate({
        duration: 1000,
        during: () => {},
        done: resolve,
      })
    })

    const elapsed = performance.now() - startTime
    expect(elapsed).toBeGreaterThan(990)
    expect(elapsed).toBeLessThan(1100) // 允许 10% 误差
  })

  it('should not leak memory', async () => {
    const initialMemory = performance.memory?.usedJSHeapSize || 0

    // 创建并销毁 100 个动画
    for (let i = 0; i < 100; i++) {
      const anim = globalAnimator.animate({
        duration: 10,
        during: () => {},
      })
      await new Promise((resolve) => setTimeout(resolve, 15))
    }

    // 强制 GC（需要 --expose-gc 运行 Node）
    if (global.gc) global.gc()

    const finalMemory = performance.memory?.usedJSHeapSize || 0
    const memoryGrowth = finalMemory - initialMemory

    expect(memoryGrowth).toBeLessThan(5 * 1024 * 1024) // < 5MB
  })
})
```

### 性能优化 Checklist

开发时检查：

- [ ] during 回调执行时间 < 5ms
- [ ] 单帧总耗时 < 16ms (60fps)
- [ ] 10k 点数据 FPS > 55
- [ ] 50k 点自动禁用动画
- [ ] RAF 空闲时自动停止
- [ ] 动画完成后自动清理
- [ ] 无内存泄漏（10 分钟测试）
- [ ] 组件卸载时所有动画停止

### 生产环境监控

```typescript
// 可选：发送性能指标到监控服务
export function reportAnimationMetrics() {
  if (process.env.NODE_ENV === 'production') {
    const metrics = {
      fps: monitor.fps,
      activeAnimations: globalAnimator.getAnimationCount(),
      memory: performance.memory?.usedJSHeapSize,
      timestamp: Date.now(),
    }

    // 发送到监控服务（如 Sentry, DataDog）
    // sendToMonitoring(metrics)
  }
}
```
