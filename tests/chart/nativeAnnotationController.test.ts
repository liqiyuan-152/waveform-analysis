import { afterEach, describe, expect, it, vi } from 'vitest'
import { AnnotationController } from '@/annotation/AnnotationController'
import { ChartEventEmitter } from '@/chart/ChartEventEmitter'
import { ChartModel } from '@/model/ChartModel'
import { ChartLayoutEngine } from '@/layout/ChartLayoutEngine'
import { svgNode } from '@/rendering/SvgDom'
import type { WaveformChartOptions } from '@/types/options'
import type { WaveformAnnotation } from '@/types/chart'
import { annotationTracks } from '@/annotation/annotationTracks'
import { findAnnotationSeriesCandidates } from '@/annotation/markup'
import { flushNativeUpdates } from '../support/nativeChart'

const cleanups: Array<() => void> = []
afterEach(() => cleanups.splice(0).forEach((dispose) => dispose()))
const annotation: WaveformAnnotation = {
  id: 'note',
  seriesId: 'b',
  x: 1,
  y: 2,
  text: '原标注',
  style: { borderColor: '#123456' },
}
const data = {
  kind: 'series' as const,
  series: ['a', 'b'].map((id, index) => ({
    id,
    name: id,
    data: {
      kind: 'points' as const,
      points: [
        { x: 0, y: 0 },
        { x: 1, y: index + 1 },
        { x: 2, y: 0 },
      ],
    },
  })),
}
function setup(options: WaveformChartOptions = {}) {
  const root = document.createElement('div'),
    svg = svgNode(document, 'svg')
  document.body.append(root)
  root.append(svg)
  const model = new ChartModel({
    data,
    annotations: [annotation],
    animationEnabled: false,
    interactionMode: 'annotation',
    xDomainStrategy: { type: 'data' },
    ...options,
  })
  const engine = new ChartLayoutEngine(model, document),
    events = new ChartEventEmitter()
  let alive = true
  const layout = () => engine.calculate(800, 360)
  const hover = vi.fn(),
    draftChanged = vi.fn()
  const controller = new AnnotationController(
    root,
    svg,
    {
      model,
      layout,
      events,
      window,
      alive: () => alive,
      changed: () => {},
      stabilize: () => {},
    },
    hover,
    draftChanged,
  )
  controller.render()
  cleanups.push(() => {
    alive = false
    controller.dispose()
    events.dispose()
    root.remove()
  })
  return { controller, root, svg, model, events, layout, hover, draftChanged }
}
function clickOverlay(
  fixture: ReturnType<typeof setup>,
  trackIndex: number,
  queryX = 1,
  value = 1.8,
) {
  const track = fixture.layout().trackLayouts[trackIndex]!
  const independent = fixture.model.options.value.displayMode === 'independent'
  const node = svgNode(document, 'rect', { class: 'waveform-chart__overlay' })
  if (independent) node.dataset.independentOverlayIndex = String(track.index)
  fixture.svg.append(node)
  const x = track.xScale(queryX) + (independent ? 0 : track.left)
  const y = track.yScale(value) + (independent ? 0 : track.top)
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, clientX: x, clientY: y }))
}

describe('native annotation selection and draft orchestration', () => {
  it.each(['independent', 'separated', 'compact'] as const)(
    'creates a snapped draft in %s without committing annotations',
    (displayMode) => {
      const fixture = setup({ displayMode })
      const request = vi.fn()
      fixture.events.on('update:annotations', request)
      clickOverlay(fixture, 1)
      const draft = fixture.controller.draft!
      expect(draft.mode).toBe('add')
      expect(draft.annotation).toMatchObject({ seriesId: 'b', x: 1, y: 2, text: '' })
      expect(request).not.toHaveBeenCalled()
      expect(fixture.model.options.value.annotations).toEqual([annotation])
      const created = vi.fn()
      fixture.events.on('annotation-create', created)
      expect(fixture.controller.confirm({ ...draft.annotation, text: '新标注' })).toBe(true)
      expect(request.mock.calls[0]![0]).toHaveLength(2)
      expect(created).toHaveBeenCalledExactlyOnceWith({ ...draft.annotation, text: '新标注' })
      expect(fixture.controller.draft).toBeUndefined()
    },
  )

  it('uses local overlay X in a second independent column and projects the editor anchor globally', () => {
    const fixture = setup({ displayMode: 'independent', grid: { rowCount: 1, columnCount: 2 } })
    clickOverlay(fixture, 1)
    const track = fixture.layout().trackLayouts[1]!
    expect(track.left).toBeGreaterThan(0)
    expect(fixture.controller.draft!.annotation).toMatchObject({ seriesId: 'b', x: 1, y: 2 })
    expect(fixture.controller.draft!.anchor.x).toBe(
      fixture.layout().left + track.left + track.xScale(1),
    )
  })

  it('uses full typed data for selection when the requested anchor is absent from sampled paths', () => {
    const x = Float64Array.from({ length: 10001 }, (_, index) => index / 1000)
    const y = Float64Array.from(x, (value) => Math.sin(value))
    const fixture = setup({
      data: {
        kind: 'series',
        series: [{ id: 'full', name: '完整', data: { kind: 'typed-points', x, y } }],
      },
      rendering: {
        sampling: { mode: 'auto', strategy: 'average', maxPointCount: 20, autoThreshold: 1 },
      },
    })
    clickOverlay(fixture, 0, 5.4321, Math.sin(5.4321))
    expect(fixture.controller.draft!.annotation).toMatchObject({
      seriesId: 'full',
      x: x[5432],
      y: y[5432],
    })
  })

  it('isolates edited draft/style/previous and preserves the update event parameter tuple', () => {
    const fixture = setup(),
      update = vi.fn()
    fixture.events.on('annotation-update', update)
    fixture.controller.openEdit('note', { x: 100, y: 100 })
    const first = fixture.controller.draft!
    first.annotation.style!.borderColor = '#abcdef'
    first.anchor.x = 999
    expect(fixture.controller.draft!.annotation.style!.borderColor).toBe('#123456')
    expect(fixture.controller.draft!.anchor.x).toBe(100)
    expect(fixture.controller.confirm({ ...first.annotation, text: '修改' })).toBe(true)
    expect(update).toHaveBeenCalledExactlyOnceWith(
      { ...first.annotation, text: '修改' },
      annotation,
    )
    expect(fixture.model.options.value.annotations).toEqual([annotation])
  })

  it('rejects empty/overlong/wrong-ID drafts and cancel never emits a replacement', () => {
    const fixture = setup(),
      request = vi.fn()
    fixture.events.on('update:annotations', request)
    fixture.controller.openEdit('note', { x: 0, y: 0 })
    expect(fixture.controller.confirm({ ...annotation, text: ' ' })).toBe(false)
    expect(fixture.controller.confirm({ ...annotation, text: 'x'.repeat(41) })).toBe(false)
    expect(fixture.controller.confirm({ ...annotation, id: 'wrong' })).toBe(false)
    expect(fixture.controller.draft).toBeDefined()
    fixture.controller.cancelEditor()
    expect(fixture.controller.draft).toBeUndefined()
    expect(request).not.toHaveBeenCalled()
  })

  it.each(['hidden', 'removed', 'presentation', 'invisible'] as const)(
    'closes a draft when its series becomes %s',
    (change) => {
      const fixture = setup()
      fixture.controller.openEdit('note', { x: 0, y: 0 })
      if (change === 'hidden') fixture.model.setOption({ hiddenSeriesIds: ['b'] })
      if (change === 'removed') fixture.model.setOption({ annotations: [] })
      if (change === 'presentation') fixture.model.setOption({ presentationMode: true })
      if (change === 'invisible') fixture.model.setOption({ annotationsVisible: false })
      fixture.controller.reconcile()
      expect(fixture.controller.draft).toBeUndefined()
    },
  )

  it('ignores creation outside annotation mode or with no full-source candidate', () => {
    const fixture = setup({ interactionMode: 'zoom' })
    clickOverlay(fixture, 0, 1, 1)
    expect(fixture.controller.draft).toBeUndefined()
    fixture.model.setOption({ interactionMode: 'annotation' })
    clickOverlay(fixture, 0, 100, 1)
    expect(fixture.controller.draft).toBeUndefined()
  })

  it('isolates candidate snapshots and clears menus/drafts/listeners on disposal', async () => {
    const fixture = setup()
    const candidate = findAnnotationSeriesCandidates(
      annotationTracks(fixture.layout().trackLayouts),
      1,
      100,
      100,
    )[0]!
    fixture.controller.openCreate(candidate, { x: 100, y: 100 })
    fixture.controller.seriesCandidates[0]!.point.y = 900
    expect(fixture.controller.seriesCandidates[0]!.point.y).not.toBe(900)
    const request = vi.fn()
    fixture.events.on('update:annotations', request)
    const node = fixture.root.querySelector<SVGGElement>('.waveform-annotation')!
    node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0 }))
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 50 }))
    fixture.controller.dispose()
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 50 }))
    await flushNativeUpdates()
    expect(fixture.controller.draft).toBeUndefined()
    expect(request).not.toHaveBeenCalled()
    expect(fixture.root.querySelector('.waveform-annotation-layer')).toBeNull()
  })
})
