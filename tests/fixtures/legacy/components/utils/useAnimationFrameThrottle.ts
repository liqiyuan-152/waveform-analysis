/**
 * 创建一个基于 requestAnimationFrame 的节流工具
 * 用于合并多个快速连续的调用到单个动画帧中
 */
export function useAnimationFrameThrottle<T = void>() {
  let frameHandle: number | null = null
  let pendingCallback: (() => T) | null = null

  /**
   * 调度一个回调在下一个动画帧中执行
   * 如果已经有待处理的帧，则替换待处理的回调
   */
  function schedule(callback: () => T): void {
    pendingCallback = callback
    if (frameHandle !== null) return

    frameHandle = requestAnimationFrame(() => {
      frameHandle = null
      const cb = pendingCallback
      pendingCallback = null
      cb?.()
    })
  }

  /**
   * 取消待处理的动画帧调度
   */
  function cancel(): void {
    pendingCallback = null
    if (frameHandle === null) return
    cancelAnimationFrame(frameHandle)
    frameHandle = null
  }

  /**
   * 立即执行待处理的回调（如果有）
   */
  function flush(): void {
    if (frameHandle !== null) {
      cancelAnimationFrame(frameHandle)
      frameHandle = null
    }
    const cb = pendingCallback
    pendingCallback = null
    cb?.()
  }

  /**
   * 检查是否有待处理的调度
   */
  function isPending(): boolean {
    return frameHandle !== null
  }

  return { schedule, cancel, flush, isPending }
}
