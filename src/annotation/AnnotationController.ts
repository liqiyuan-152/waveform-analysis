import { pointer } from 'd3'
import type { WaveformAnnotation } from '../types/chart'
import type { InteractionContext } from '../interaction/InteractionContext'
import type { ChartLayoutSnapshot } from '../layout/ChartLayoutEngine'
import { AnnotationModel } from './AnnotationModel'
import { AnnotationDraftController } from './AnnotationDraftController'
import { AnnotationEditor } from './AnnotationEditor'
import { reportChartError } from '../chart/reportChartError'
import { findClosestTrackAtPointer } from '../components/core/layout'
import { AnnotationView } from './AnnotationView'
import { AnnotationDragController } from './AnnotationDragController'
import { AnnotationContextMenu } from './AnnotationContextMenu'
import { annotationTracks } from './annotationTracks'
import { layoutAnnotations } from './annotationLayout'
import { findAnnotationSeriesCandidates } from './markup'
import type {
  AnnotationEditorDraft,
  AnnotationEditorAnchor,
  AnnotationSeriesCandidate,
  RenderedAnnotation,
} from './types'

let sequence = 0

/** Composes controlled annotation requests, full-source selection, SVG and pointer lifetimes. */
export class AnnotationController {
  readonly model: AnnotationModel
  private readonly view: AnnotationView
  private readonly drag: AnnotationDragController
  private readonly menu: AnnotationContextMenu
  private readonly drafts: AnnotationDraftController
  private editor?: AnnotationEditor
  private editorToken?: AnnotationEditorDraft

  private get state() {
    return this.drafts.current
  }
  private menuId?: string
  private disposed = false

  constructor(
    private readonly root: HTMLElement,
    svg: SVGSVGElement,
    private readonly context: InteractionContext,
    blockHover: (active: boolean, cancelled?: boolean) => void,
    private readonly draftChanged: () => void = () => {},
    private readonly presented?: () => RenderedAnnotation[],
  ) {
    this.drafts = new AnnotationDraftController(
      () => context.layout().trackLayouts.flatMap((track) => track.seriesList),
      () => context.model.options.value.timeUnit,
    )
    this.model = new AnnotationModel(
      () => context.model.options.value.annotations,
      context.events,
      () => this.alive(),
    )
    this.view = new AnnotationView(svg, {
      down: (id, node, event) => {
        if (!this.interactive()) return
        context.stabilize()
        if (!this.interactive()) return
        const annotation = this.model.find(id)
        if (annotation) this.drag.begin(annotation, node, event)
      },
      menu: (id, event) => this.openMenu(id, event),
    })
    this.drag = new AnnotationDragController(
      context.window,
      () => this.render(),
      (id, x, y) => this.model.move(id, x, y),
      blockHover,
    )
    this.menu = new AnnotationContextMenu(root, () => {
      this.menuId = undefined
    })
    root.addEventListener('click', this.click)
    root.addEventListener('contextmenu', this.contextMenu)
    context.window.addEventListener('keydown', this.keyDown)
  }

  private alive() {
    return !this.disposed && this.context.alive()
  }
  private interactive() {
    const options = this.context.model.options.value
    return this.alive() && options.annotationsVisible && !options.presentationMode
  }

  get draft() {
    return this.drafts.snapshot()
  }
  get seriesCandidates() {
    return this.drafts.candidates()
  }

  private readonly click = (event: MouseEvent) => {
    const target = event.target as Element | null
    const overlay = target?.nodeType === 1 ? target.closest('.waveform-chart__overlay') : null
    if (!overlay || !this.root.contains(overlay)) {
      if (!target?.closest('.waveform-annotation-context-menu')) this.closeMenu()
      return
    }
    this.closeMenu()
    if (!this.interactive() || event.button !== 0) return
    const options = this.context.model.options.value
    if (this.context.model.presentation.mode(options) !== 'annotation') return
    this.context.stabilize()
    if (!this.interactive()) return
    const layout = this.context.layout()
    const [x, y] = pointer(event, overlay)
    const independent = options.displayMode === 'independent'
    const tracks = layout.trackLayouts.filter(
      (track) =>
        track.hasVisibleSeries &&
        (!independent ||
          track.index === Number((overlay as SVGRectElement).dataset.independentOverlayIndex)),
    )
    const reference = independent ? tracks[0] : findClosestTrackAtPointer(tracks, x, y)
    if (!reference) return
    const localX = independent ? x : x - reference.left
    const candidates = findAnnotationSeriesCandidates(
      annotationTracks([reference]),
      reference.xScale.invert(localX),
      localX,
      independent ? y + reference.top : y,
    )
    const closest = candidates[0]
    if (!closest) return
    const track = tracks.find((item) => item.index === closest.trackIndex)!
    this.openCreate(
      closest,
      {
        x: layout.left + (independent ? track.left : 0) + x,
        y: layout.titleHeight + layout.top + (independent ? track.top : 0) + y,
      },
      candidates,
    )
  }

  openCreate(
    hit: AnnotationSeriesCandidate,
    anchor: AnnotationEditorAnchor,
    candidates: AnnotationSeriesCandidate[] = [hit],
  ) {
    if (!this.interactive()) return
    const crypto = this.root.ownerDocument.defaultView?.crypto
    this.drafts.create(
      hit,
      crypto?.randomUUID?.() ?? `annotation-${Date.now()}-${++sequence}`,
      anchor,
      candidates,
    )
    this.closeMenu()
    this.notifyDraft()
  }

  openEdit(id: string, anchor: AnnotationEditorAnchor) {
    if (!this.interactive()) return
    const annotation = this.model.find(id)
    if (!annotation) return
    const track = this.context
      .layout()
      .trackLayouts.find((item) =>
        item.seriesList.some((series) => series.id === annotation.seriesId),
      )
    const scale =
      track?.seriesPaths.find((item) => item.series.id === annotation.seriesId)?.yScale ??
      track?.yScale
    const candidates =
      track && scale
        ? findAnnotationSeriesCandidates(
            annotationTracks([track]),
            annotation.x,
            track.xScale(annotation.x),
            track.top + scale(annotation.y),
          )
        : []
    this.drafts.edit(annotation, anchor, candidates)
    this.closeMenu()
    this.notifyDraft()
  }

  changeDraftTime(value: string) {
    if (!this.interactive()) return '当前波形没有有效数据'
    return this.drafts.changeTime(value)
  }

  changeDraftSeries(id: string) {
    if (!this.interactive()) return '当前波形没有有效数据'
    return this.drafts.changeSeries(id)
  }

  confirm(annotation: WaveformAnnotation) {
    const draft = this.state
    if (!draft || !this.interactive() || this.drafts.error || annotation.id !== draft.annotation.id)
      return false
    const committed =
      draft.mode === 'add'
        ? this.model.create(annotation)
        : this.model.update(annotation, draft.previous)
    if (committed && this.state === draft) this.cancelEditor()
    return committed
  }

  cancelEditor() {
    if (!this.state) return
    this.drafts.close()
    this.notifyDraft()
  }

  private notifyDraft() {
    this.renderEditor()
    if (!this.disposed) this.draftChanged()
  }

  private renderEditor() {
    const token = this.state
    if (!token || !this.interactive()) {
      const editor = this.editor
      this.editor = undefined
      this.editorToken = undefined
      editor?.dispose()
      return
    }
    if (this.editor && this.editorToken === token) {
      this.editor.refresh()
      return
    }
    this.editor?.dispose()
    this.editorToken = token
    const editor = new AnnotationEditor(this.root.ownerDocument, {
      draft: () => (this.state === token && this.interactive() ? this.draft : undefined),
      candidates: () => this.seriesCandidates,
      series: () => {
        const series = this.context
          .layout()
          .trackLayouts.flatMap((track) => track.seriesList)
          .find((item) => item.id === this.state?.annotation.seriesId)
        return (
          series && { id: series.id, name: series.name, color: series.color, unit: series.unit }
        )
      },
      timeUnit: () => this.context.model.options.value.timeUnit,
      time: (value) => this.changeDraftTime(value),
      select: (id) => this.changeDraftSeries(id),
      confirm: (annotation) => this.state === token && this.confirm(annotation),
      cancel: () => {
        if (this.state === token) this.cancelEditor()
      },
    })
    this.editor = editor
    try {
      editor.mount()
    } catch (error) {
      if (this.editor === editor) this.cancelEditor()
      else editor.dispose()
      reportChartError(error)
    }
  }

  private readonly contextMenu = (event: MouseEvent) => {
    const target = event.target as Element | null
    if (!target?.closest('input, textarea, [contenteditable="true"]')) event.preventDefault()
  }
  private readonly keyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !this.state) this.closeMenu()
  }
  private closeMenu() {
    this.menuId = undefined
    this.menu.close()
  }

  private openMenu(id: string, event: MouseEvent) {
    if (!this.interactive() || this.drag.suppressMenu(event) || !this.model.find(id)) return
    event.preventDefault()
    event.stopPropagation()
    const bounds = this.root.getBoundingClientRect(),
      layout = this.context.layout()
    const anchor = {
      x: Math.max(0, Math.min(event.clientX - bounds.left, layout.width)),
      y: Math.max(0, Math.min(event.clientY - bounds.top, layout.height)),
    }
    this.menuId = id
    this.menu.open(
      Math.max(4, Math.min(anchor.x, layout.width - 120)),
      Math.max(4, Math.min(anchor.y, layout.height - 110)),
      () => this.openEdit(id, anchor),
      () => {
        this.closeMenu()
        if (this.interactive()) this.model.delete(id)
      },
    )
  }

  reconcile() {
    if (!this.alive()) return
    this.drag.reconcile(this.context.model.options.value.annotations)
    if (!this.state && !this.menuId) {
      if (!this.interactive()) this.cancel()
      return
    }
    const seriesIds = new Set(
      this.context
        .layout()
        .trackLayouts.flatMap((track) => track.seriesList.map((series) => series.id)),
    )
    this.drafts.retainCandidates(seriesIds)
    if (!this.interactive()) {
      this.cancel()
      this.closeMenu()
      this.cancelEditor()
    }
    if (this.menuId) {
      const annotation = this.model.find(this.menuId)
      if (!annotation || !seriesIds.has(annotation.seriesId)) this.closeMenu()
    }
    if (
      this.state &&
      (!seriesIds.has(this.state.annotation.seriesId) ||
        (this.state.mode === 'edit' && !this.model.find(this.state.annotation.id)))
    )
      this.cancelEditor()
    this.renderEditor()
  }

  render(snapshot: ChartLayoutSnapshot = this.context.layout()) {
    if (!this.alive()) return
    this.reconcile()
    const options = this.context.model.options.value
    const annotations =
      options.annotationsVisible && !options.cleanView
        ? (this.presented?.() ??
          layoutAnnotations(
            this.model.snapshot(),
            annotationTracks(snapshot.trackLayouts),
            snapshot.innerWidth,
            snapshot.innerHeight,
          ))
        : []
    this.view.render(
      annotations,
      snapshot.left,
      snapshot.top,
      this.interactive(),
      this.drag.offsets,
    )
  }

  cancel() {
    this.drag.cancel()
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.drag.dispose()
    this.menu.dispose()
    this.drafts.close()
    this.editor?.dispose()
    this.editor = undefined
    this.editorToken = undefined
    this.root.removeEventListener('click', this.click)
    this.root.removeEventListener('contextmenu', this.contextMenu)
    this.context.window.removeEventListener('keydown', this.keyDown)
    this.view.dispose()
  }
}
