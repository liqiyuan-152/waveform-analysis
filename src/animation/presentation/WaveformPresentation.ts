import { WaveformAnimationController } from '../WaveformAnimationController'
import type { WaveformAnimationControllerOptions } from '../types'
import type { ResolvedAnimationProps } from './config'
import { AnnotationPresentation } from './AnnotationPresentation'
import {
  staticTrack,
  transitionTrack,
  projectTrack,
  hasThirdGeometry,
  type TrackPresentation,
} from './trackPresentation'
import { chartExportOptions } from '../../components/controls/chartExportOptions'
import { layoutAnnotations } from '../../annotation/annotationLayout'
import {
  animationGridShape,
  animationLayoutSignature,
  type AnimationContext,
  type AnimationValueReader,
} from './context'
import { PaginationPresentation } from './PaginationPresentation'
import type { WaveformXAxisLabelFormatter } from '../../types/chart'

/** Framework-independent owner of track presentation and animation reconciliation. */
export class WaveformPresentation {
  private readonly states = new Map<string, TrackPresentation>()
  private readonly entering = new Set<string>()
  private readonly seen = new Set<string>()
  private clipSequence = 0
  private presentationGeneration = 0
  private previousGrid: string
  private previousAnnotations: AnimationContext['props']['annotations']
  private previousData: AnimationContext['props']['data']
  private previousLayout = ''
  private previousOptions = ''
  private previousXAxisFormatter?: WaveformXAxisLabelFormatter
  private previousSamplingSignature: string
  private previousSamplingState: AnimationContext['sampling']['state']['value']
  private pendingFrom?: Map<string, TrackPresentation>
  private skipSignature?: string
  private disposed = false
  readonly controller: WaveformAnimationController
  readonly pagination: PaginationPresentation
  private readonly annotations: AnnotationPresentation

  constructor(
    private readonly context: AnimationContext,
    private readonly config: AnimationValueReader<ResolvedAnimationProps>,
    private readonly effective: AnimationValueReader<boolean>,
    private readonly invalidate: () => void,
    private readonly prefix: string,
    animator?: WaveformAnimationControllerOptions['animator'],
  ) {
    this.previousGrid = animationGridShape(context)
    this.previousAnnotations = context.props.annotations
    this.previousData = context.props.data
    this.previousXAxisFormatter = context.props.axes?.x?.labelFormatter
    this.previousSamplingSignature = context.sampling.requestSignature.value
    this.previousSamplingState = context.sampling.state.value
    this.controller = new WaveformAnimationController({
      animator,
      commitFinalState: () => this.commit(),
    })
    this.annotations = new AnnotationPresentation(this.controller, invalidate)
    this.pagination = new PaginationPresentation(
      context,
      this.controller,
      config,
      effective,
      () => {
        this.commit(true)
        for (const track of context.tracks.value)
          for (const series of track.seriesList) this.seen.delete(series.id)
        this.skipSignature = undefined
        this.annotations.clear()
      },
    )
  }

  private visibleAnnotations() {
    const props = this.context.props
    return props.annotationsVisible && !props.cleanView ? props.annotations : []
  }

  presentationTracks() {
    const { tracks } = this.context

    return tracks.value.map((track) =>
      this.states.has(track.id) ? projectTrack(this.states.get(track.id)!) : track,
    )
  }

  private projectedAnnotations() {
    const anchors = new Map([...this.states.values()].flatMap((state) => [...state.anchors]))
    const values = this.visibleAnnotations().flatMap((annotation) => {
      const anchor = anchors.get(annotation.id)
      const target = [...this.states.values()].find((state) =>
        state.series.has(annotation.seriesId),
      )
      const domain = target?.target.xScale.domain()
      return anchor && domain && annotation.x >= domain[0] && annotation.x <= domain[1]
        ? [{ ...annotation, x: anchor.x, y: anchor.y }]
        : []
    })
    const annotationTracks = this.presentationTracks().flatMap((track) =>
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
      this.context.innerWidth.value,
      this.context.innerHeight.value,
    )
  }

  presentationAnnotations() {
    const opacities = new Map(
      [...this.states.values()].flatMap((state) =>
        [...state.series].map(([id, series]) => [id, series.opacity] as const),
      ),
    )
    return this.annotations.project(this.projectedAnnotations(), opacities)
  }

  private commit(preservePagination = false) {
    if (this.disposed) return
    const { tracks, sampling } = this.context

    this.presentationGeneration++
    if (!preservePagination) this.pagination.reset()
    const previous = new Map(this.states)
    this.states.clear()
    for (const track of tracks.value)
      this.states.set(
        track.id,
        staticTrack(track, this.visibleAnnotations(), previous.get(track.id), !!this.pendingFrom),
      )
    for (const track of tracks.value)
      if (track.width > 0 && track.height > 0) {
        for (const series of track.seriesList)
          if ((series.source?.length ?? series.points.length) > 0) this.seen.add(series.id)
      }
    this.entering.clear()
    this.pendingFrom = undefined
    this.skipSignature = sampling.requestSignature.value
    this.invalidate()
    this.annotations.finish(this.projectedAnnotations())
  }

  reconcile() {
    const { props, tracks, preparedSeries, sampling } = this.context

    if (this.disposed) return
    const nextConfig = this.config.value
    const dataChanged = props.data !== this.previousData
    // The post-flush grid watcher waits for lifecycle page resets before requesting replay.
    if (!dataChanged && this.seen.size && animationGridShape(this.context) !== this.previousGrid)
      return
    if (dataChanged) {
      this.pendingFrom = new Map(this.states)
      this.previousData = props.data
      for (const id of this.states.keys())
        this.controller.cancel({ kind: 'custom', id: `track:${id}`, scope: 'update' })
      if (this.disposed) return
      const interrupted = [...this.entering]
      for (const id of interrupted) this.controller.cancel({ kind: 'series', id, scope: 'enter' })
      if (this.disposed) return
      // Anchor updates and annotation styles are independent channels (CTL-06). An interrupted
      // enter no longer owns the wait; release after reconciling the new layout/configuration.
      queueMicrotask(() => {
        if (!this.disposed) interrupted.forEach((id) => this.annotations.release(id))
      })
      this.entering.clear()
    }
    const optionSignature = JSON.stringify(
      Object.fromEntries(
        Object.entries(chartExportOptions(props)).filter(
          ([key]) => !['annotations', 'annotationsVisible'].includes(key),
        ),
      ),
    )
    const layoutChanged =
      this.previousXAxisFormatter !== props.axes?.x?.labelFormatter ||
      (this.previousOptions !== '' && this.previousOptions !== optionSignature) ||
      (this.seen.size > 0 &&
        !dataChanged &&
        ((this.previousLayout !== '' &&
          this.previousLayout !== animationLayoutSignature(this.context)) ||
          (!this.pendingFrom &&
            this.previousSamplingState === 'success' &&
            sampling.requestSignature.value !== this.previousSamplingSignature)))
    this.previousOptions = optionSignature
    this.previousXAxisFormatter = props.axes?.x?.labelFormatter
    this.previousLayout = animationLayoutSignature(this.context)
    this.previousSamplingSignature = sampling.requestSignature.value
    this.previousSamplingState = sampling.state.value
    this.controller.setEnabled(this.effective.value)
    if (this.disposed) return
    const replay = this.pagination.reconcile(dataChanged)
    if (this.disposed) return
    if (replay === 'static') return
    if (!this.effective.value || (layoutChanged && !replay)) {
      this.controller.finishAll()
      this.commit()
      return
    }
    const stable = sampling.state.value !== 'pending' && this.context.layoutReady.value
    if (this.pendingFrom && !stable) return
    const canUpdate =
      this.pendingFrom &&
      sampling.state.value === 'success' &&
      this.skipSignature !== sampling.requestSignature.value &&
      nextConfig.animationUpdate.enabled
    const knownIds = new Set(
      preparedSeries.value.filter((series) => series.source.length > 0).map((series) => series.id),
    )
    for (const id of this.seen) if (!knownIds.has(id)) this.seen.delete(id)
    const visibleIds = tracks.value.flatMap((track) => track.seriesList.map((series) => series.id))
    const oldStates = this.pendingFrom ?? new Map(this.states)
    const live = new Set(tracks.value.map((track) => track.id))
    for (const id of this.states.keys()) if (!live.has(id)) this.states.delete(id)
    for (const track of tracks.value) {
      if (track.width <= 0 || track.height <= 0) {
        this.states.set(track.id, staticTrack(track, this.visibleAnnotations()))
        continue
      }
      const from = oldStates.get(track.id)
      const to = staticTrack(track, this.visibleAnnotations(), from, !!this.pendingFrom)
      if (this.pendingFrom) {
        this.states.set(track.id, to)
        if (canUpdate && from && !hasThirdGeometry(from)) {
          this.states.set(track.id, transitionTrack(from, to, 0, false))
          this.controller.animate(
            { kind: 'custom', id: `track:${track.id}`, scope: 'update' },
            {
              duration: nextConfig.animationUpdate.duration,
              easing: nextConfig.animationUpdate.easing,
              force: true,
              during: (p, frame) => {
                this.states.set(track.id, transitionTrack(from, to, p, frame.terminal))
                this.invalidate()
              },
              done: () =>
                track.seriesPaths.forEach(() => {
                  if (!this.disposed) nextConfig.animationUpdate.onComplete?.()
                }),
              aborted: () =>
                track.seriesPaths.forEach(() => {
                  if (!this.disposed) nextConfig.animationUpdate.onAbort?.()
                }),
            },
          )
          if (this.disposed) return
        }
      } else if (!this.states.has(track.id)) this.states.set(track.id, to)
      else if (!this.controller.getActiveAnimationCount()) this.states.set(track.id, to)
      for (const path of track.seriesPaths) {
        const id = path.series.id
        const hasPoints = (path.series.source?.length ?? path.series.points.length) > 0
        if (!hasPoints) {
          this.seen.delete(id)
          continue
        }
        if (!stable) {
          if (
            !this.seen.has(id) &&
            nextConfig.animation.enabled &&
            nextConfig.animation.duration > 0 &&
            this.skipSignature !== sampling.requestSignature.value
          ) {
            const state = this.states.get(track.id)!
            if (!state.clips.has(id))
              state.clips.set(id, {
                id: `${this.prefix}-${++this.clipSequence}`,
                x: 0,
                width: 0,
              })
          }
          continue
        }
        if (this.seen.has(id)) continue
        this.seen.add(id)
        if (
          !nextConfig.animation.enabled ||
          sampling.state.value !== 'success' ||
          this.skipSignature === sampling.requestSignature.value
        )
          continue
        const state = this.states.get(track.id)!
        const clip = { id: `${this.prefix}-${++this.clipSequence}`, x: 0, width: track.width }
        state.clips.set(id, clip)
        this.entering.add(id)
        const binding = {
          read: () => clip,
          write: (value: { x: number; width: number }) => {
            Object.assign(clip, value)
            this.invalidate()
          },
        }
        const generation = this.presentationGeneration
        this.controller.animateSeriesEnter(id, binding, track.width, {
          ...nextConfig.animation,
          duration: this.pagination.enterDuration(),
          delay:
            nextConfig.animation.delay + visibleIds.indexOf(id) * nextConfig.animation.staggerDelay,
          onComplete: () => {
            state.clips.delete(id)
            this.entering.delete(id)
            this.invalidate()
            queueMicrotask(() => {
              if (!this.disposed && this.presentationGeneration === generation)
                this.annotations.release(id)
            })
            nextConfig.animation.onComplete?.()
          },
          onAbort: () => {
            nextConfig.animation.onAbort?.()
          },
        })
        if (this.disposed) return
      }
    }
    if (props.annotations !== this.previousAnnotations) {
      for (const track of tracks.value) {
        const state = this.states.get(track.id)
        if (state) state.anchors = staticTrack(track, this.visibleAnnotations(), state).anchors
      }
      this.previousAnnotations = props.annotations
    }
    this.pendingFrom = undefined
    this.invalidate()
    if (!stable) return
    this.annotations.reconcile(
      this.projectedAnnotations(),
      props.annotations,
      nextConfig.animationAnnotation,
      nextConfig.animationAnnotation.enabled &&
        this.effective.value &&
        props.annotationsVisible &&
        !props.cleanView,
      this.entering,
    )
  }

  reconcileGrid(shape: string, data: unknown, previousShape: string, previousData: unknown) {
    this.previousGrid = shape
    if (this.disposed || shape === previousShape || data !== previousData || !this.seen.size) return
    this.pagination.requestLayout()
    this.reconcile()
  }

  hideAnnotations() {
    this.controller.finishWhere(
      (key) => key.kind === 'annotation' && ['enter', 'leave'].includes(key.scope),
      () => this.annotations.finish([]),
    )
  }

  disableEnter() {
    this.controller.finishWhere(
      (key) => key.kind === 'series' && key.scope === 'enter',
      () => {
        for (const state of this.states.values()) state.clips.clear()
        this.entering.clear()
        this.invalidate()
      },
    )
    this.annotations.release()
  }

  disableUpdate() {
    this.controller.finishWhere(
      (key) => key.scope === 'update' || key.scope === 'domain',
      () => {
        for (const track of this.context.tracks.value) {
          const old = this.states.get(track.id),
            next = staticTrack(track, this.visibleAnnotations(), old, true)
          if (old) next.clips = old.clips
          this.states.set(track.id, next)
        }
        this.invalidate()
      },
    )
  }

  disableAnnotation() {
    this.controller.finishWhere(
      (key) => key.kind === 'annotation' && ['enter', 'leave'].includes(key.scope),
      () => this.annotations.finish(this.projectedAnnotations()),
    )
  }

  stabilize() {
    const sampling = this.context.sampling
    if (sampling.state.value === 'pending') this.skipSignature = sampling.requestSignature.value
    if (
      this.controller.getActiveAnimationCount() ||
      this.pendingFrom ||
      this.pagination.active() ||
      sampling.state.value === 'pending'
    )
      this.controller.finishAll()
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.pagination.reset()
    this.states.clear()
    this.entering.clear()
    this.annotations.dispose()
    this.controller.destroy()
  }
}
