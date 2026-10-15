import { pointer } from 'd3'
import type { TrackLayout } from '../components/core/types'
import { WHEEL_ZOOM_DEBOUNCE_MS } from '../components/core/constants'
import { resolveStepZoomDomain, sameZoomDomain } from '../components/interaction/stepZoom'
import { GestureViewport, type Domain } from './InteractionContext'
import { seriesIdentity } from '../components/interaction/zoomEventPayload'

/** Coalesces commits per host frame and emits one end per wheel burst/track. */
export class WheelZoomController {
  private readonly pending = new Map<string, Domain>()
  private readonly ended = new Set<string>()
  private frame?: number
  private timer?: number
  private generation = 0

  constructor(private readonly viewport: GestureViewport) {}

  handle(event: WheelEvent, overlay: SVGRectElement, track: TrackLayout) {
    if (!this.viewport.enabled('zoom') || !Number.isFinite(event.deltaY) || !event.deltaY) return
    const { context } = this.viewport
    const generation = this.generation
    context.stabilize()
    if (!context.alive() || generation !== this.generation) return
    const key = this.identity(track)
    const current = this.pending.get(key) ?? (track.xScale.domain() as Domain)
    const width = this.viewport.independent ? track.width : context.layout().innerWidth
    if (width <= 0) return
    const next = resolveStepZoomDomain(
      current,
      event.deltaY < 0 ? 'zoom-in' : 'zoom-out',
      this.viewport.boundary(track),
      this.viewport.tracks(track).map((item) => item.seriesList),
      context.model.options.value,
      pointer(event, overlay)[0] / width,
    )
    if (sameZoomDomain(current, next)) return
    event.preventDefault()
    event.stopImmediatePropagation()
    this.pending.set(key, next)
    context.events.emit('zoom-intent', {
      start: next[0],
      end: next[1],
      ...this.viewport.identity(track),
      gesture: 'wheel',
    })
    if (!context.alive() || generation !== this.generation || !this.pending.has(key)) return
    if (this.frame === undefined)
      this.frame = this.requestFrame(() => {
        this.frame = undefined
        this.flush()
      })
    if (this.timer !== undefined) context.window.clearTimeout(this.timer)
    this.timer = context.window.setTimeout(() => {
      this.timer = undefined
      this.flush()
      if (!context.alive() || generation !== this.generation) return
      const identities = [...this.ended]
      this.ended.clear()
      for (const identity of identities) {
        if (!context.alive() || generation !== this.generation) break
        const track = context.layout().trackLayouts.find((item) => this.identity(item) === identity)
        if (track)
          context.events.emit(
            'zoom-end',
            this.viewport.endPayload(track, track.xScale.domain() as Domain, 'wheel'),
          )
      }
    }, WHEEL_ZOOM_DEBOUNCE_MS)
  }

  flush() {
    const { context } = this.viewport
    if (this.frame !== undefined) this.cancelFrame(this.frame)
    this.frame = undefined
    const changes = [...this.pending]
    this.pending.clear()
    const generation = this.generation
    const notifications: string[] = []
    for (const [key, domain] of changes) {
      if (!context.alive() || generation !== this.generation) break
      const track = context.layout().trackLayouts.find((item) => this.identity(item) === key)
      if (!track || !this.viewport.enabled('zoom')) continue
      this.viewport.set(track, domain)
      this.ended.add(key)
      notifications.push(key)
    }
    // Commit the whole frame before reentrant consumers can replace data. A later
    // notification reads the latest restored domain instead of writing an old one back.
    for (const key of notifications) {
      if (!context.alive() || generation !== this.generation) break
      const track = context.layout().trackLayouts.find((item) => this.identity(item) === key)
      if (track) context.events.emit('zoom-change', track.xScale.domain() as Domain)
    }
  }

  cancel() {
    this.generation++
    const { window } = this.viewport.context
    if (this.frame !== undefined) this.cancelFrame(this.frame)
    if (this.timer !== undefined) window.clearTimeout(this.timer)
    this.frame = this.timer = undefined
    this.pending.clear()
    this.ended.clear()
  }

  pendingDomain(track: TrackLayout) {
    const domain = this.pending.get(this.identity(track))
    return domain ? ([...domain] as Domain) : undefined
  }

  rebindData() {
    const tracks = this.viewport.context.layout().trackLayouts
    for (const key of new Set([...this.pending.keys(), ...this.ended])) {
      const track = tracks.find((item) => this.identity(item) === key && item.hasVisibleSeries)
      if (!track) {
        this.pending.delete(key)
        this.ended.delete(key)
      } else if (this.pending.has(key)) this.pending.set(key, track.xScale.domain() as Domain)
    }
  }

  private identity(track: TrackLayout) {
    return this.viewport.independent
      ? seriesIdentity(track.seriesList.map((series) => series.id))
      : 'shared'
  }

  private requestFrame(callback: () => void) {
    const { window } = this.viewport.context
    return window.requestAnimationFrame
      ? window.requestAnimationFrame(callback)
      : window.setTimeout(callback, 16)
  }

  private cancelFrame(handle: number) {
    const { window } = this.viewport.context
    if (window.cancelAnimationFrame) window.cancelAnimationFrame(handle)
    else window.clearTimeout(handle)
  }
}
