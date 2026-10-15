import type { ChartModel } from '../model/ChartModel'
import type { ChartLayoutSnapshot } from '../layout/ChartLayoutEngine'
import type { ResolvedWaveformChartProps } from '../types/options'
import type { TrackLayout } from '../components/core/types'
import { seriesIdentity } from '../components/interaction/zoomEventPayload'
import {
  remotePanBoundary,
  restoreViewportDomain,
  constrainViewportZoom,
} from '../components/interaction/remoteViewport'
import type { Domain } from './InteractionContext'

export interface CapturedViewport {
  identity: string
  domain: Domain
  yDomains: Record<string, Domain>
}

/** Data rebindings preserve requested seconds, never a width-dependent D3 transform. */
export class ViewportRestorer {
  constructor(
    private readonly model: ChartModel,
    private readonly layout: () => ChartLayoutSnapshot,
    private readonly invalidateLayout: () => void,
  ) {}

  capture(pending: (track: TrackLayout) => Domain | undefined): CapturedViewport[] {
    const layout = this.layout()
    const options = this.model.options.value
    const independent = options.displayMode === 'independent'
    const groups = independent
      ? layout.trackLayouts.map((track) => ({ key: track.id, tracks: [track] }))
      : [{ key: 'shared', tracks: layout.trackLayouts }]
    const hasBoundary = groups.some((group) => this.model.viewport.boundary(group.key))
    return groups.flatMap(({ key, tracks }) => {
      if (!tracks.length || !layout.originalDomains[key]) return []
      const track = tracks[0]!
      const state = this.model.viewport.get(key)
      const domain = pending(track) ?? (track.xScale.domain() as Domain)
      const original = this.model.viewport.boundary(key) ?? layout.originalDomains[key]
      const preserve =
        hasBoundary ||
        remotePanBoundary(options) ||
        domain[1] - domain[0] < original[1] - original[0] - 1e-12
      return preserve
        ? [
            {
              identity: independent
                ? seriesIdentity(track.seriesList.map((series) => series.id))
                : 'shared',
              domain: [...domain] as Domain,
              yDomains: state?.yDomains ?? {},
            },
          ]
        : []
    })
  }

  restore(captured: CapturedViewport[], previous: ResolvedWaveformChartProps) {
    this.model.viewport.reset()
    this.invalidateLayout()
    const options = this.model.options.value
    if (
      !captured.length ||
      previous.displayMode !== options.displayMode ||
      previous.integerZoom !== options.integerZoom
    )
      return
    const layout = this.layout()
    const independent = options.displayMode === 'independent'
    const groups = independent
      ? layout.trackLayouts.map((track) => ({ key: track.id, tracks: [track] }))
      : [{ key: 'shared', tracks: layout.trackLayouts.filter((track) => track.hasVisibleSeries) }]
    for (const { key, tracks } of groups) {
      if (!tracks.length || !layout.originalDomains[key]) continue
      const identity = independent
        ? seriesIdentity(tracks[0]!.seriesList.map((series) => series.id))
        : 'shared'
      const previous = captured.find((state) => state.identity === identity)
      if (!previous) continue
      const domain = restoreViewportDomain(
        previous.domain,
        layout.originalDomains[key],
        tracks.map((track) => track.seriesList),
        options,
      )
      this.model.viewport.set(key, { xDomain: domain, yDomains: previous.yDomains })
    }
    this.invalidateLayout()
  }

  reconcileBounds(previous: ResolvedWaveformChartProps) {
    const options = this.model.options.value
    const keys = [
      'initialXDomain',
      'initialXDomains',
      'xDomainStrategy',
      'hiddenSeriesIds',
    ] as const
    if (!keys.some((key) => previous[key] !== options[key])) return
    this.clearFitBounds()
  }

  clearFitBounds() {
    this.invalidateLayout()
    const layout = this.layout()
    const options = this.model.options.value
    const independent = options.displayMode === 'independent'
    const groups = independent
      ? layout.trackLayouts.map((track) => ({ key: track.id, tracks: [track] }))
      : [{ key: 'shared', tracks: layout.trackLayouts }]
    for (const { key, tracks } of groups) {
      if (!this.model.viewport.boundary(key) || !tracks.length) continue
      this.model.viewport.setBoundary(key)
      const current = this.model.viewport.get(key)
      if (!current) continue
      this.model.viewport.set(key, {
        xDomain: constrainViewportZoom(
          current.xDomain,
          layout.originalDomains[key],
          tracks.filter((track) => track.hasVisibleSeries).map((track) => track.seriesList),
          options,
        ),
        yDomains: current.yDomains,
      })
    }
    this.invalidateLayout()
  }
}
