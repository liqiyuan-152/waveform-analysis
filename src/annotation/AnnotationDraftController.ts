import type { DisplaySeries } from '../components/core/types'
import type { WaveformAnnotation } from '../types/chart'
import { copyAnnotation } from './AnnotationModel'
import type {
  AnnotationEditorDraft,
  AnnotationEditorAnchor,
  AnnotationSeriesCandidate,
} from './types'

/** Owns one editable draft; snapping always resolves the latest full series source. */
export class AnnotationDraftController {
  current?: AnnotationEditorDraft
  private options: AnnotationSeriesCandidate[] = []
  error = ''

  constructor(
    private readonly series: () => DisplaySeries[],
    private readonly timeUnit: () => 's' | 'ms',
  ) {}

  snapshot(): AnnotationEditorDraft | undefined {
    if (!this.current) return undefined
    const draft = {
      ...this.current,
      annotation: copyAnnotation(this.current.annotation),
      anchor: { ...this.current.anchor },
    }
    return draft.mode === 'edit' ? { ...draft, previous: copyAnnotation(draft.previous) } : draft
  }
  candidates() {
    return this.options.map((item) => ({ ...item, point: { ...item.point } }))
  }

  retainCandidates(ids: ReadonlySet<string>) {
    this.options = this.options.filter((item) => ids.has(item.seriesId))
  }

  create(
    hit: AnnotationSeriesCandidate,
    id: string,
    anchor: AnnotationEditorAnchor,
    candidates: AnnotationSeriesCandidate[],
  ) {
    this.current = {
      mode: 'add',
      anchor: { ...anchor },
      annotation: {
        id,
        seriesId: hit.seriesId,
        x: hit.point.x,
        y: hit.point.y,
        text: '',
        createdAt: new Date().toISOString(),
        style: {
          borderColor: hit.color,
          textColor: '#333333',
          backgroundColor: 'rgba(255, 255, 255, 0.92)',
        },
      },
    }
    this.options = candidates.map((item) => ({ ...item, point: { ...item.point } }))
    this.error = ''
  }

  edit(
    annotation: WaveformAnnotation,
    anchor: AnnotationEditorAnchor,
    candidates: AnnotationSeriesCandidate[],
  ) {
    this.current = {
      mode: 'edit',
      annotation: copyAnnotation(annotation),
      previous: copyAnnotation(annotation),
      anchor: { ...anchor },
    }
    this.options = candidates.map((item) => ({ ...item, point: { ...item.point } }))
    this.error = ''
  }

  private point(seriesId: string, x: number) {
    const source = this.series().find((item) => item.id === seriesId)?.source
    const first = source?.pointAt(0),
      last = source?.pointAt((source?.length ?? 0) - 1)
    if (!source || !first || !last) {
      this.error = '当前波形没有有效数据'
      return
    }
    if (x < first.x || x > last.x) {
      this.error = '时间超出当前波形范围'
      return
    }
    this.error = ''
    return source.nearestPoint(x)
  }

  changeTime(displayValue: string) {
    if (!this.current || !displayValue.trim() || !Number.isFinite(Number(displayValue)))
      return (this.error = '请输入有效的时间')
    const x = Number(displayValue) / (this.timeUnit() === 'ms' ? 1000 : 1)
    const point = this.point(this.current.annotation.seriesId, x)
    if (point) this.current.annotation = { ...this.current.annotation, x: point.x, y: point.y }
    return this.error
  }

  changeSeries(id: string) {
    const draft = this.current,
      candidate = this.options.find((item) => item.seriesId === id)
    if (!draft || !candidate) return (this.error = '当前波形没有有效数据')
    const point = this.point(id, draft.annotation.x)
    if (point)
      this.current!.annotation = {
        ...draft.annotation,
        seriesId: id,
        y: point.y,
        style: { ...draft.annotation.style, borderColor: candidate.color },
      }
    return this.error
  }

  close() {
    this.current = undefined
    this.options = []
    this.error = ''
  }
}
