export interface LatestTaskSchedulerMetrics {
  scheduled: number
  coalesced: number
  maxPending: number
}

export function resolveAutoSelectedMode(
  visiblePointCount: number,
  threshold: number,
  hysteresis: number,
  previousSelectedMode?: 'raw' | 'sampled',
): 'raw' | 'sampled' {
  if (!previousSelectedMode) return visiblePointCount <= threshold ? 'raw' : 'sampled'
  return previousSelectedMode === 'raw'
    ? visiblePointCount <= threshold + hysteresis
      ? 'raw'
      : 'sampled'
    : visiblePointCount <= Math.max(0, threshold - hysteresis)
      ? 'raw'
      : 'sampled'
}

interface ScheduledTask {
  generation: number
  run: (generation: number) => Promise<void>
}

/** Runs at most one task at a time and retains only the newest pending task. */
export function createLatestTaskScheduler() {
  let generation = 0
  let running = false
  let pending: ScheduledTask | undefined
  let disposed = false
  const metrics: LatestTaskSchedulerMetrics = { scheduled: 0, coalesced: 0, maxPending: 0 }

  const drain = async () => {
    if (running || disposed) return
    running = true
    try {
      while (pending && !disposed) {
        const task = pending
        pending = undefined
        await task.run(task.generation)
      }
    } finally {
      running = false
    }
  }

  return {
    schedule(run: ScheduledTask['run']) {
      if (disposed) return 0
      generation += 1
      metrics.scheduled += 1
      if (pending) metrics.coalesced += 1
      pending = { generation, run }
      metrics.maxPending = Math.max(metrics.maxPending, 1)
      void drain()
      return generation
    },
    isCurrent(candidate: number) {
      return !disposed && candidate === generation
    },
    cancelPending() {
      generation += 1
      pending = undefined
    },
    dispose() {
      disposed = true
      generation += 1
      pending = undefined
    },
    metrics,
  }
}
