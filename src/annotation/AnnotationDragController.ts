import type { WaveformAnnotation } from '../types/chart'

interface Offset {
  x: number
  y: number
}
interface Drag {
  id: string
  node: SVGGElement
  pointerId: number
  start: Offset
  base: Offset
  prior: Offset
  delta: Offset
}

/** Pointer-capture lifetime and transient label preview; committed values stay host-owned. */
export class AnnotationDragController {
  readonly offsets = new Map<string, Offset>()
  private readonly pending = new Map<string, Offset>()
  private active?: Drag
  private frame?: number
  private generation = 0
  private lastEnd?: number
  private disposed = false

  constructor(
    private readonly window: Window,
    private readonly repaint: () => void,
    private readonly commit: (id: string, x: number, y: number) => void,
    private readonly blockHover: (active: boolean, cancelled?: boolean) => void,
  ) {
    window.addEventListener('pointermove', this.move)
    window.addEventListener('pointerup', this.finish)
    window.addEventListener('pointercancel', this.cancelPointer)
    window.addEventListener('blur', this.cancelEvent)
    window.addEventListener('keydown', this.keyDown)
  }

  begin(annotation: WaveformAnnotation, node: SVGGElement, event: PointerEvent) {
    if (this.disposed || this.active || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const prior = this.offsets.get(annotation.id) ?? { x: 0, y: 0 }
    this.active = {
      id: annotation.id,
      node,
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      base: {
        x: (Number.isFinite(annotation.labelOffsetX) ? annotation.labelOffsetX! : 0) + prior.x,
        y: (Number.isFinite(annotation.labelOffsetY) ? annotation.labelOffsetY! : 0) + prior.y,
      },
      prior,
      delta: { x: 0, y: 0 },
    }
    node.addEventListener('lostpointercapture', this.cancelPointer)
    // Window listeners also support browsers without capture and captured pointers leaving SVG.
    try {
      node.setPointerCapture?.(event.pointerId)
    } catch {
      /* Synthetic/expired pointer. */
    }
    this.blockHover(true)
  }

  private readonly move = (event: PointerEvent) => {
    const active = this.active
    if (!active || active.pointerId !== event.pointerId) return
    active.delta = { x: event.clientX - active.start.x, y: event.clientY - active.start.y }
    if (this.frame !== undefined) return
    const generation = this.generation
    this.frame = this.window.requestAnimationFrame(() => {
      if (generation !== this.generation || this.disposed) return
      this.frame = undefined
      if (!this.active) return
      const { prior, delta, id } = this.active
      this.offsets.set(id, { x: prior.x + delta.x, y: prior.y + delta.y })
      this.repaint()
    })
  }

  private release(active: Drag, cancelled = false) {
    this.active = undefined
    this.generation++
    if (this.frame !== undefined) this.window.cancelAnimationFrame(this.frame)
    this.frame = undefined
    active.node.removeEventListener('lostpointercapture', this.cancelPointer)
    if (active.node.hasPointerCapture?.(active.pointerId))
      active.node.releasePointerCapture(active.pointerId)
    this.blockHover(false, cancelled)
  }

  private readonly finish = (event: PointerEvent) => {
    const active = this.active
    if (!active || active.pointerId !== event.pointerId) return
    event.preventDefault()
    const x = event.clientX - active.start.x,
      y = event.clientY - active.start.y
    const moved = Math.hypot(x, y) >= 2
    if (moved) {
      this.offsets.set(active.id, { x: active.prior.x + x, y: active.prior.y + y })
      this.pending.set(active.id, { x: active.base.x + x, y: active.base.y + y })
      this.lastEnd = event.timeStamp
    } else this.offsets.set(active.id, active.prior)
    // End the gesture before callbacks; synchronous host acknowledgement must clear the preview.
    this.release(active)
    if (moved) this.commit(active.id, active.base.x + x, active.base.y + y)
    if (!this.disposed) this.repaint()
  }

  private readonly cancelPointer = (event: PointerEvent) => {
    if (this.active?.pointerId === event.pointerId) this.cancel()
  }
  private readonly cancelEvent = () => this.cancel()
  private readonly keyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') this.cancel()
  }

  reconcile(annotations: readonly WaveformAnnotation[]) {
    const ids = new Set(annotations.map((item) => item.id))
    if (this.active && !ids.has(this.active.id)) this.cancel()
    for (const id of this.offsets.keys())
      if (!ids.has(id)) {
        this.offsets.delete(id)
        this.pending.delete(id)
      }
    for (const annotation of annotations) {
      const expected = this.pending.get(annotation.id)
      if (
        expected &&
        (annotation.labelOffsetX ?? 0) === expected.x &&
        (annotation.labelOffsetY ?? 0) === expected.y
      ) {
        this.offsets.delete(annotation.id)
        this.pending.delete(annotation.id)
      }
    }
  }

  suppressMenu(event: MouseEvent) {
    return (
      this.active !== undefined ||
      (this.lastEnd !== undefined && event.timeStamp - this.lastEnd < 100)
    )
  }

  cancel() {
    const active = this.active
    if (!active) return
    this.offsets.set(active.id, active.prior)
    this.release(active, true)
    if (!this.disposed) this.repaint()
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.cancel()
    this.window.removeEventListener('pointermove', this.move)
    this.window.removeEventListener('pointerup', this.finish)
    this.window.removeEventListener('pointercancel', this.cancelPointer)
    this.window.removeEventListener('blur', this.cancelEvent)
    this.window.removeEventListener('keydown', this.keyDown)
    this.offsets.clear()
    this.pending.clear()
  }
}
