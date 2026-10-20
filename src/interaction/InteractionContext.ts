import type { ChartModel } from '../model/ChartModel'
import type { ChartLayoutSnapshot } from '../layout/ChartLayoutEngine'
import type { ChartEventEmitter } from '../chart/ChartEventEmitter'
import type { TrackLayout } from '../components/core/types'

export type Domain = [number, number]

/** All gesture owners use business layout, never animation or sampled geometry. */
export interface InteractionContext {
  model: ChartModel
  layout: () => ChartLayoutSnapshot
  events: ChartEventEmitter
  window: Window
  changed: () => void
  stabilize: (preserveViewport?: boolean) => void
  alive: () => boolean
}

export class GestureViewport {
  constructor(readonly context: InteractionContext) {}

  get independent() {
    return this.context.model.options.value.displayMode === 'independent'
  }

  enabled(kind: 'zoom' | 'pan') {
    const { model } = this.context
    const options = model.options.value
    const mode = model.presentation.mode(options)
    return (
      this.context.alive() &&
      !options.presentationMode &&
      (kind === 'zoom' ? options.zoomable && mode === 'zoom' : options.pannable)
    )
  }

  key(track: TrackLayout) {
    return this.independent ? track.id : 'shared'
  }

  tracks(track: TrackLayout) {
    return this.independent
      ? [track]
      : this.context.layout().trackLayouts.filter((item) => item.hasVisibleSeries)
  }

  boundary(track: TrackLayout): Domain {
    const key = this.key(track)
    const layout = this.context.layout()
    return this.context.model.viewport.boundary(key) ?? layout.originalDomains[key]
  }

  set(track: TrackLayout, xDomain: Domain, yDomains?: Record<string, Domain>) {
    const { model } = this.context
    const key = this.key(track)
    model.viewport.set(key, {
      xDomain,
      yDomains: yDomains ?? model.viewport.get(key)?.yDomains ?? {},
    })
    this.context.changed()
  }

  identity(track: TrackLayout) {
    return this.independent
      ? { trackIndex: track.index, seriesIds: track.seriesList.map((series) => series.id) }
      : {}
  }

  endPayload(track: TrackLayout, domain: Domain, gesture: 'wheel' | 'box') {
    const tracks = this.tracks(track)
    const yRanges = Object.fromEntries(
      tracks.map((item) => [
        item.series?.trackId ?? item.series?.id ?? item.id,
        item.yScale.domain() as Domain,
      ]),
    )
    const yDomain = Object.values(yRanges)[0]
    return {
      start: domain[0],
      end: domain[1],
      ...this.identity(track),
      ...(this.independent || tracks.length === 1
        ? { yStart: yDomain?.[0], yEnd: yDomain?.[1] }
        : { yRanges }),
      gesture,
    }
  }
}
