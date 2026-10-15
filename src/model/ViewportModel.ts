import type { WaveformViewportSnapshot } from '../types/controls'

function copy(snapshot: WaveformViewportSnapshot): WaveformViewportSnapshot {
  return {
    xDomain: [...snapshot.xDomain],
    yDomains: Object.fromEntries(
      Object.entries(snapshot.yDomains).map(([id, domain]) => [id, [...domain]]),
    ),
  }
}

/** Stable track IDs own viewports; consumers never receive mutable model storage. */
export class ViewportModel {
  private readonly states = new Map<string, WaveformViewportSnapshot>()
  private readonly boundaries = new Map<string, [number, number]>()

  boundary(trackId: string): [number, number] | undefined {
    const domain = this.boundaries.get(trackId)
    return domain ? [...domain] : undefined
  }

  setBoundary(trackId: string, domain?: [number, number]) {
    if (domain) this.boundaries.set(trackId, [...domain])
    else this.boundaries.delete(trackId)
  }

  get(trackId: string): WaveformViewportSnapshot | undefined {
    const state = this.states.get(trackId)
    return state ? copy(state) : undefined
  }

  set(trackId: string, snapshot: WaveformViewportSnapshot) {
    this.states.set(trackId, copy(snapshot))
  }

  reset(trackId?: string) {
    const changed =
      trackId === undefined
        ? this.states.size > 0 || this.boundaries.size > 0
        : this.states.has(trackId) || this.boundaries.has(trackId)
    if (trackId === undefined) {
      this.states.clear()
      this.boundaries.clear()
    } else {
      this.states.delete(trackId)
      this.boundaries.delete(trackId)
    }
    return changed
  }

  retain(trackIds: readonly string[]) {
    const available = new Set(trackIds)
    for (const id of this.states.keys()) if (!available.has(id)) this.states.delete(id)
  }
}
