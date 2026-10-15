import type { WaveformControlState } from '../types/controls'
import type { ChartEventEmitter } from '../chart/ChartEventEmitter'
import { reportChartError } from '../chart/reportChartError'

/** Observe effective control snapshots; coalesce synchronous changes like the Vue state watcher. */
export class ControlStateObserver {
  private signature: string
  private pending = false
  private disposed = false

  constructor(
    private readonly read: () => WaveformControlState,
    private readonly events: ChartEventEmitter,
    private readonly enqueue: (callback: () => void) => void,
    private readonly report: (error: unknown) => void = reportChartError,
  ) {
    this.signature = JSON.stringify(read())
  }

  schedule() {
    if (this.disposed || this.pending) return
    this.pending = true
    this.enqueue(() => {
      this.pending = false
      if (this.disposed) return
      try {
        const state = this.read()
        const signature = JSON.stringify(state)
        if (signature === this.signature) return
        // Commit before notifying: a callback can enqueue a new snapshot or mutate its payload.
        this.signature = signature
        this.events.emit('control-state-change', state)
      } catch (error) {
        this.report(error)
      }
    })
  }

  dispose() {
    this.disposed = true
  }
}
