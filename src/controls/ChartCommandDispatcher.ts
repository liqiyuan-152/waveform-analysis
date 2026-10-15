import type { ChartModel } from '../model/ChartModel'
import type { ChartLayoutSnapshot } from '../layout/ChartLayoutEngine'
import type { ChartEventEmitter } from '../chart/ChartEventEmitter'
import type { WaveformChartAction } from '../types/native'
import type {
  WaveformControlAction,
  WaveformControlResult,
  WaveformControlState,
  WaveformControlTarget,
  WaveformViewportSnapshot,
} from '../types/controls'
import type { TrackLayout } from '../components/core/types'
import { constrainViewportZoom } from '../components/interaction/remoteViewport'
import { resolveStepZoomDomain, sameZoomDomain } from '../components/interaction/stepZoom'
import { normalizeIntegerZoomDomain } from '../components/interaction/integerZoom'
import { applyXDomainStrategy } from '../components/core/xDomain'
import { paddedDomain } from '../utils/domain'
import { validateChartAction } from './validateChartAction'

type Domain = [number, number]
const actions: WaveformControlAction[] = ['zoom-in', 'zoom-out', 'reset', 'fit', 'set-domain']

export class ChartCommandDispatcher {
  private sequence = 0

  constructor(
    private readonly model: ChartModel,
    private readonly layout: () => ChartLayoutSnapshot,
    private readonly events: ChartEventEmitter,
    private readonly changed: () => void,
  ) {}

  private snapshot(tracks: TrackLayout[], shared: Domain): WaveformViewportSnapshot {
    return {
      xDomain:
        this.model.options.value.displayMode === 'independent'
          ? (tracks[0]!.xScale.domain() as Domain)
          : (this.model.viewport.get('shared')?.xDomain ?? shared),
      yDomains: Object.fromEntries(
        tracks.flatMap((track) =>
          track.seriesPaths.map((path) => [path.series.id, path.yScale.domain() as Domain]),
        ),
      ),
    }
  }

  private plan(action: WaveformControlAction, target: WaveformControlTarget = {}, domain?: Domain) {
    const options = this.model.options.value
    const layout = this.layout()
    const independent = options.displayMode === 'independent'
    const groups = independent
      ? layout.trackLayouts.map((track) => ({ id: track.id, tracks: [track] }))
      : [{ id: 'shared', tracks: layout.trackLayouts }]
    if (
      !target ||
      typeof target !== 'object' ||
      Array.isArray(target) ||
      (target.trackId !== undefined && typeof target.trackId !== 'string')
    )
      return { error: 'invalid-target' as const, entries: [], independent }
    if (
      target.trackId !== undefined &&
      (!independent || !groups.some((group) => group.id === target.trackId))
    )
      return { error: 'invalid-target' as const, entries: [], independent }
    if (
      action === 'set-domain' &&
      (!Array.isArray(domain) ||
        domain.length !== 2 ||
        !domain.every(Number.isFinite) ||
        domain[0] === domain[1])
    )
      return { error: 'invalid-domain' as const, entries: [], independent }
    const entries = groups
      .filter((group) => target.trackId === undefined || group.id === target.trackId)
      .map(({ id, tracks }) => {
        const before = tracks.length ? this.snapshot(tracks, layout.sharedDomain) : undefined
        const original = layout.originalDomains[id] ?? layout.sharedDomain
        const currentBounds = this.model.viewport.boundary(id) ?? original
        const bounds =
          action === 'reset'
            ? original
            : action === 'fit'
              ? applyXDomainStrategy(
                  paddedDomain(
                    tracks.flatMap((track) => track.seriesList.flatMap((series) => series.xDomain)),
                  ),
                  options.xDomainStrategy,
                )
              : currentBounds
        const seriesGroups = tracks
          .filter((track) => track.hasVisibleSeries)
          .map((track) => track.seriesList)
        const next =
          before && (action === 'zoom-in' || action === 'zoom-out')
            ? resolveStepZoomDomain(before.xDomain, action, bounds, seriesGroups, options)
            : constrainViewportZoom(
                normalizeIntegerZoomDomain(domain ?? bounds, options),
                bounds,
                seriesGroups,
                options,
              )
        const resetsY = action === 'fit' || action === 'reset'
        const hasY = resetsY && Object.keys(this.model.viewport.get(id)?.yDomains ?? {}).length > 0
        const hasSeries = tracks.some((track) => track.seriesList.length > 0)
        const hasSamples = tracks.some((track) =>
          track.seriesList.some((series) => (series.source?.length ?? series.points.length) > 0),
        )
        const status =
          !hasSeries || (action === 'fit' && !hasSamples)
            ? ('empty-data' as const)
            : options.presentationMode || !options.zoomable
              ? ('disabled' as const)
              : before &&
                  sameZoomDomain(before.xDomain, next) &&
                  !hasY &&
                  sameZoomDomain(bounds, currentBounds)
                ? ('unchanged' as const)
                : ('applied' as const)
        return { id, tracks, before, bounds, next, status, resetsY }
      })
    return { entries, independent }
  }

  execute(action: WaveformChartAction, source: 'api' | 'toolbar' = 'api'): WaveformControlResult {
    validateChartAction(action)
    if (action.type === 'set-mode') {
      const options = this.model.options.value
      const status = this.model.presentation.requestMode(action.mode, options)
      if (status === 'requested') this.events.emit('update:interactionMode', action.mode)
      if (status === 'applied') {
        this.changed()
        this.events.emit('interaction-mode-change', action.mode)
      }
      return { kind: 'mode', status, targets: [] }
    }
    const planned = this.plan(
      action.type,
      action.target,
      action.type === 'set-domain' ? action.domain : undefined,
    )
    if (planned.error) return { kind: 'viewport', status: planned.error, targets: [] }
    const metadata = { commandId: `command-${++this.sequence}`, source, action: action.type }
    for (const entry of planned.entries) {
      if (entry.status === 'applied') {
        this.model.viewport.set(entry.id, {
          xDomain: entry.next,
          yDomains: entry.resetsY ? {} : (this.model.viewport.get(entry.id)?.yDomains ?? {}),
        })
        if (action.type === 'fit') this.model.viewport.setBoundary(entry.id, entry.bounds)
        if (action.type === 'reset') this.model.viewport.setBoundary(entry.id)
      }
    }
    if (planned.entries.some((entry) => entry.status === 'applied')) this.changed()
    const current = this.layout()
    const currentTracks = (id: string) =>
      planned.independent
        ? current.trackLayouts.filter((track) => track.id === id)
        : current.trackLayouts
    const targets = planned.entries.map((entry) => {
      const tracks = currentTracks(entry.id)
      return {
        trackId: entry.id,
        status: entry.status,
        before: entry.before,
        after: tracks.length ? this.snapshot(tracks, current.sharedDomain) : undefined,
      }
    })
    // Capture all event payloads before any callback can replace options or data.
    const notifications = planned.entries.map((entry, index) => {
      const identity = {
        trackIndex: planned.independent ? entry.tracks[0]?.index : undefined,
        seriesIds: entry.tracks.flatMap((track) => track.seriesList.map((series) => series.id)),
      }
      const tracks = currentTracks(entry.id)
      const ranges = Object.fromEntries(
        tracks.map((track) => [
          track.series?.trackId ?? track.series?.id ?? track.id,
          track.yScale.domain() as Domain,
        ]),
      )
      const range = Object.values(ranges)[0]
      return {
        ...metadata,
        ...identity,
        start: targets[index]?.after?.xDomain[0] ?? entry.next[0],
        end: targets[index]?.after?.xDomain[1] ?? entry.next[1],
        gesture: 'command' as const,
        ...(planned.independent || entry.tracks.length === 1
          ? { yStart: range?.[0], yEnd: range?.[1] }
          : { yRanges: ranges }),
      }
    })
    targets.forEach((target, index) => {
      const payload = notifications[index]!
      if (action.type === 'reset' && ['applied', 'unchanged'].includes(target.status))
        this.events.emit('zoom-reset', {
          ...metadata,
          trackIndex: payload.trackIndex,
          seriesIds: payload.seriesIds,
        })
      else if (target.status === 'applied') {
        if (action.type !== 'fit') this.events.emit('zoom-intent', payload)
        this.events.emit('zoom-change', [payload.start, payload.end])
        this.events.emit('zoom-end', payload)
      }
    })
    const status =
      (['applied', 'unchanged', 'disabled', 'empty-data'] as const).find((value) =>
        targets.some((target) => target.status === value),
      ) ?? 'empty-data'
    return { kind: 'viewport', status, targets }
  }

  /** The old numeric overloads are silent and do not use toolbar/API capability gates. */
  legacyReset(index?: number) {
    const layout = this.layout()
    let changed: boolean
    if (this.model.options.value.displayMode !== 'independent' || index === undefined)
      changed = this.model.viewport.reset()
    else {
      const track = layout.trackLayouts.find((track) => track.index === index)
      if (!track) return
      changed = this.model.viewport.reset(track.id)
    }
    if (changed) this.changed()
  }

  legacySet(domain: Domain, index?: number) {
    if (
      !Array.isArray(domain) ||
      domain.length !== 2 ||
      !domain.every(Number.isFinite) ||
      domain[0] === domain[1]
    )
      return
    const options = this.model.options.value
    const layout = this.layout()
    const independent = options.displayMode === 'independent'
    const selected = independent
      ? layout.trackLayouts.filter((track) => index === undefined || track.index === index)
      : layout.trackLayouts
    if (!selected.length) return
    const groups = independent
      ? selected.map((track) => ({ id: track.id, tracks: [track] }))
      : [{ id: 'shared', tracks: selected }]
    let changed = false
    for (const group of groups) {
      const boundary = layout.originalDomains[group.id] ?? layout.sharedDomain
      const next = constrainViewportZoom(
        domain,
        boundary,
        group.tracks.map((track) => track.seriesList),
        options,
      )
      if (
        this.model.viewport.boundary(group.id) ||
        !sameZoomDomain(this.snapshot(group.tracks, layout.sharedDomain).xDomain, next)
      )
        changed = true
      this.model.viewport.setBoundary(group.id)
      this.model.viewport.set(group.id, {
        xDomain: next,
        yDomains: this.model.viewport.get(group.id)?.yDomains ?? {},
      })
    }
    if (changed) this.changed()
  }

  getControlState(): WaveformControlState {
    const options = this.model.options.value
    const layout = this.layout()
    const independent = options.displayMode === 'independent'
    const groups = independent
      ? layout.trackLayouts.map((track) => ({ id: track.id, tracks: [track] }))
      : [{ id: 'shared', tracks: layout.trackLayouts }]
    const targets = groups
      .filter((group) => group.tracks.length)
      .map((group) => {
        const viewport = this.snapshot(group.tracks, layout.sharedDomain)
        const available = Object.fromEntries(
          actions.map((action) => {
            const status = this.plan(
              action,
              independent ? { trackId: group.id } : {},
              viewport.xDomain,
            ).entries[0]?.status
            return [
              action,
              status === 'applied' ||
                ((action === 'reset' || action === 'set-domain') && status === 'unchanged'),
            ]
          }),
        ) as WaveformControlState['targets'][number]['available']
        return {
          trackId: group.id,
          label: independent ? group.tracks[0]!.series?.name || group.id : '共享范围',
          viewport,
          available,
        }
      })
    return {
      mode: this.model.presentation.mode(options),
      independent,
      targets,
      available: {
        'zoom-box': this.model.presentation.canSetMode('zoom', options),
        pan: this.model.presentation.canSetMode('pan', options),
        annotate: this.model.presentation.canSetMode('annotation', options),
        export: true,
        'zoom-in': targets.some((target) => target.available['zoom-in']),
        'zoom-out': targets.some((target) => target.available['zoom-out']),
        reset: targets.some((target) => target.available.reset),
        fit: targets.some((target) => target.available.fit),
      },
    }
  }
}
