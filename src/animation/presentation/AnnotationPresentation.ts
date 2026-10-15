import type { RenderedAnnotation } from '../../annotation/types'
import type { ResolvedAnimationProps } from './config'
import type { WaveformAnnotation } from '@/types'
import type { AnnotationAnimationState } from '@/animation/types'
import { WaveformAnimationController } from '@/animation/WaveformAnimationController'

export interface PresentedAnnotation extends RenderedAnnotation {
  animationStyle?: AnnotationAnimationState
  leaving?: boolean
  seriesOpacity?: number
}
interface Entry {
  rendered: RenderedAnnotation
  style: AnnotationAnimationState
  leaving: boolean
  waiting: boolean
}

const finalStyle = () => ({ opacity: 1, scale: 1, offsetY: 0 })

/** Owns annotation style channels and immutable snapshots of departing annotations. */
export class AnnotationPresentation {
  private readonly entries = new Map<string, Entry>()
  private disposed = false
  private options!: ResolvedAnimationProps['animationAnnotation']
  constructor(
    private readonly controller: WaveformAnimationController,
    private readonly invalidate: () => void,
  ) {}
  private binding(id: string, entry: Entry) {
    return {
      read: () => entry.style,
      write: (style: AnnotationAnimationState) => {
        entry.style = style
        if (entry.leaving && style.opacity === 0 && this.entries.get(id) === entry)
          this.entries.delete(id)
        this.invalidate()
      },
    }
  }
  private appear(id: string, entry: Entry) {
    entry.waiting = false
    this.controller.animateAnnotationAppear(id, this.binding(id, entry), this.options)
  }
  reconcile(
    rendered: RenderedAnnotation[],
    controlled: WaveformAnnotation[],
    config: ResolvedAnimationProps['animationAnnotation'],
    enabled: boolean,
    waitingSeries: Set<string>,
  ) {
    if (this.disposed) return
    this.options = config
    const visible = new Set(rendered.map((item) => item.annotation.id))
    const existing = new Set(controlled.map((item) => item.id))
    for (const [id, entry] of this.entries)
      if (!visible.has(id) && (!entry.leaving || !enabled)) {
        if (!existing.has(id) && enabled) {
          entry.rendered = Object.freeze({
            ...entry.rendered,
            annotation: Object.freeze({
              ...entry.rendered.annotation,
              style: entry.rendered.annotation.style
                ? Object.freeze({ ...entry.rendered.annotation.style })
                : undefined,
            }),
            lines: Object.freeze([...entry.rendered.lines]) as unknown as string[],
            box: Object.freeze({ ...entry.rendered.box }),
            style: Object.freeze({ ...entry.rendered.style }),
          })
          entry.leaving = true
          entry.waiting = false
          this.controller.animateAnnotationDisappear(id, this.binding(id, entry), this.options)
          if (this.disposed) return
        } else {
          this.entries.delete(id)
          this.controller.cancel({ kind: 'annotation', id, scope: 'enter' })
          if (this.disposed) return
          this.controller.cancel({ kind: 'annotation', id, scope: 'leave' })
          if (this.disposed) return
        }
      }
    for (const item of rendered) {
      const id = item.annotation.id
      let entry = this.entries.get(id)
      if (entry && !entry.leaving) {
        entry.rendered = item
        continue
      }
      if (entry) {
        entry.leaving = false
        this.controller.cancel({ kind: 'annotation', id, scope: 'leave' })
        if (this.disposed) return
        entry.rendered = item
      } else {
        entry = {
          rendered: item,
          leaving: false,
          waiting: false,
          style: enabled
            ? {
                opacity: 0,
                scale: this.options.type === 'scale' || this.options.type === 'bounce' ? 0 : 1,
                offsetY: this.options.type === 'slide-in' ? 8 : 0,
              }
            : finalStyle(),
        }
        this.entries.set(id, entry)
      }
      if (enabled) {
        entry.waiting = waitingSeries.has(item.annotation.seriesId)
        if (!entry.waiting) this.appear(id, entry)
        if (this.disposed) return
      } else entry.style = finalStyle()
    }
    this.invalidate()
  }
  release(seriesId?: string) {
    if (this.disposed) return
    for (const [id, entry] of this.entries)
      if (entry.waiting && (!seriesId || entry.rendered.annotation.seriesId === seriesId)) {
        this.appear(id, entry)
        if (this.disposed) return
      }
    this.invalidate()
  }
  finish(rendered: RenderedAnnotation[]) {
    this.entries.clear()
    for (const item of rendered)
      this.entries.set(item.annotation.id, {
        rendered: item,
        style: finalStyle(),
        leaving: false,
        waiting: false,
      })
    this.invalidate()
  }
  project(
    rendered: RenderedAnnotation[],
    seriesOpacity: Map<string, number>,
  ): PresentedAnnotation[] {
    const current = new Map(rendered.map((item) => [item.annotation.id, item]))
    return [...this.entries.values()]
      .filter((entry) => entry.leaving || current.has(entry.rendered.annotation.id))
      .map((entry) => {
        if (!entry.leaving)
          entry.rendered = current.get(entry.rendered.annotation.id) ?? entry.rendered
        return {
          ...entry.rendered,
          animationStyle: entry.style,
          leaving: entry.leaving,
          seriesOpacity: seriesOpacity.get(entry.rendered.annotation.seriesId) ?? 1,
        }
      })
  }
  clear() {
    this.entries.clear()
    this.invalidate()
  }

  dispose() {
    this.disposed = true
    this.entries.clear()
  }
}
