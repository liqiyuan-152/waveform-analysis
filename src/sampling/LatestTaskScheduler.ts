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

/** One running task and one latest pending task, with generation-based stale-result rejection. */
export class LatestTaskScheduler {
  private generation = 0
  private running = false
  private pending?: ScheduledTask
  private disposed = false
  readonly metrics: LatestTaskSchedulerMetrics = { scheduled: 0, coalesced: 0, maxPending: 0 }

  constructor(private readonly onError: (error: unknown, generation: number) => void = () => {}) {}

  private async drain() {
    if (this.running || this.disposed) return
    this.running = true
    try {
      while (this.pending && !this.disposed) {
        const task = this.pending
        this.pending = undefined
        try {
          await task.run(task.generation)
        } catch (error) {
          if (this.isCurrent(task.generation)) {
            try {
              this.onError(error, task.generation)
            } catch {
              /* Reporting must not stall the queue. */
            }
          }
        }
      }
    } finally {
      this.running = false
    }
  }

  schedule(run: ScheduledTask['run']) {
    if (this.disposed) return 0
    this.generation += 1
    this.metrics.scheduled += 1
    if (this.pending) this.metrics.coalesced += 1
    this.pending = { generation: this.generation, run }
    this.metrics.maxPending = Math.max(this.metrics.maxPending, 1)
    void this.drain()
    return this.generation
  }

  isCurrent(candidate: number) {
    return !this.disposed && candidate === this.generation
  }
  cancelPending() {
    this.generation += 1
    this.pending = undefined
  }
  dispose() {
    this.disposed = true
    this.cancelPending()
  }
}

export function createLatestTaskScheduler(onError?: (error: unknown, generation: number) => void) {
  return new LatestTaskScheduler(onError)
}
