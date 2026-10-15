import type { ChartEventEmitter } from './ChartEventEmitter'
import { reportChartError } from './reportChartError'

export type ChartDirtyStage = 'data' | 'layout' | 'sampling' | 'view'

export interface ChartFrameDriver {
  request(callback: () => void): number
  cancel(handle: number): void
  microtask?(callback: () => void): void
}

export interface ChartUpdatePhases {
  data(): void
  layout(): void
  sampling(): void
  /** False means zero-size/hidden: no frame has been committed. */
  view(): boolean
  isStable(): boolean
}

const stages: readonly ChartDirtyStage[] = ['data', 'layout', 'sampling', 'view']

/** One instance owns one queued frame; reentrant changes are handled on a later frame. */
export class ChartUpdateScheduler {
  private dirty = new Set<ChartDirtyStage>()
  private frame?: number
  private running = false
  private disposed = false
  private version = 0
  private renderedVersion = -1
  private finishedVersion = -1
  private earlyFlushQueued = false
  private readonly settledListeners = new Set<() => void>()

  constructor(
    private readonly driver: ChartFrameDriver,
    private readonly phases: ChartUpdatePhases,
    private readonly events: ChartEventEmitter,
    private readonly report: (error: unknown) => void = reportChartError,
  ) {}

  get revision() {
    return this.version
  }

  /** Call only for an effective configuration/state/size change. */
  invalidate(stage: ChartDirtyStage) {
    if (this.disposed) return
    this.version += 1
    this.refresh(stage)
  }

  /** Sampling/animation frames keep the business revision. */
  refresh(stage: ChartDirtyStage = 'view', settleEarly = false) {
    if (this.disposed) return
    for (const dependent of stages.slice(stages.indexOf(stage))) this.dirty.add(dependent)
    this.enqueue()
    if (settleEarly && this.driver.microtask && !this.earlyFlushQueued) {
      this.earlyFlushQueued = true
      this.driver.microtask(() => {
        this.earlyFlushQueued = false
        if (this.disposed || this.running || this.frame === undefined) return
        // Async sampling can settle between paints. Commit it without another full frame of lag;
        // animation and font-dependent work continue on the normal frame driver.
        if (!this.phases.isStable()) return
        this.driver.cancel(this.frame)
        this.flush()
      })
    }
  }

  private enqueue() {
    if (this.disposed || this.running || this.frame !== undefined) return
    this.frame = this.driver.request(() => this.flush())
  }

  private flush() {
    this.frame = undefined
    if (this.disposed) return
    const revision = this.version
    const dirty = this.dirty
    this.dirty = new Set()
    this.running = true
    try {
      let rendered = false
      for (const stage of stages) {
        if (this.disposed || revision !== this.version) break
        if (!dirty.has(stage)) continue
        if (stage === 'view') rendered = this.phases.view()
        else this.phases[stage]()
      }
      if (rendered && !this.disposed && revision === this.version) {
        this.renderedVersion = revision
        this.events.emit('rendered', { revision })
        // The rendered listener may have committed a newer option or destroyed this instance.
        if (
          !this.disposed &&
          revision === this.version &&
          this.dirty.size === 0 &&
          this.phases.isStable() &&
          this.finishedVersion !== revision
        ) {
          this.finishedVersion = revision
          this.events.emit('finished', { revision })
        }
      }
    } catch (error) {
      this.report(error)
    } finally {
      this.running = false
      if (this.dirty.size) this.enqueue()
      // Snapshot prevents a listener added during notification from running in this same flush.
      for (const listener of Array.from(this.settledListeners)) {
        if (this.disposed) break
        if (!this.settledListeners.has(listener)) continue
        try {
          listener()
        } catch (error) {
          this.report(error)
        }
      }
    }
  }

  /** Internal export barriers observe committed frames without timer/frame polling latency. */
  onFrameSettled(listener: () => void) {
    if (!this.disposed) this.settledListeners.add(listener)
    return () => this.settledListeners.delete(listener)
  }

  /** Export barriers inspect state rather than subscribing to a past finished event. */
  isStable(revision = this.version) {
    return (
      !this.disposed &&
      revision === this.version &&
      this.renderedVersion === revision &&
      this.dirty.size === 0 &&
      !this.running &&
      this.frame === undefined &&
      this.phases.isStable()
    )
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    if (this.frame !== undefined) this.driver.cancel(this.frame)
    this.frame = undefined
    this.dirty.clear()
    this.settledListeners.clear()
  }
}
