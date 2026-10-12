import { computed, nextTick, watch, type Ref, type ShallowRef } from 'vue'
import type { ZoomTransform } from 'd3'
import type {
  WaveformControlAction,
  WaveformControlResult,
  WaveformControlState,
  WaveformControlTarget,
  WaveformTargetResult,
  WaveformViewportSnapshot,
} from '../../types/controls'
import type { TrackLayout } from '../core/types'
import type { useWaveformLayout } from '../core/useWaveformLayout'
import type { ResolvedWaveformChartProps, WaveformChartEmit } from '../core/waveformChartTypes'
import { applyXDomainStrategy } from '../core/xDomain'
import { paddedDomain } from '../../utils'
import { transformForDomain } from '../interaction/zoomConstraints'
import { constrainViewportZoom } from '../interaction/remoteViewport'
import { normalizeIntegerZoomDomain } from '../interaction/integerZoom'
import type { useControlMode } from './useControlMode'

type Domain = [number, number]
interface Context {
  props: ResolvedWaveformChartProps
  emit: WaveformChartEmit
  layout: ReturnType<typeof useWaveformLayout>
  mode: ReturnType<typeof useControlMode>
  boundaries: ShallowRef<Record<string, Domain>>
  independentTransforms: ShallowRef<ZoomTransform[]>
  sharedTransform: ShallowRef<ZoomTransform>
  independentYDomains: Ref<Record<number, Domain>>
  sharedYDomains: Ref<Record<string, Domain>>
  cancel: () => void
  configure: () => void
  legacyReset: (index?: number) => void
  legacySet: (domain: Domain, index?: number) => void
}
const same = (a: Domain, b: Domain) => a.every((v, i) => Math.abs(v - b[i]!) < 1e-12)
export function useChartCommands(c: Context) {
  let sequence = 0
  const independent = computed(() => c.props.displayMode === 'independent')
  const groups = () =>
    independent.value
      ? c.layout.trackLayouts.value.map((t) => ({ id: t.id, tracks: [t] }))
      : [{ id: 'shared', tracks: c.layout.trackLayouts.value }]
  const snapshot = (tracks: TrackLayout[]): WaveformViewportSnapshot => ({
    xDomain: [
      ...(independent.value ? tracks[0]!.xScale.domain() : c.layout.sharedZoomDomain.value),
    ] as Domain,
    yDomains: Object.fromEntries(
      tracks.flatMap((t) => t.seriesPaths.map((p) => [p.series.id, p.yScale.domain() as Domain])),
    ),
  })
  const boundary = (tracks: TrackLayout[], original = false): Domain =>
    independent.value
      ? (original ? c.layout.resolveOriginalTrackDomain : c.layout.resolveInitialTrackDomain)(
          tracks[0]!,
        )
      : (original ? c.layout.originalXDomain : c.layout.initialXDomain).value
  const clearBoundaries = (index?: number) => {
    if (!independent.value || index === undefined) c.boundaries.value = {}
    else {
      const id = c.layout.trackLayouts.value.find((t) => t.index === index)?.id
      const next = { ...c.boundaries.value }
      if (id) delete next[id]
      c.boundaries.value = next
    }
  }
  function restoreInitialBoundaries() {
    if (!Object.keys(c.boundaries.value).length) return
    const previous = groups()
      .filter((g) => g.tracks.length)
      .map((g) => ({
        index: independent.value ? g.tracks[0]!.index : undefined,
        domain: snapshot(g.tracks).xDomain,
      }))
    clearBoundaries()
    previous.forEach((p) => c.legacySet(p.domain, p.index))
  }
  function plan(
    action: WaveformControlAction,
    target: WaveformControlTarget = {},
    domain?: Domain,
  ) {
    const all = groups()
    if (
      target.trackId !== undefined &&
      (!independent.value || !all.some((g) => g.id === target.trackId))
    )
      return { error: 'invalid-target' as const, entries: [] }
    if (
      action === 'set-domain' &&
      (!domain || !domain.every(Number.isFinite) || domain[0] === domain[1])
    )
      return { error: 'invalid-domain' as const, entries: [] }
    const selected = target.trackId === undefined ? all : all.filter((g) => g.id === target.trackId)
    const entries = selected.map(({ id, tracks }) => {
      const nonempty = tracks.some((t) =>
        t.seriesList.some((s) => (s.source?.length ?? s.points.length) > 0),
      )
      const before = tracks.length ? snapshot(tracks) : undefined
      let bounds: Domain = tracks.length ? boundary(tracks, action === 'reset') : [0, 1]
      if (action === 'fit')
        bounds = applyXDomainStrategy(
          paddedDomain(tracks.flatMap((t) => t.seriesList.flatMap((s) => s.xDomain))),
          c.props.xDomainStrategy,
        )
      let requested: Domain = domain ?? bounds
      if (before && (action === 'zoom-in' || action === 'zoom-out')) {
        const [a, b] = before.xDomain
        const half = (b - a) * (action === 'zoom-in' ? 0.25 : 1)
        requested = [(a + b) / 2 - half, (a + b) / 2 + half]
      }
      const xDomain = constrainViewportZoom(
        normalizeIntegerZoomDomain(requested, c.props),
        bounds,
        tracks.filter((t) => t.hasVisibleSeries).map((t) => t.seriesList),
        c.props,
      )
      const resetsY = action === 'reset' || action === 'fit'
      const hasY =
        resetsY &&
        (independent.value
          ? tracks.some((t) => c.independentYDomains.value[t.index])
          : Object.keys(c.sharedYDomains.value).length > 0)
      const boundaryChanged = tracks.length && !same(bounds, boundary(tracks))
      const status: WaveformTargetResult['status'] = !nonempty
        ? 'empty-data'
        : c.props.presentationMode || !c.props.zoomable
          ? 'disabled'
          : before && same(before.xDomain, xDomain) && !hasY && !boundaryChanged
            ? 'unchanged'
            : 'applied'
      return { id, tracks, before, bounds, xDomain, status, resetsY }
    })
    return { entries }
  }
  function execute(
    action: WaveformControlAction,
    target: WaveformControlTarget = {},
    domain?: Domain,
    source: 'toolbar' | 'api' = 'api',
  ): WaveformControlResult {
    const planned = plan(action, target, domain)
    if (planned.error) return { kind: 'viewport', status: planned.error, targets: [] }
    const { entries } = planned
    const isIndependent = independent.value
    const metadata = { commandId: `command-${++sequence}`, source, action }
    // Capture identities before host event handlers can replace the data.
    const identities = entries.map((e) => ({
      trackIndex: isIndependent ? e.tracks[0]?.index : undefined,
      seriesIds: e.tracks.flatMap((t) => t.seriesList.map((s) => s.id)),
    }))
    if (
      entries.some(
        (e) => e.status === 'applied' || (action === 'reset' && e.status === 'unchanged'),
      )
    )
      c.cancel()
    const transforms = [...c.independentTransforms.value]
    const bounds = { ...c.boundaries.value }
    const ys = { ...c.independentYDomains.value }
    for (const e of entries) {
      if (e.status !== 'applied') continue
      if (action === 'fit') bounds[e.id] = e.bounds
      if (action === 'reset') delete bounds[e.id]
      if (isIndependent) {
        const track = e.tracks[0]!
        transforms[track.index] = transformForDomain(e.xDomain, e.bounds, track.width)
        if (e.resetsY) delete ys[track.index]
      } else {
        c.sharedTransform.value = transformForDomain(e.xDomain, e.bounds, c.layout.innerWidth.value)
        if (e.resetsY) c.sharedYDomains.value = {}
      }
    }
    if (entries.some((e) => e.status === 'applied')) {
      c.boundaries.value = bounds
      c.independentTransforms.value = transforms
      c.independentYDomains.value = ys
    }
    const current = groups()
    const targets: WaveformTargetResult[] = entries.map((e) => ({
      trackId: e.id,
      status: e.status,
      before: e.before,
      after: current.find((g) => g.id === e.id)?.tracks.length
        ? snapshot(current.find((g) => g.id === e.id)!.tracks)
        : undefined,
    }))
    const yPayloads = entries.map((e) => {
      const tracks = current.find((g) => g.id === e.id)?.tracks ?? []
      const ranges = Object.fromEntries(
        tracks.map((t) => [t.series?.trackId ?? t.series?.id ?? t.id, t.yScale.domain()]),
      )
      const range = Object.values(ranges)[0]
      return isIndependent || tracks.length === 1
        ? { yStart: range?.[0], yEnd: range?.[1] }
        : { yRanges: ranges as Record<string, Domain> }
    })
    targets.forEach((result, index) => {
      if (action === 'reset' && (result.status === 'applied' || result.status === 'unchanged')) {
        c.emit('zoom-reset', { ...metadata, ...identities[index] })
      } else if (result.status === 'applied' && result.after) {
        const [start, end] = result.after.xDomain
        const payload = {
          ...metadata,
          ...identities[index],
          start,
          end,
          gesture: 'command' as const,
          ...yPayloads[index],
        }
        if (action !== 'fit') c.emit('zoom-intent', payload)
        c.emit('zoom-change', [start, end])
        c.emit('zoom-end', payload)
      }
    })
    if (targets.some((t) => t.status === 'applied')) void nextTick(c.configure)
    const status =
      (['applied', 'unchanged', 'disabled', 'empty-data'] as const).find((value) =>
        targets.some((t) => t.status === value),
      ) ?? 'empty-data'
    return { kind: 'viewport', status, targets }
  }
  function resetViewport(index?: number): void
  function resetViewport(target: WaveformControlTarget): WaveformControlResult
  function resetViewport(target?: number | WaveformControlTarget) {
    if (typeof target === 'object') return execute('reset', target)
    c.legacyReset(target)
  }
  function setViewportDomain(domain: Domain, index?: number): void
  function setViewportDomain(domain: Domain, target: WaveformControlTarget): WaveformControlResult
  function setViewportDomain(domain: Domain, target?: number | WaveformControlTarget) {
    if (typeof target === 'object') return execute('set-domain', target, domain)
    if (domain.every(Number.isFinite) && domain[0] !== domain[1]) clearBoundaries(target)
    c.legacySet(domain, target)
  }
  const state = computed<WaveformControlState>(() => {
    const actions: WaveformControlAction[] = ['zoom-in', 'zoom-out', 'reset', 'fit', 'set-domain']
    const targets = groups()
      .filter((g) => g.tracks.length)
      .map((g) => ({
        trackId: g.id,
        label: independent.value ? g.tracks[0]!.series?.name || g.id : '共享范围',
        viewport: snapshot(g.tracks),
        available: Object.fromEntries(
          actions.map((action) => {
            const p = plan(
              action,
              independent.value ? { trackId: g.id } : {},
              snapshot(g.tracks).xDomain,
            ).entries[0]
            return [
              action,
              p?.status === 'applied' ||
                ((action === 'reset' || action === 'set-domain') && p?.status === 'unchanged'),
            ]
          }),
        ) as Record<WaveformControlAction, boolean>,
      }))
    return {
      mode: c.mode.mode.value,
      independent: independent.value,
      targets,
      available: {
        'zoom-box': c.mode.canSetMode('zoom'),
        pan: c.mode.canSetMode('pan'),
        annotate: c.mode.canSetMode('annotation'),
        export: true,
        'zoom-in': targets.some((t) => t.available['zoom-in']),
        'zoom-out': targets.some((t) => t.available['zoom-out']),
        reset: targets.some((t) => t.available.reset),
        fit: targets.some((t) => t.available.fit),
      },
    }
  })
  const getControlState = () => JSON.parse(JSON.stringify(state.value)) as WaveformControlState
  watch(
    () => JSON.stringify(state.value),
    () => c.emit('control-state-change', getControlState()),
  )
  return {
    controlState: state,
    getControlState,
    execute,
    clearBoundaries,
    restoreInitialBoundaries,
    resetViewport,
    setViewportDomain,
    zoomIn: (target?: WaveformControlTarget) => execute('zoom-in', target),
    zoomOut: (target?: WaveformControlTarget) => execute('zoom-out', target),
    fitToData: (target?: WaveformControlTarget) => execute('fit', target),
    setInteractionMode: c.mode.setInteractionMode,
  }
}
