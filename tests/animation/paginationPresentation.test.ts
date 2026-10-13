import { computed, ref, shallowRef } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { Animator } from '@/animation/core/Animator'
import { WaveformAnimationController } from '@/animation/WaveformAnimationController'
import { createPaginationPresentation } from '@/components/animation/paginationPresentation'
import type { AnimationContext } from '@/components/animation/context'
import { resolveAnimationProps } from '@/components/animation/config'
import type { TrackLayout } from '@/components/core/types'
import { createAnimationTestScheduler } from '@tests/support/animationScheduler'

function setup() {
  const fake = createAnimationTestScheduler(),
    animator = new Animator(fake.scheduler)
  const state = ref<'pending' | 'success' | 'fallback' | 'error'>('pending')
  const signature = ref('page-2'),
    ready = ref(true),
    size = ref([800, 360]),
    currentPage = ref(1)
  const tracks = ref([
    { width: 100, height: 100, seriesList: [{ id: 'a', points: [1] }] } as unknown as TrackLayout,
  ])
  const context: AnimationContext = {
    props: {} as AnimationContext['props'],
    currentPage,
    containerSize: computed(() => size.value),
    tracks: computed(() => tracks.value),
    preparedSeries: shallowRef([]),
    layoutReady: computed(() => ready.value),
    innerWidth: computed(() => 100),
    innerHeight: computed(() => 100),
    sampling: {
      state: computed(() => state.value),
      requestSignature: computed(() => signature.value),
    },
  }
  const commit = vi.fn(),
    complete = vi.fn(),
    abort = vi.fn(),
    enabled = ref(true)
  const config = computed(() =>
    resolveAnimationProps({
      animationUpdate: { duration: 1000, easing: 'linear', onComplete: complete, onAbort: abort },
    }),
  )
  const controller = new WaveformAnimationController({
    animator,
    commitFinalState: () => {
      page.reset()
      commit()
    },
  })
  const page = createPaginationPresentation(
    context,
    controller,
    config,
    computed(() => enabled.value),
    commit,
  )
  const change = page.wrapPagination(
    (value) => {
      currentPage.value = value
    },
    computed(() => 3),
  )
  return {
    fake,
    animator,
    controller,
    page,
    change,
    state,
    signature,
    ready,
    size,
    tracks,
    currentPage,
    complete,
    abort,
    frame(ms: number) {
      fake.advance(ms)
      fake.flushFrame()
    },
  }
}

describe('page readiness and request ownership', () => {
  it('waits without scheduling RAF then starts exactly once for the latest page', () => {
    const h = setup()
    h.change(2)
    expect(h.page.reconcile(false)).toBe(true)
    expect(h.page.opacity.value).toBe(0)
    expect(h.fake.pendingFrames).toBe(0)
    h.change(3)
    h.signature.value = 'page-3'
    h.page.reconcile(false)
    h.state.value = 'success'
    h.page.reconcile(false)
    h.frame(500)
    expect(h.page.opacity.value).toBeCloseTo(0.5)
    h.page.reconcile(false)
    expect(h.page.opacity.value).toBeCloseTo(0.5)
    h.frame(500)
    expect(h.page.opacity.value).toBe(1)
    expect(h.complete).toHaveBeenCalledTimes(1)
    expect(h.animator.getAnimationCount()).toBe(0)
    h.controller.destroy()
  })
  it.each(['fallback', 'error'] as const)(
    'shows the latest geometry on %s without fading',
    (state) => {
      const h = setup()
      h.change(2)
      h.state.value = state
      h.page.reconcile(false)
      expect(h.page.opacity.value).toBe(1)
      expect(h.fake.pendingFrames).toBe(0)
      h.controller.destroy()
    },
  )
  it('does not animate stale requests after automatic reset, resize, data change or explicit finish', () => {
    for (const cause of ['reset', 'resize', 'data', 'finish']) {
      const h = setup()
      h.change(2)
      if (cause === 'reset') h.currentPage.value = 1
      if (cause === 'resize') h.size.value = [600, 300]
      if (cause === 'finish') h.controller.finishAll()
      h.page.reconcile(cause === 'data')
      h.state.value = 'success'
      h.page.reconcile(false)
      expect(h.page.opacity.value).toBe(1)
      expect(h.fake.pendingFrames).toBe(0)
      h.controller.destroy()
    }
  })
  it('does not start until layout is ready and skips an empty page', () => {
    const h = setup()
    h.change(2)
    h.state.value = 'success'
    h.ready.value = false
    h.page.reconcile(false)
    expect(h.fake.pendingFrames).toBe(0)
    h.ready.value = true
    h.tracks.value = []
    h.page.reconcile(false)
    expect(h.page.opacity.value).toBe(1)
    expect(h.fake.pendingFrames).toBe(0)
    h.controller.destroy()
  })
})
