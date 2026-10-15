import { describe, expect, it, vi } from 'vitest'
import { PaginationPresentation } from '@/animation/presentation/PaginationPresentation'
import { resolveAnimationProps } from '@/animation/presentation/config'
import type { AnimationContext } from '@/animation/presentation/context'
import { Animator } from '@/animation/core/Animator'
import { WaveformAnimationController } from '@/animation/WaveformAnimationController'
import { ChartModel } from '@/model/ChartModel'
import { ChartLayoutEngine } from '@/layout/ChartLayoutEngine'
import { createAnimationTestScheduler } from '@tests/support/animationScheduler'

function fixture() {
  const model = new ChartModel({
    data: {
      kind: 'points',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    },
    grid: { rowCount: 1, columnCount: 1 },
  })
  const layout = new ChartLayoutEngine(model).calculate(800, 400)
  const context: AnimationContext = {
    props: model.options.value,
    currentPage: { value: 1 },
    tracks: { value: layout.trackLayouts },
    containerSize: { value: [800, 400] },
    preparedSeries: { value: model.data.series },
    layoutReady: { value: true },
    innerWidth: { value: layout.innerWidth },
    innerHeight: { value: layout.innerHeight },
    sampling: { state: { value: 'pending' }, requestSignature: { value: 'page-2' } },
  }
  const scheduler = createAnimationTestScheduler()
  const animator = new Animator(scheduler.scheduler)
  const controller = new WaveformAnimationController({
    animator,
    commitFinalState: () => page.reset(),
  })
  const prepare = vi.fn()
  const page = new PaginationPresentation(
    context,
    controller,
    { value: resolveAnimationProps({ animation: { duration: 1000 } }) },
    { value: true },
    prepare,
  )
  const wrap = page.wrapPagination
  const go = vi.fn()
  const change = wrap(go, { value: 3 })
  return { page, context, prepare, controller, scheduler, animator, go, change }
}

// Ordinary mutable holders implement read-only consumers without reactive framework imports.
function replace<T>(reader: { readonly value: T }, value: T) {
  Object.assign(reader, { value })
}

describe('framework-free pagination animation owner', () => {
  it('keeps detached pagination callbacks bound and replays after sampling becomes ready', () => {
    const h = fixture()
    h.change(1)
    expect(h.go).not.toHaveBeenCalled()
    h.change(2)
    expect(h.go).toHaveBeenCalledWith(2)
    replace(h.context.currentPage, 2)
    expect(h.page.reconcile(false)).toBe('replay')
    expect(h.scheduler.pendingFrames).toBe(0)
    replace(h.context.sampling.state, 'success')
    expect(h.page.reconcile(false)).toBe('replay')
    h.controller.animateSeriesEnter(
      'a',
      { read: () => ({ x: 0, width: 0 }), write: () => {} },
      100,
      { duration: h.page.enterDuration() },
    )
    expect(h.page.active()).toBe(true)
    expect(h.page.enterDuration()).toBe(500)
    h.scheduler.advance(500)
    h.scheduler.flushFrame()
    expect(h.page.reconcile(false)).toBeUndefined()
    expect(h.page.active()).toBe(false)
    expect(h.animator.getAnimationCount()).toBe(0)
    h.controller.destroy()
  })

  it('isolates pending requests and grid durations between owners', () => {
    const a = fixture(),
      b = fixture()
    a.change(2)
    replace(a.context.currentPage, 2)
    b.page.requestLayout()
    expect(a.page.enterDuration()).toBe(500)
    expect(b.page.enterDuration()).toBe(1000)
    replace(a.context.containerSize, [360, 400])
    expect(a.page.reconcile(false)).toBe('static')
    expect(a.page.active()).toBe(false)
    expect(b.page.active()).toBe(true)
    expect(b.page.reconcile(false)).toBe('replay')
    expect(b.prepare).toHaveBeenCalledTimes(1)
    a.controller.destroy()
    b.controller.destroy()
  })
})
