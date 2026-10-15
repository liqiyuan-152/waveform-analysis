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
function fixture(prefix = 'native') {
  const model = new ChartModel({
    data: data(),
    animation: { duration: 500, easing: 'linear' },
    animationUpdate: { duration: 1000, easing: 'linear' },
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
