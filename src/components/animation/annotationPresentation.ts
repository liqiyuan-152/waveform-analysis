import type { RenderedAnnotation } from '../annotation/types'
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
export function createAnnotationPresentation(
  controller: WaveformAnimationController,
  invalidate: () => void,
) {
  const entries = new Map<string, Entry>()
  const finalStyle = () => ({ opacity: 1, scale: 1, offsetY: 0 })
  let options: ResolvedAnimationProps['animationAnnotation']
  const binding = (id: string, entry: Entry) => ({
    read: () => entry.style,
    write: (style: AnnotationAnimationState) => {
      entry.style = style
      if (entry.leaving && style.opacity === 0 && entries.get(id) === entry) entries.delete(id)
      invalidate()
    },
  })
  function appear(id: string, entry: Entry) {
    entry.waiting = false
    controller.animateAnnotationAppear(id, binding(id, entry), options)
  }
  return {
    reconcile(
      rendered: RenderedAnnotation[],
      controlled: WaveformAnnotation[],
      config: ResolvedAnimationProps['animationAnnotation'],
      enabled: boolean,
      waitingSeries: Set<string>,
    ) {
      options = config
      const visible = new Set(rendered.map((item) => item.annotation.id))
      const existing = new Set(controlled.map((item) => item.id))
      for (const [id, entry] of entries)
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
            controller.animateAnnotationDisappear(id, binding(id, entry), options)
          } else {
            entries.delete(id)
            controller.cancel({ kind: 'annotation', id, scope: 'enter' })
            controller.cancel({ kind: 'annotation', id, scope: 'leave' })
          }
        }
      for (const item of rendered) {
        const id = item.annotation.id
        let entry = entries.get(id)
        if (entry && !entry.leaving) {
          entry.rendered = item
          continue
        }
        if (entry) {
          entry.leaving = false
          controller.cancel({ kind: 'annotation', id, scope: 'leave' })
          entry.rendered = item
        } else {
          entry = {
            rendered: item,
            leaving: false,
            waiting: false,
            style: enabled
              ? {
                  opacity: 0,
                  scale: options.type === 'scale' || options.type === 'bounce' ? 0 : 1,
                  offsetY: options.type === 'slide-in' ? 8 : 0,
                }
              : finalStyle(),
          }
          entries.set(id, entry)
        }
        if (enabled) {
          entry.waiting = waitingSeries.has(item.annotation.seriesId)
          if (!entry.waiting) appear(id, entry)
        } else entry.style = finalStyle()
      }
      invalidate()
    },
    release(seriesId?: string) {
      for (const [id, entry] of entries)
        if (entry.waiting && (!seriesId || entry.rendered.annotation.seriesId === seriesId))
          appear(id, entry)
      invalidate()
    },
    finish(rendered: RenderedAnnotation[]) {
      entries.clear()
      for (const item of rendered)
        entries.set(item.annotation.id, {
          rendered: item,
          style: finalStyle(),
          leaving: false,
          waiting: false,
        })
      invalidate()
    },
    project(
      rendered: RenderedAnnotation[],
      seriesOpacity: Map<string, number>,
    ): PresentedAnnotation[] {
      const current = new Map(rendered.map((item) => [item.annotation.id, item]))
      return [...entries.values()]
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
    },
    clear() {
      entries.clear()
      invalidate()
    },
  }
}
