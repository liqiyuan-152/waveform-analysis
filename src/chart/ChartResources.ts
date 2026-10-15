import { reportChartError } from './reportChartError'

/** Instance-owned cleanup stack. One failing resource does not strand the rest. */
export class ChartResources {
  private cleanups: Array<() => void> = []
  private disposed = false

  constructor(private readonly report: (error: unknown) => void = reportChartError) {}

  add(cleanup: () => void) {
    if (this.disposed) this.release(cleanup)
    else this.cleanups.push(cleanup)
    return cleanup
  }

  private release(cleanup: () => void) {
    try {
      cleanup()
    } catch (error) {
      this.report(error)
    }
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    const cleanups = this.cleanups
    this.cleanups = []
    for (const cleanup of cleanups.reverse()) this.release(cleanup)
  }
}
