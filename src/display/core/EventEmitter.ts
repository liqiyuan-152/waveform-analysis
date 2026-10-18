interface Subscription<T> {
  callback: (value: T) => void
  active: boolean
}

export class EventEmitter<Events extends object> {
  private readonly listeners = new Map<keyof Events, Set<Subscription<unknown>>>()
  constructor(
    private readonly alive: () => boolean,
    private readonly report: (error: unknown) => void,
  ) {}

  on<K extends keyof Events>(type: K, callback: (value: Events[K]) => void): () => void {
    const entry: Subscription<unknown> = {
      callback: callback as (value: unknown) => void,
      active: true,
    }
    const entries = this.listeners.get(type) ?? new Set()
    entries.add(entry)
    this.listeners.set(type, entries)
    return () => {
      entry.active = false
      entries.delete(entry)
    }
  }

  emit<K extends keyof Events>(type: K, value: Events[K], first?: (value: Events[K]) => void) {
    const entries = [...(this.listeners.get(type) ?? [])]
    const errors: unknown[] = []
    const call = (callback: (value: Events[K]) => void) => {
      try {
        callback(value)
      } catch (error) {
        errors.push(error)
      }
    }
    if (first && this.alive()) call(first)
    for (const entry of entries) {
      if (!this.alive()) break
      if (entry.active) call(entry.callback)
    }
    errors.forEach(this.report)
  }

  clear() {
    for (const entries of this.listeners.values()) for (const entry of entries) entry.active = false
    this.listeners.clear()
  }
}
