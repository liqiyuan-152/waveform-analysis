import type { WaveformAnnotation } from '../types/chart'
import type { ChartEventEmitter } from '../chart/ChartEventEmitter'
import { isFiniteAnnotation, ANNOTATION_MAX_TEXT_LENGTH } from './markup'

export function copyAnnotation(annotation: WaveformAnnotation): WaveformAnnotation {
  return { ...annotation, ...(annotation.style && { style: { ...annotation.style } }) }
}

/** The host owns committed annotations. Every request and event is an isolated snapshot. */
export class AnnotationModel {
  constructor(
    private readonly read: () => readonly WaveformAnnotation[],
    private readonly events: ChartEventEmitter,
    private readonly alive: () => boolean,
  ) {}

  snapshot() {
    return this.read().map(copyAnnotation)
  }

  find(id: string) {
    const annotation = this.read().find((item) => item.id === id)
    return annotation && copyAnnotation(annotation)
  }

  private valid(annotation: WaveformAnnotation) {
    return isFiniteAnnotation(annotation) && annotation.text.length <= ANNOTATION_MAX_TEXT_LENGTH
  }

  create(annotation: WaveformAnnotation) {
    if (!this.alive() || !this.valid(annotation) || this.find(annotation.id)) return false
    const created = copyAnnotation(annotation)
    this.events.emit('update:annotations', [...this.snapshot(), copyAnnotation(created)])
    if (this.alive()) this.events.emit('annotation-create', created)
    return true
  }

  update(annotation: WaveformAnnotation, previous = this.find(annotation.id)) {
    if (!this.alive() || !this.valid(annotation) || !previous || !this.find(annotation.id))
      return false
    const updated = copyAnnotation(annotation)
    const before = copyAnnotation(previous)
    const replacement = this.snapshot().map((item) =>
      item.id === updated.id ? copyAnnotation(updated) : item,
    )
    this.events.emit('update:annotations', replacement)
    if (this.alive()) this.events.emit('annotation-update', updated, before)
    return true
  }

  delete(id: string) {
    if (!this.alive()) return false
    const previous = this.find(id)
    if (!previous) return false
    this.events.emit(
      'update:annotations',
      this.snapshot().filter((item) => item.id !== id),
    )
    if (this.alive()) this.events.emit('annotation-delete', previous)
    return true
  }

  move(id: string, x: number, y: number) {
    if (!this.alive() || !Number.isFinite(x) || !Number.isFinite(y)) return false
    if (!this.find(id)) return false
    this.events.emit(
      'update:annotations',
      this.snapshot().map((item) =>
        item.id === id ? { ...item, labelOffsetX: x, labelOffsetY: y } : item,
      ),
    )
    return true
  }
}
