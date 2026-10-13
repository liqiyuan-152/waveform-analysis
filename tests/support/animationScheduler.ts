import type { AnimationScheduler } from '@/animation/core/types'

/** Explicit clock, RAF and timer queues: advancing time never implicitly renders a frame. */
export function createAnimationTestScheduler(withRaf = true) {
  let currentTime = 0
  let nextId = 0
  let requestedFrames = 0
  let cancelledFrames = 0
  let createdTimers = 0
  let clearedTimers = 0
  const frames = new Map<number, (time: number) => void>()
  const timers = new Map<number, { deadline: number; callback: () => void }>()
  const scheduler: AnimationScheduler = {
    now: () => currentTime,
    setTimer(callback, delay) {
      if (!Number.isFinite(delay) || delay < 0) throw new RangeError('Invalid timer delay')
      const id = ++nextId
      createdTimers++
      timers.set(id, { deadline: currentTime + delay, callback })
      return id
    },
    clearTimer(id) {
      clearedTimers++
      timers.delete(id as number)
    },
  }
  if (withRaf) {
    scheduler.requestFrame = (callback) => {
      const id = ++nextId
      requestedFrames++
      frames.set(id, callback)
      return id
    }
    scheduler.cancelFrame = (id) => {
      cancelledFrames++
      frames.delete(id)
    }
  }
  return {
    scheduler,
    get pendingFrames() {
      return frames.size
    },
    get pendingTimers() {
      return timers.size
    },
    get requestedFrames() {
      return requestedFrames
    },
    get cancelledFrames() {
      return cancelledFrames
    },
    get createdTimers() {
      return createdTimers
    },
    get clearedTimers() {
      return clearedTimers
    },
    advance(ms: number) {
      if (!Number.isFinite(ms) || ms < 0) throw new RangeError('Clock must advance monotonically')
      const end = currentTime + ms
      let steps = 0
      while (true) {
        const next = [...timers]
          .filter(([, timer]) => timer.deadline <= end)
          .sort((a, b) => a[1].deadline - b[1].deadline || a[0] - b[0])[0]
        if (!next) break
        if (++steps > 10000) throw new Error('Unbounded timer callback chain')
        const [id, timer] = next
        currentTime = timer.deadline
        timers.delete(id)
        timer.callback()
      }
      currentTime = end
    },
    flushFrame() {
      for (const [id, callback] of [...frames]) {
        if (frames.get(id) !== callback) continue
        frames.delete(id)
        callback(currentTime)
      }
    },
  }
}
