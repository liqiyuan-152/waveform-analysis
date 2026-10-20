import { describe, expect, it, vi } from 'vitest'
import { WaveformPresentation } from '@/animation/presentation/WaveformPresentation'
import { resolveAnimationProps } from '@/animation/presentation/config'
import type { AnimationContext } from '@/animation/presentation/context'
import { Animator } from '@/animation/core/Animator'
import { ChartModel } from '@/model/ChartModel'
import { ChartLayoutEngine } from '@/layout/ChartLayoutEngine'
import { createAnimationTestScheduler } from '@tests/support/animationScheduler'

function data(multiplier = 1) {
  return {
    kind: 'points' as const,
    points: [
      { x: 0, y: 0 },
      { x: 1, y: multiplier },
    ],
  }
}
function fixture(prefix = 'native', animateViewport = false) {
  const model = new ChartModel({
    data: data(),
    animation: { duration: 500, easing: 'linear' },
    animationUpdate: { animateViewport, duration: 1000, easing: 'linear' },
    grid: { rowCount: 1, columnCount: 1 },
  })
  const engine = new ChartLayoutEngine(model)
  const tracks = { value: engine.calculate(800, 400).trackLayouts }
  const state = { value: 'pending' as 'pending' | 'success' | 'fallback' | 'error' }
  const signature = { value: 'initial' }
  const context: AnimationContext = {
    get props() {
      return model.options.value
    },
    tracks,
    currentPage: { value: 1 },
    containerSize: { value: [800, 400] },
    preparedSeries: {
      get value() {
        return model.data.series
      },
    },
    layoutReady: { value: true },
    innerWidth: { value: 700 },
    innerHeight: { value: 300 },
    sampling: { state, requestSignature: signature },
  }
  const fake = createAnimationTestScheduler()
  const animator = new Animator(fake.scheduler)
  const invalidate = vi.fn()
  const owner = new WaveformPresentation(
    context,
    {
      get value() {
        return resolveAnimationProps(model.options.value)
      },
    },
    { value: true },
    invalidate,
    prefix,
    animator,
  )
  return { model, engine, tracks, state, signature, fake, animator, owner, invalidate }
}

describe('framework-free waveform presentation owner', () => {
  it('waits for sampling, draws entrance, and transitions a replaced data reference', () => {
    const h = fixture()
    h.owner.reconcile()
    expect(h.owner.presentationTracks()[0].seriesPaths[0].animationClip?.width).toBe(0)
    expect(h.fake.pendingFrames).toBe(0)
    h.state.value = 'success'
    h.owner.reconcile()
    h.fake.advance(250)
    h.fake.flushFrame()
    const track = h.owner.presentationTracks()[0]
    expect(track.seriesPaths[0].animationClip?.width).toBeCloseTo(track.width / 2)
    h.fake.advance(250)
    h.fake.flushFrame()
    expect(h.owner.presentationTracks()[0].seriesPaths[0].animationClip).toBeUndefined()
    h.model.setOption({ data: data(2) })
    h.tracks.value = h.engine.calculate(800, 400).trackLayouts
    h.signature.value = 'replacement'
    h.owner.reconcile()
    expect(h.owner.controller.getActiveAnimationCount()).toBe(1)
    h.fake.advance(500)
    h.fake.flushFrame()
    expect(h.owner.presentationTracks()[0].seriesPaths[0].lineRenderPoints?.[1].y).toBeCloseTo(1.5)
    expect(h.model.data.series[0].source.pointAt(1)?.y).toBe(2)
    h.owner.stabilize()
    expect(h.owner.presentationTracks()[0].seriesPaths[0].lineRenderPoints?.[1].y).toBe(2)
    expect(h.animator.getAnimationCount()).toBe(0)
    h.owner.dispose()
  })

  it('isolates owners and releases pending frames and queued annotation releases on disposal', async () => {
    const a = fixture('a'),
      b = fixture('b')
    a.state.value = b.state.value = 'success'
    a.owner.reconcile()
    b.owner.reconcile()
    const aClip = a.owner.presentationTracks()[0].seriesPaths[0].animationClip!
    const bClip = b.owner.presentationTracks()[0].seriesPaths[0].animationClip!
    expect(aClip.id).not.toBe(bClip.id)
    a.owner.dispose()
    a.owner.dispose()
    const calls = a.invalidate.mock.calls.length
    await Promise.resolve()
    a.fake.advance(500)
    a.fake.flushFrame()
    a.owner.reconcile()
    expect(a.invalidate).toHaveBeenCalledTimes(calls)
    expect(a.fake.pendingFrames).toBe(0)
    expect(a.animator.getAnimationCount()).toBe(0)
    expect(b.owner.controller.getActiveAnimationCount()).toBe(1)
    b.owner.dispose()
    expect(b.fake.pendingFrames).toBe(0)
  })
})

function viewportFixture() {
  const h = fixture('viewport', true)
  h.state.value = 'success'
  h.owner.reconcile()
  h.owner.stabilize()
  const zoom = (end: number) => {
    h.tracks.value = h.tracks.value.map((track) => ({
      ...track,
      xScale: track.xScale.copy().domain([0, end]),
    }))
    h.signature.value = String(end)
    h.owner.reconcile()
  }
  const domain = () => h.owner.presentationTracks()[0].xScale.domain()
  return { ...h, zoom, domain }
}

describe('viewport presentation transitions', () => {
  it('waits for sampling and retargets from the visible domain without mutating target data', () => {
    const h = viewportFixture()
    const initial = h.domain()[1]
    const data = h.model.options.value.data
    h.state.value = 'pending'
    h.zoom(0.5)
    expect(h.domain()[1]).toBe(initial)
    expect(h.owner.controller.getActiveAnimationCount()).toBe(0)
    h.state.value = 'success'
    h.owner.reconcile()
    h.fake.advance(500)
    h.fake.flushFrame()
    const halfway = (initial + 0.5) / 2
    expect(h.domain()[1]).toBeCloseTo(halfway)
    h.owner.stabilize(true)
    expect(h.domain()[1]).toBeCloseTo(halfway)
    h.zoom(0.2)
    expect(h.domain()[1]).toBeCloseTo(halfway)
    h.fake.advance(1000)
    h.fake.flushFrame()
    expect(h.domain()).toEqual([0, 0.2])
    expect(h.model.options.value.data).toBe(data)
    h.owner.dispose()
  })

  it('commits direct interactions and does not replay a pending sampling result', () => {
    const h = viewportFixture()
    h.state.value = 'pending'
    h.zoom(0.5)
    h.owner.stabilize()
    h.state.value = 'success'
    h.owner.reconcile()
    expect(h.domain()).toEqual([0, 0.5])
    expect(h.owner.controller.getActiveAnimationCount()).toBe(0)
    h.owner.dispose()
  })

  it.each(['size', 'membership', 'formatter'] as const)(
    'commits incompatible %s changes',
    (kind) => {
      const h = viewportFixture()
      h.zoom(0.5)
      h.fake.advance(250)
      h.fake.flushFrame()
      if (kind === 'size') h.tracks.value[0] = { ...h.tracks.value[0], width: 123 }
      if (kind === 'membership') h.tracks.value[0] = { ...h.tracks.value[0], seriesList: [] }
      if (kind === 'formatter') h.model.setOption({ axes: { x: { labelFormatter: String } } })
      h.owner.reconcile()
      expect(h.domain()).toEqual([0, 0.5])
      expect(h.owner.controller.getActiveAnimationCount()).toBe(0)
      h.owner.dispose()
    },
  )

  it('keeps data updates separate and stabilizes them even when preserving viewport work', () => {
    const h = viewportFixture()
    h.zoom(0.5)
    h.fake.advance(250)
    h.fake.flushFrame()
    h.model.setOption({ data: data(3) })
    h.tracks.value = h.engine.calculate(800, 400).trackLayouts
    h.signature.value = 'new-data'
    h.owner.reconcile()
    h.owner.stabilize(true)
    expect(h.owner.presentationTracks()[0].seriesPaths[0].lineRenderPoints?.[1].y).toBe(3)
    expect(h.owner.controller.getActiveAnimationCount()).toBe(0)
    h.owner.dispose()
  })

  it('finishes an active viewport transition when the opt-in is removed', () => {
    const h = viewportFixture()
    h.zoom(0.5)
    h.model.setOption({ animationUpdate: { duration: 1000 } })
    h.owner.reconcile()
    expect(h.domain()).toEqual([0, 0.5])
    expect(h.owner.controller.getActiveAnimationCount()).toBe(0)
    h.owner.dispose()
  })
})

it('resolves viewport opt-in independently and rejects invalid values', () => {
  expect(resolveAnimationProps({}).animationUpdate.animateViewport).toBe(false)
  expect(
    resolveAnimationProps({ animationUpdate: { animateViewport: true } }).animationUpdate
      .animateViewport,
  ).toBe(true)
  const warn = vi.fn()
  expect(
    resolveAnimationProps(
      { animationUpdate: { animateViewport: 'true' as unknown as boolean } },
      warn,
    ).animationUpdate.animateViewport,
  ).toBe(false)
  expect(warn).toHaveBeenCalledOnce()
})
