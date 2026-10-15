import { pointer } from 'd3'
import type { TrackLayout } from '../components/core/types'
import type { ViewportSelectionState } from '../components/core/waveformChartTypes'
import { MINIMUM_SELECTION_SIZE } from '../components/core/constants'
import { hasFixedYDomainForTrack } from '../components/core/yDomain'
import { transitionViewportInteraction } from '../components/interaction/viewportInteractionState'
import { tryReleasePointerCapture } from '../components/interaction/pointerCapture'
import { alignIntegerPanDomain } from '../components/interaction/integerZoom'
import {
  clampViewportDomain,
  constrainViewportZoom,
  remotePanBoundary,
} from '../components/interaction/remoteViewport'
import { sameZoomDomain } from '../components/interaction/stepZoom'
import { GestureViewport, type Domain } from './InteractionContext'

/** One pointer owns a drag; a cancellation never synthesizes a completed gesture. */
export class ViewportDragController {
  private active: ViewportSelectionState | null = null
  private overlay?: SVGRectElement
  private trackId?: string
  private generation = 0

  constructor(
    private readonly viewport: GestureViewport,
    private readonly paint: (selection: ViewportSelectionState | null) => void,
  ) {}

  isActive() {
    return this.active !== null
  }

  begin(event: PointerEvent, overlay: SVGRectElement, track: TrackLayout, spacePressed: boolean) {
    if (this.active || event.button !== 0 || !track.hasVisibleSeries) return
    const { context } = this.viewport
    const options = context.model.options.value
    const mode = context.model.presentation.mode(options)
    const pan =
      this.viewport.enabled('pan') && (mode === 'pan' || (mode === 'zoom' && spacePressed))
    if (!pan && !this.viewport.enabled('zoom')) return
    const generation = this.generation
    context.stabilize()
    if (!context.alive() || generation !== this.generation) return
    const [startX, startY] = this.position(event, overlay, track)
    this.active = transitionViewportInteraction(null, {
      type: 'begin',
      gesture: {
        trackIndex: track.index,
        independent: this.viewport.independent,
        startX,
        startY,
        pointerId: event.pointerId,
        kind: pan ? 'pan' : 'box',
        xDomain: track.xScale.domain() as Domain,
        yDomains: Object.fromEntries(
          this.viewport
            .tracks(track)
            .map((item) => [
              item.series?.trackId ?? item.series?.id ?? item.id,
              item.yScale.domain() as Domain,
            ]),
        ),
      },
    }).state
    this.overlay = overlay
    this.trackId = track.id
    try {
      overlay.setPointerCapture?.(event.pointerId)
    } catch {
      // Detached/unavailable capture is covered by the owner-window fallback listeners.
    }
    this.paint(this.active)
    event.preventDefault()
  }

  private position(event: PointerEvent, overlay: SVGRectElement, track: TrackLayout) {
    const layout = this.viewport.context.layout()
    const [x, y] = pointer(event, overlay)
    return [
      Math.max(0, Math.min(this.viewport.independent ? track.width : layout.innerWidth, x)),
      Math.max(0, Math.min(this.viewport.independent ? track.height : layout.innerHeight, y)),
    ]
  }

  move(event: PointerEvent, finish = false) {
    const active = this.active
    if (!active || active.pointerId !== event.pointerId || !this.overlay) return
    const { context } = this.viewport
    const track = context.layout().trackLayouts.find((item) => item.id === this.trackId)
    if (!track || !this.overlay.parentNode || !context.alive()) {
      this.cancel()
      return
    }
    const [currentX, currentY] = this.position(event, this.overlay, track)
    const transition = transitionViewportInteraction(active, {
      type: finish ? 'finish' : 'move',
      pointerId: event.pointerId,
      position: { currentX, currentY },
    })
    const next = finish ? transition.completed : transition.state
    if (!next) return
    this.active = transition.state
    if (finish) this.release(next.pointerId)
    this.paint(this.active)
    event.preventDefault()
    const generation = this.generation
    if (next.kind === 'pan') {
      const domain = this.pan(next, track)
      if (
        finish &&
        context.alive() &&
        generation === this.generation &&
        !sameZoomDomain(domain, next.xDomain)
      )
        context.events.emit('pan-end', {
          start: domain[0],
          end: domain[1],
          ...this.viewport.identity(track),
        })
    } else if (finish) this.box(next, track)
  }

  private box(active: ViewportSelectionState, track: TrackLayout) {
    const offset = active.independent ? 0 : track.left
    const left = Math.max(
      0,
      Math.min(track.width, Math.min(active.startX, active.currentX) - offset),
    )
    const right = Math.max(
      0,
      Math.min(track.width, Math.max(active.startX, active.currentX) - offset),
    )
    if (right - left < MINIMUM_SELECTION_SIZE) return
    const { context } = this.viewport
    const domain = constrainViewportZoom(
      [track.xScale.invert(left), track.xScale.invert(right)],
      this.viewport.boundary(track),
      this.viewport.tracks(track).map((item) => item.seriesList),
      context.model.options.value,
    )
    if (sameZoomDomain(track.xScale.domain() as Domain, domain)) return
    this.viewport.set(track, domain)
    const current = context.layout().trackLayouts.find((item) => item.id === track.id)!
    const payload = this.viewport.endPayload(current, domain, 'box')
    const generation = this.generation
    context.events.emit('zoom-intent', {
      start: domain[0],
      end: domain[1],
      ...this.viewport.identity(current),
      gesture: 'box',
    })
    if (!context.alive() || generation !== this.generation) return
    context.events.emit('zoom-change', [...domain])
    if (!context.alive() || generation !== this.generation) return
    context.events.emit('zoom-end', payload)
  }

  private pan(active: ViewportSelectionState, track: TrackLayout): Domain {
    const { context } = this.viewport
    const options = context.model.options.value
    const remote = remotePanBoundary(options)
    const boundary = remote ?? this.viewport.boundary(track)
    const dx = active.currentX - active.startX
    const dy = active.currentY - active.startY
    const span = active.xDomain[1] - active.xDomain[0]
    const shift = (dx / (track.width || 1)) * span
    const domain = clampViewportDomain(
      alignIntegerPanDomain(
        clampViewportDomain([active.xDomain[0] - shift, active.xDomain[1] - shift], boundary),
        options,
      ),
      boundary,
    )
    const yDomains = context.model.viewport.get(this.viewport.key(track))?.yDomains ?? {}
    if (!remote) {
      const layout = context.layout()
      for (const target of this.viewport.tracks(track)) {
        const sourceTrack = layout.tracks.find((item) => item.id === target.id)
        if (sourceTrack && hasFixedYDomainForTrack(sourceTrack, options.yDomain, options.yDomains))
          continue
        const key = target.series?.trackId ?? target.series?.id ?? target.id
        const source = active.yDomains[key] ?? (target.yScale.domain() as Domain)
        const yShift = (dy / (track.height || 1)) * (source[1] - source[0])
        yDomains[key] = clampViewportDomain(
          [source[0] + yShift, source[1] + yShift],
          sourceTrack?.yDomain ?? source,
        )
      }
    }
    this.viewport.set(track, domain, yDomains)
    context.events.emit('zoom-change', [...domain])
    return domain
  }

  cancel(event?: PointerEvent) {
    if (event && event.pointerId !== this.active?.pointerId) return
    this.generation++
    this.release()
    this.active = null
    this.paint(null)
  }

  private release(pointerId = this.active?.pointerId) {
    // Clear references first: releasing capture can synchronously dispatch lostpointercapture.
    const overlay = this.overlay
    this.overlay = undefined
    this.trackId = undefined
    if (pointerId !== undefined) tryReleasePointerCapture(overlay, pointerId)
  }
}
