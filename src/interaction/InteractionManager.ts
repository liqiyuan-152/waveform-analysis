import { pointer } from 'd3'
import { setSvgAttributes, svgNode } from '../rendering/SvgDom'
import type { TrackLayout } from '../components/core/types'
import type { ViewportSelectionState } from '../components/core/waveformChartTypes'
import { GestureViewport, type InteractionContext } from './InteractionContext'
import { WheelZoomController } from './WheelZoomController'
import { ViewportDragController } from './ViewportDragController'
import type { ResolvedWaveformChartProps } from '../types/options'
import { HoverController } from './HoverController'

interface OverlayBinding {
  node: SVGRectElement
  track?: TrackLayout
  release: () => void
}

/** Owns DOM bindings and input lifetimes; delegates gestures to dedicated state owners. */
export class InteractionManager {
  private readonly layer: SVGGElement
  private readonly selection: SVGRectElement
  private readonly viewport: GestureViewport
  private readonly wheel: WheelZoomController
  private readonly drag: ViewportDragController
  private readonly hover: HoverController
  private readonly bindings = new Map<string, OverlayBinding>()
  private spacePressed = false
  private annotationDragging = false
  private inside = false
  private disposed = false
  private signature = ''

  constructor(
    private readonly root: HTMLElement,
    svg: SVGSVGElement,
    private readonly context: InteractionContext,
  ) {
    this.layer = svgNode(svg.ownerDocument, 'g', { class: 'waveform-chart__interaction' })
    this.selection = svgNode(svg.ownerDocument, 'rect', { class: 'waveform-chart__zoom-selection' })
    this.selection.style.display = 'none'
    this.layer.append(this.selection)
    svg.insertBefore(this.layer, svg.querySelector('.waveform-chart__legends'))
    this.viewport = new GestureViewport(context)
    this.wheel = new WheelZoomController(this.viewport)
    this.drag = new ViewportDragController(this.viewport, (active) => this.paint(active))
    this.hover = new HoverController(
      root,
      svg,
      context,
      () => this.drag.isActive() || this.annotationDragging,
    )
    root.addEventListener('pointerenter', this.enter)
    root.addEventListener('pointerleave', this.leave)
    // Register an HTML listener region for platform wheel input in WebKit.
    root.addEventListener('wheel', this.wheelEvent, { passive: false })
    context.window.addEventListener('keydown', this.keyDown)
    context.window.addEventListener('keyup', this.keyUp)
    context.window.addEventListener('blur', this.blur)
    context.window.addEventListener('pointermove', this.move)
    context.window.addEventListener('pointerup', this.finish)
    context.window.addEventListener('pointercancel', this.cancelPointer)
  }

  private readonly enter = () => {
    this.inside = true
  }
  private readonly leave = () => {
    this.inside = false
    this.spacePressed = false
  }
  private readonly blur = () => {
    this.inside = false
    this.spacePressed = false
    this.cancel()
  }
  private readonly move = (event: PointerEvent) => this.drag.move(event)
  private readonly finish = (event: PointerEvent) => this.drag.move(event, true)
  private readonly cancelPointer = (event: PointerEvent) => this.drag.cancel(event)
  private readonly keyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') this.drag.cancel()
    if (event.code !== 'Space' || !this.inside || !this.viewport.enabled('pan')) return
    // Use the host document realm; iframe Elements do not share the global constructor.
    const target = event.target as Element | null
    if (
      target?.nodeType === 1 &&
      target.closest(
        'button, input, select, textarea, [contenteditable]:not([contenteditable="false"])',
      )
    )
      return
    this.spacePressed = true
    event.preventDefault()
  }
  private readonly keyUp = (event: KeyboardEvent) => {
    if (event.code === 'Space') this.spacePressed = false
  }

  private readonly wheelEvent = (event: WheelEvent) => {
    this.render()
    const target = event.target as Element | null
    const overlay = target?.nodeType === 1 ? target.closest('.waveform-chart__overlay') : null
    const binding = [...this.bindings.values()].find((item) => item.node === overlay)
    if (!binding) return
    this.hover.clear()
    if (!this.context.alive()) return
    const track = this.resolveTrack(binding, event)
    if (track) this.wheel.handle(event, binding.node, track)
  }

  private resolveTrack(binding: OverlayBinding, event: MouseEvent) {
    if (binding.track)
      return this.context.layout().trackLayouts.find((track) => track.id === binding.track!.id)
    const [x, y] = pointer(event, binding.node)
    const tracks = this.context.layout().trackLayouts
    return (
      tracks.find(
        (track) =>
          track.hasVisibleSeries &&
          x >= track.left &&
          x <= track.left + track.width &&
          y >= track.top &&
          y <= track.top + track.height,
      ) ?? tracks.find((track) => track.hasVisibleSeries)
    )
  }

  private bind(key: string) {
    const node = svgNode(this.layer.ownerDocument, 'rect', { class: 'waveform-chart__overlay' })
    const binding: OverlayBinding = { node, release: () => {} }
    const down = (event: PointerEvent) => {
      this.render()
      if (this.resolveTrack(binding, event)) {
        this.wheel.flush()
        this.wheel.cancel()
        if (!this.context.alive()) return
        const track = this.resolveTrack(binding, event)
        if (track) this.drag.begin(event, node, track, this.spacePressed)
      }
    }
    node.addEventListener('pointerdown', down)
    const leave = () => this.hover.clear()
    node.addEventListener('pointerleave', leave)
    node.addEventListener('lostpointercapture', this.cancelPointer)
    binding.release = () => {
      node.removeEventListener('pointerdown', down)
      node.removeEventListener('pointerleave', leave)
      node.removeEventListener('lostpointercapture', this.cancelPointer)
      node.remove()
    }
    this.bindings.set(key, binding)
    this.layer.insertBefore(node, this.selection)
    return binding
  }

  render() {
    if (this.disposed) return
    const layout = this.context.layout()
    const options = this.context.model.options.value
    const mode = this.context.model.presentation.mode(options)
    const signature = JSON.stringify([
      layout.page,
      layout.innerWidth,
      layout.innerHeight,
      options.displayMode,
      mode,
      options.zoomable,
      options.pannable,
      options.presentationMode,
      layout.trackLayouts.map((track) => [
        track.id,
        track.left,
        track.top,
        track.width,
        track.height,
        track.seriesList.map((series) => series.id),
      ]),
    ])
    if (this.signature && this.signature !== signature) this.cancel()
    this.signature = signature
    this.root.setAttribute('data-interaction-mode', mode)
    for (const value of ['zoom', 'pan', 'annotation', 'none'])
      this.root.classList.toggle(`waveform-chart--interaction-${value}`, mode === value)
    setSvgAttributes(this.layer, { transform: `translate(${layout.left},${layout.top})` })
    const tracks = layout.trackLayouts.filter((track) => track.hasVisibleSeries)
    const targets = this.viewport.independent
      ? tracks.map((track) => ({ key: track.id, track }))
      : tracks.length
        ? [{ key: 'shared', track: undefined }]
        : []
    const keys = new Set(targets.map((target) => target.key))
    for (const [key, binding] of this.bindings)
      if (!keys.has(key)) {
        binding.release()
        this.bindings.delete(key)
      }
    for (const [index, { key, track }] of targets.entries()) {
      const binding = this.bindings.get(key) ?? this.bind(key)
      binding.track = track
      setSvgAttributes(binding.node, {
        x: 0,
        y: 0,
        width: track?.width ?? layout.innerWidth,
        height: track?.height ?? layout.innerHeight,
        transform: `translate(${track?.left ?? 0},${track?.top ?? 0})`,
        class: `waveform-chart__overlay waveform-chart__overlay--${track ? 'independent' : 'shared'}${this.viewport.enabled('zoom') ? ' is-zoomable' : ''}`,
      })
      binding.node.classList.toggle(
        'is-annotating',
        mode === 'annotation' && !options.presentationMode,
      )
      if (track) binding.node.setAttribute('data-independent-overlay-index', String(track.index))
      const current = this.layer.children[index]
      if (current !== binding.node) this.layer.insertBefore(binding.node, current ?? this.selection)
    }
    this.hover.render()
  }

  private paint(active: ViewportSelectionState | null) {
    if (active) this.hover?.clear()
    this.root.classList.toggle('waveform-chart--panning', active?.kind === 'pan')
    this.selection.style.display = active?.kind === 'box' ? '' : 'none'
    if (!active || active.kind !== 'box') return
    const track = this.context
      .layout()
      .trackLayouts.find((item) => item.index === active.trackIndex)
    setSvgAttributes(this.selection, {
      x: Math.min(active.startX, active.currentX) + (active.independent ? (track?.left ?? 0) : 0),
      y: Math.min(active.startY, active.currentY) + (active.independent ? (track?.top ?? 0) : 0),
      width: Math.abs(active.currentX - active.startX),
      height: Math.abs(active.currentY - active.startY),
    })
  }

  cancel() {
    this.wheel.cancel()
    this.drag.cancel()
    this.hover.clear()
  }

  clearHover() {
    this.hover.clear()
  }

  blockAnnotationHover(active: boolean, cancelled = false) {
    if (!active && this.annotationDragging && !cancelled) this.hover.suppressNextMove()
    this.annotationDragging = active
    if (active) this.hover.clear()
  }

  pendingDomain(track: TrackLayout) {
    return this.wheel.pendingDomain(track)
  }

  rebindData(previous: ResolvedWaveformChartProps) {
    const options = this.context.model.options.value
    const keys = [
      'displayMode',
      'integerZoom',
      'interactionMode',
      'zoomable',
      'pannable',
      'presentationMode',
    ] as const
    if (keys.some((key) => previous[key] !== options[key])) {
      this.cancel()
      return
    }
    this.drag.cancel()
    this.hover.clear()
    this.wheel.rebindData()
    // Reordering or a new axis-label width is a data rebind, not a new gesture.
    this.signature = ''
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.cancel()
    this.hover.dispose()
    this.root.removeEventListener('pointerenter', this.enter)
    this.root.removeEventListener('pointerleave', this.leave)
    this.root.removeEventListener('wheel', this.wheelEvent)
    const { window } = this.context
    window.removeEventListener('keydown', this.keyDown)
    window.removeEventListener('keyup', this.keyUp)
    window.removeEventListener('blur', this.blur)
    window.removeEventListener('pointermove', this.move)
    window.removeEventListener('pointerup', this.finish)
    window.removeEventListener('pointercancel', this.cancelPointer)
    for (const binding of this.bindings.values()) binding.release()
    this.bindings.clear()
    this.layer.remove()
  }
}
