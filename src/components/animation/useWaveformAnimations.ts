import { computed, shallowRef, watch, onScopeDispose, type ComputedRef, type ShallowRef } from 'vue'
import type { TrackLayout } from '../core/types'
import type { PreparedWaveformSeries } from '../core/useWaveformData'
import type { ResolvedWaveformChartProps } from '../core/waveformChartTypes'
import { WaveformAnimationController } from '@/animation/WaveformAnimationController'
import { resolveAnimationProps } from './config'
import { createAnnotationPresentation } from './annotationPresentation'
import {
  staticTrack,
  transitionTrack,
  projectTrack,
  hasThirdGeometry,
  type TrackPresentation,
} from './trackPresentation'
import { chartExportOptions } from '../controls/chartExportOptions'
import { layoutAnnotations } from '../annotation/annotationLayout'
import { useWaveformInstanceId } from '@/utils/waveformId'

interface Context {
  props: ResolvedWaveformChartProps
  tracks: ComputedRef<TrackLayout[]>
  preparedSeries: ShallowRef<PreparedWaveformSeries[]>
  layoutReady: ComputedRef<boolean>
  innerWidth: ComputedRef<number>
  innerHeight: ComputedRef<number>
  sampling: {
    state: ComputedRef<'pending' | 'success' | 'fallback' | 'error'>
    requestSignature: ComputedRef<string>
  }
}
export function useWaveformAnimations(context: Context) {
  const { props, tracks, preparedSeries, sampling } = context
  const config = computed(() => resolveAnimationProps(props))
  const revision = shallowRef(0)
  const invalidate = () => revision.value++
  const states = new Map<string, TrackPresentation>()
  const entering = new Set<string>()
  const seen = new Set<string>()
  const prefix = useWaveformInstanceId('waveform-animation')
  let clipSequence = 0
  let previousAnnotations = props.annotations
  let previousData = props.data
  let previousLayout = ''
  let previousOptions = ''
  let previousTracks = tracks.value
  let previousSamplingState = sampling.state.value
  let pendingFrom: Map<string, TrackPresentation> | undefined
  let skipSignature: string | undefined
  const exportSuppressed = shallowRef(false)
  let disposed = false
  const media =
    typeof globalThis.matchMedia === 'function'
      ? globalThis.matchMedia('(prefers-reduced-motion: reduce)')
      : undefined
  const reduced = shallowRef(media?.matches ?? false)
  const totalPoints = computed(() =>
    preparedSeries.value.reduce((sum, series) => sum + series.source.length, 0),
  )
  const effective = computed(
    () =>
      config.value.animationEnabled &&
      !reduced.value &&
      !exportSuppressed.value &&
      typeof globalThis.requestAnimationFrame === 'function' &&
      typeof globalThis.cancelAnimationFrame === 'function' &&
      totalPoints.value < config.value.animationThreshold,
  )
  const visibleAnnotations = () =>
    props.annotationsVisible && !props.cleanView ? props.annotations : []
  const controller = new WaveformAnimationController({ commitFinalState: () => commit() })
  const annotations = createAnnotationPresentation(controller, invalidate)
  const presentationTracks = computed(() => {
    void revision.value
    return tracks.value.map((track) =>
      states.has(track.id) ? projectTrack(states.get(track.id)!) : track,
    )
  })
  const projectedAnnotations = computed(() => {
    const anchors = new Map([...states.values()].flatMap((state) => [...state.anchors]))
    const values = visibleAnnotations().flatMap((annotation) => {
      const anchor = anchors.get(annotation.id)
      const target = [...states.values()].find((state) => state.series.has(annotation.seriesId))
      const domain = target?.target.xScale.domain()
      return anchor && domain && annotation.x >= domain[0] && annotation.x <= domain[1]
        ? [{ ...annotation, x: anchor.x, y: anchor.y }]
        : []
    })
    const annotationTracks = presentationTracks.value.flatMap((track) =>
      track.seriesList.map((series) => ({
        ...track,
        series,
        yScale:
          track.seriesPaths.find(
            (path) => path.series.id === series.id && path.presentationKey !== `${series.id}:old`,
          )?.yScale ?? track.yScale,
      })),
    )
    return layoutAnnotations(
      values,
      annotationTracks,
      context.innerWidth.value,
      context.innerHeight.value,
    )
  })
  const presentationAnnotations = computed(() => {
    void revision.value
    const opacities = new Map(
      [...states.values()].flatMap((state) =>
        [...state.series].map(([id, series]) => [id, series.opacity] as const),
      ),
    )
    return annotations.project(projectedAnnotations.value, opacities)
  })
  function commit() {
    const previous = new Map(states)
    states.clear()
    for (const track of tracks.value)
      states.set(
        track.id,
        staticTrack(track, visibleAnnotations(), previous.get(track.id), !!pendingFrom),
      )
    for (const track of tracks.value)
      if (track.width > 0 && track.height > 0) {
        for (const series of track.seriesList)
          if ((series.source?.length ?? series.points.length) > 0) seen.add(series.id)
      }
    entering.clear()
    pendingFrom = undefined
    skipSignature = sampling.requestSignature.value
    invalidate()
    annotations.finish(projectedAnnotations.value)
  }
  const layoutSignature = computed(() =>
    JSON.stringify({
      tracks: tracks.value.map((track) => [
        track.id,
        track.left,
        track.top,
        track.width,
        track.height,
        track.seriesList.map((series) => series.id),
        track.yAxes.map((axis) => axis.seriesList.map((series) => series.id)),
      ]),
      width: context.innerWidth.value,
      height: context.innerHeight.value,
      mode: props.displayMode,
      overlay: props.overlayMode,
      hidden: props.hiddenSeriesIds,
      clean: props.cleanView,
      presentation: props.presentationMode,
      page: tracks.value.map((track) => track.id),
    }),
  )
  function reconcile() {
    if (disposed) return
    const nextConfig = config.value
    const dataChanged = props.data !== previousData
    if (dataChanged) {
      pendingFrom = new Map(states)
      previousData = props.data
      for (const id of states.keys())
        controller.cancel({ kind: 'custom', id: `track:${id}`, scope: 'update' })
      const interrupted = [...entering]
      for (const id of interrupted) controller.cancel({ kind: 'series', id, scope: 'enter' })
      // Anchor updates and annotation styles are independent channels (CTL-06). An interrupted
      // enter no longer owns the wait; release after reconciling the new layout/configuration.
      queueMicrotask(() => {
        if (!disposed) interrupted.forEach((id) => annotations.release(id))
      })
      entering.clear()
    }
    const optionSignature = JSON.stringify(
      Object.fromEntries(
        Object.entries(chartExportOptions(props)).filter(
          ([key]) => !['annotations', 'annotationsVisible'].includes(key),
        ),
      ),
    )
    const layoutChanged =
      (previousOptions !== '' && previousOptions !== optionSignature) ||
      (seen.size > 0 &&
        !dataChanged &&
        ((previousLayout !== '' && previousLayout !== layoutSignature.value) ||
          (!pendingFrom && previousSamplingState === 'success' && tracks.value !== previousTracks)))
    previousOptions = optionSignature
    previousLayout = layoutSignature.value
    previousTracks = tracks.value
    previousSamplingState = sampling.state.value
    controller.setEnabled(effective.value)
    if (!effective.value || layoutChanged) {
      controller.finishAll()
      commit()
      return
    }
    const stable = sampling.state.value !== 'pending' && context.layoutReady.value
    if (pendingFrom && !stable) return
    const canUpdate =
      pendingFrom &&
      sampling.state.value === 'success' &&
      skipSignature !== sampling.requestSignature.value &&
      nextConfig.animationUpdate.enabled
    const knownIds = new Set(
      preparedSeries.value.filter((series) => series.source.length > 0).map((series) => series.id),
    )
    for (const id of seen) if (!knownIds.has(id)) seen.delete(id)
    const visibleIds = tracks.value.flatMap((track) => track.seriesList.map((series) => series.id))
    const oldStates = pendingFrom ?? new Map(states)
    const live = new Set(tracks.value.map((track) => track.id))
    for (const id of states.keys()) if (!live.has(id)) states.delete(id)
    for (const track of tracks.value) {
      if (track.width <= 0 || track.height <= 0) {
        states.set(track.id, staticTrack(track, visibleAnnotations()))
        continue
      }
      const from = oldStates.get(track.id)
      const to = staticTrack(track, visibleAnnotations(), from, !!pendingFrom)
      if (pendingFrom) {
        states.set(track.id, to)
        if (canUpdate && from && !hasThirdGeometry(from)) {
          states.set(track.id, transitionTrack(from, to, 0, false))
          controller.animate(
            { kind: 'custom', id: `track:${track.id}`, scope: 'update' },
            {
              duration: nextConfig.animationUpdate.duration,
              easing: nextConfig.animationUpdate.easing,
              force: true,
              during: (p, frame) => {
                states.set(track.id, transitionTrack(from, to, p, frame.terminal))
                invalidate()
              },
              done: () =>
                track.seriesPaths.forEach(() => nextConfig.animationUpdate.onComplete?.()),
              aborted: () =>
                track.seriesPaths.forEach(() => nextConfig.animationUpdate.onAbort?.()),
            },
          )
        }
      } else if (!states.has(track.id)) states.set(track.id, to)
      else if (!controller.getActiveAnimationCount()) states.set(track.id, to)
      for (const path of track.seriesPaths) {
        const id = path.series.id
        const hasPoints = (path.series.source?.length ?? path.series.points.length) > 0
        if (!hasPoints) {
          seen.delete(id)
          continue
        }
        if (!stable) {
          if (
            !seen.has(id) &&
            nextConfig.animation.enabled &&
            skipSignature !== sampling.requestSignature.value
          ) {
            const state = states.get(track.id)!
            if (!state.clips.has(id))
              state.clips.set(id, {
                id: `${prefix}-${++clipSequence}`,
                x: 0,
                width: 0,
              })
          }
          continue
        }
        if (seen.has(id)) continue
        seen.add(id)
        if (
          !nextConfig.animation.enabled ||
          sampling.state.value !== 'success' ||
          skipSignature === sampling.requestSignature.value
        )
          continue
        const state = states.get(track.id)!
        const clip = { id: `${prefix}-${++clipSequence}`, x: 0, width: track.width }
        state.clips.set(id, clip)
        entering.add(id)
        const binding = {
          read: () => clip,
          write: (value: { x: number; width: number }) => {
            Object.assign(clip, value)
            invalidate()
          },
        }
        controller.animateSeriesEnter(id, binding, track.width, {
          ...nextConfig.animation,
          delay:
            nextConfig.animation.delay + visibleIds.indexOf(id) * nextConfig.animation.staggerDelay,
          onComplete: () => {
            state.clips.delete(id)
            entering.delete(id)
            invalidate()
            queueMicrotask(() => {
              if (!disposed) annotations.release(id)
            })
            nextConfig.animation.onComplete?.()
          },
          onAbort: () => {
            nextConfig.animation.onAbort?.()
          },
        })
      }
    }
    if (props.annotations !== previousAnnotations) {
      for (const track of tracks.value) {
        const state = states.get(track.id)
        if (state) state.anchors = staticTrack(track, visibleAnnotations(), state).anchors
      }
      previousAnnotations = props.annotations
    }
    pendingFrom = undefined
    invalidate()
    if (!stable) return
    annotations.reconcile(
      projectedAnnotations.value,
      props.annotations,
      nextConfig.animationAnnotation,
      nextConfig.animationAnnotation.enabled &&
        effective.value &&
        props.annotationsVisible &&
        !props.cleanView,
      entering,
    )
  }
  watch(
    [
      tracks,
      () => props.data,
      () => props.annotations,
      () => props.annotationsVisible,
      config,
      layoutSignature,
      sampling.state,
      context.layoutReady,
      effective,
    ],
    reconcile,
    { immediate: true },
  )
  watch(
    () => props.annotationsVisible,
    (visible) => {
      if (!visible)
        controller.finishWhere(
          (key) => key.kind === 'annotation' && ['enter', 'leave'].includes(key.scope),
          () => annotations.finish([]),
        )
    },
  )
  watch(
    () => config.value.animation.enabled,
    (enabled) => {
      if (!enabled)
        controller.finishWhere(
          (key) => key.kind === 'series' && key.scope === 'enter',
          () => {
            for (const state of states.values()) state.clips.clear()
            entering.clear()
            invalidate()
          },
        )
      if (!enabled) annotations.release()
    },
  )
  watch(
    () => config.value.animationUpdate.enabled,
    (enabled) => {
      if (!enabled)
        controller.finishWhere(
          (key) => key.scope === 'update' || key.scope === 'domain',
          () => {
            for (const track of tracks.value) {
              const old = states.get(track.id),
                next = staticTrack(track, visibleAnnotations(), old, true)
              if (old) next.clips = old.clips
              states.set(track.id, next)
            }
            invalidate()
          },
        )
    },
  )
  watch(
    () => config.value.animationAnnotation.enabled,
    (enabled) => {
      if (!enabled)
        controller.finishWhere(
          (key) => key.kind === 'annotation' && ['enter', 'leave'].includes(key.scope),
          () => annotations.finish(projectedAnnotations.value),
        )
    },
  )
  const reduceChanged = (event: MediaQueryListEvent) => {
    reduced.value = event.matches
    if (event.matches) controller.finishAll()
  }
  const visibilityChanged = () => controller.setPauseReason('document-hidden', document.hidden)
  media?.addEventListener?.('change', reduceChanged)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', visibilityChanged)
    visibilityChanged()
  }
  onScopeDispose(() => {
    disposed = true
    states.clear()
    entering.clear()
    annotations.clear()
    media?.removeEventListener?.('change', reduceChanged)
    if (typeof document !== 'undefined')
      document.removeEventListener('visibilitychange', visibilityChanged)
    controller.destroy()
  })
  function stabilizeAnimations() {
    if (sampling.state.value === 'pending') skipSignature = sampling.requestSignature.value
    if (controller.getActiveAnimationCount() || pendingFrom || sampling.state.value === 'pending')
      controller.finishAll()
  }
  function wrap<T extends object>(commands: T): T {
    return Object.fromEntries(
      Object.entries(commands).map(([key, value]) => [
        key,
        typeof value === 'function' && key !== 'getControlState'
          ? (...args: unknown[]) => {
              stabilizeAnimations()
              return value(...args)
            }
          : value,
      ]),
    ) as T
  }
  return {
    presentationTracks,
    presentationAnnotations,
    stabilizeAnimations,
    wrap,
    prepareExport: () => {
      exportSuppressed.value = true
      stabilizeAnimations()
    },
    releaseExport: () => {
      exportSuppressed.value = false
    },
  }
}
