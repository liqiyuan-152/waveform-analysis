import { pointer } from 'd3'
import type { TrackLayout, WaveformHoverState } from '../components/core/types'
import { HoverView } from '../view/HoverView'
import { TooltipView } from '../view/TooltipView'
import type { InteractionContext } from './InteractionContext'
import { crosshairXForTrack, nearestHoverPoint } from './hoverQuery'

/** One owner-window frame coalesces pointer input without creating a business revision. */
export class HoverController {
  private readonly view: HoverView
  private readonly tooltip: TooltipView
  private frame?: number
  private generation = 0
  private state?: WaveformHoverState
  private disposed = false
  private suppressMove = false

  constructor(
    private readonly root: HTMLElement,
    svg: SVGSVGElement,
    private readonly context: InteractionContext,
    private readonly blocked: () => boolean,
  ) {
    this.view = new HoverView(svg)
    this.tooltip = new TooltipView(root)
    root.addEventListener('pointermove', this.move)
    root.addEventListener('pointerout', this.out)
    root.addEventListener('pointerleave', this.leave)
    root.addEventListener('pointercancel', this.leave)
    root.addEventListener('scroll', this.scroll)
  }

  private overlay(event: PointerEvent) {
    const target = event.target as Element | null
    const node = target?.nodeType === 1 ? target.closest('.waveform-chart__overlay') : null
    return node && this.root.contains(node) ? (node as SVGRectElement) : undefined
  }

  private readonly out = (event: PointerEvent) => {
    if (this.overlay(event)) this.clear()
  }
  private readonly leave = () => this.clear()
  private readonly scroll = () => {
    this.root.style.setProperty('--waveform-scroll-left', `${this.root.scrollLeft}px`)
    this.clear()
  }
  private readonly move = (event: PointerEvent) => {
    if (this.disposed || !this.context.alive() || this.blocked()) return
    if (this.context.model.options.value.presentationMode) return
    const overlay = this.overlay(event)
    if (!overlay) return
    if (this.suppressMove) {
      this.suppressMove = false
      return
    }
    const before = this.generation
    if (
      this.context.model.options.value.animationUpdate?.animateViewport !== true ||
      event.buttons !== 0
    )
      this.context.stabilize()
    if (!this.context.alive() || before !== this.generation) return
    const layout = this.context.layout()
    const independent = this.context.model.options.value.displayMode === 'independent'
    const [x, y] = pointer(event, overlay)
    const track = independent
      ? layout.trackLayouts.find(
          (item) => item.index === Number(overlay.dataset.independentOverlayIndex),
        )
      : (layout.trackLayouts.find(
          (item) =>
            item.hasVisibleSeries &&
            x >= item.left &&
            x <= item.left + item.width &&
            y >= item.top &&
            y <= item.top + item.height,
        ) ?? layout.trackLayouts.find((item) => item.hasVisibleSeries))
    if (!track?.hasVisibleSeries) return
    const queryX = track.xScale.invert(
      Math.max(0, Math.min(track.width, independent ? x : x - track.left)),
    )
    const tracks = independent ? [track] : layout.trackLayouts
    const generation = ++this.generation
    if (this.frame !== undefined) this.context.window.cancelAnimationFrame(this.frame)
    this.frame = this.context.window.requestAnimationFrame(() => {
      if (generation !== this.generation) return
      this.frame = undefined
      if (
        this.disposed ||
        !this.context.alive() ||
        this.blocked() ||
        generation !== this.generation ||
        layout !== this.context.layout()
      )
        return
      this.state = {
        points: tracks.flatMap((item) => this.points(item, queryX)),
        trackIndex: independent ? track.index : null,
        queryX,
        crosshairXByTrack: Object.fromEntries(
          tracks.flatMap((item) => {
            const value = crosshairXForTrack(item, queryX)
            return value === undefined ? [] : [[item.index, value]]
          }),
        ),
        position: {
          x: layout.left + (independent ? track.left : 0) + x,
          y: layout.top + (independent ? track.top : 0) + y,
        },
      }
      this.render()
      const point = this.state.points.find((item) => item.point)?.point
      this.context.events.emit('point-hover', point ? { ...point } : null)
    })
  }

  private points(track: TrackLayout, x: number) {
    return track.seriesList.map((series) => {
      const point = nearestHoverPoint(series, x)
      return {
        id: series.id,
        shotNo: series.shotNo,
        name: series.name,
        color: series.color,
        unit: series.unit,
        trackIndex: track.index,
        point: point ? { ...point } : null,
      }
    })
  }

  render() {
    if (this.disposed) return
    const layout = this.context.layout()
    const options = this.context.model.options.value
    const state = options.showTooltip && !options.presentationMode ? this.state : undefined
    this.view.render(state, layout.trackLayouts, layout.left, layout.top)
    this.tooltip.render(
      state
        ? { ...state, position: { ...state.position, x: state.position.x - this.root.scrollLeft } }
        : undefined,
      options.timeUnit,
      layout.width,
      layout.height,
    )
  }

  clear() {
    if (this.disposed) return
    const active = this.state !== undefined || this.frame !== undefined
    this.generation++
    if (this.frame !== undefined) this.context.window.cancelAnimationFrame(this.frame)
    this.frame = undefined
    this.state = undefined
    this.view.render(undefined, [])
    this.tooltip.render(undefined, 's', 0, 0)
    if (active && this.context.alive()) this.context.events.emit('point-hover', null)
  }

  suppressNextMove() {
    this.suppressMove = true
  }

  dispose() {
    if (this.disposed) return
    this.clear()
    this.disposed = true
    this.root.removeEventListener('pointermove', this.move)
    this.root.removeEventListener('pointerout', this.out)
    this.root.removeEventListener('pointerleave', this.leave)
    this.root.removeEventListener('pointercancel', this.leave)
    this.root.removeEventListener('scroll', this.scroll)
    this.view.dispose()
    this.tooltip.dispose()
  }
}
