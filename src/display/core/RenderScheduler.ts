export type Invalidation = 'data' | 'layout' | 'visual'

/** Synchronous business scheduler; batches reentrant invalidations after drawing. */
export class RenderScheduler {
  private drawing = false
  private pending = new Set<Invalidation>()
  private disposed = false
  constructor(private readonly draw: (flags: ReadonlySet<Invalidation>) => void) {}

  request(...flags: Invalidation[]) {
    if (this.disposed) return
    flags.forEach((flag) => this.pending.add(flag))
    if (this.drawing) return
    this.drawing = true
    try {
      while (this.pending.size && !this.disposed) {
        const next = this.pending
        this.pending = new Set()
        this.draw(next)
      }
    } finally {
      this.drawing = false
    }
  }

  destroy() {
    this.disposed = true
    this.pending.clear()
  }
}
