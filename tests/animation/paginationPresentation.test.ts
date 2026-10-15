import { computed, ref, shallowRef } from 'vue'
import { scaleLinear } from 'd3'
import { describe, expect, it, vi } from 'vitest'
import { Animator } from '@/animation/core/Animator'
import { WaveformAnimationController } from '@/animation/WaveformAnimationController'
import { createPaginationPresentation } from '../fixtures/legacy/components/animation/paginationPresentation'
import type { AnimationContext } from '../fixtures/legacy/components/animation/context'
import { resolveAnimationProps } from '../fixtures/legacy/components/animation/config'
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
    {
      id: 'track',
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      yAxes: [],
      xScale: scaleLinear(),
      yScale: scaleLinear(),
      seriesList: [{ id: 'a', points: [1] }],
    } as unknown as TrackLayout,
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
  const prepare = vi.fn()
  const commit = vi.fn(),
    complete = vi.fn(),
    abort = vi.fn(),
    enabled = ref(true)
  const config = computed(() =>
    resolveAnimationProps({
      animation: { duration: 1000, easing: 'linear', onComplete: complete, onAbort: abort },
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
    prepare,
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
    prepare,
    commit,
    enabled,
    frame(ms: number) {
      fake.advance(ms)
      fake.flushFrame()
    },
  }
}

describe('page/grid entrance request ownership', () => {
  it('prepares pending geometry without RAF and starts the latest ready page only once', () => {
    const h = setup()
    h.change(2)
    expect(h.page.enterDuration()).toBe(500)
    expect(h.page.reconcile(false)).toBe('replay')
    expect(h.prepare).toHaveBeenCalledTimes(1)
    expect(h.fake.pendingFrames).toBe(0)
    h.change(3)
    h.signature.value = 'page-3'
    h.page.reconcile(false)
    h.state.value = 'success'
    h.page.reconcile(false)
    const calls = h.prepare.mock.calls.length
    expect(h.currentPage.value).toBe(3)
    h.page.reconcile(false)
    expect(h.prepare).toHaveBeenCalledTimes(calls)
    // The coordinator never creates a fade task; the normal entrance pipeline draws.
    expect(h.animator.getAnimationCount()).toBe(0)
    h.controller.destroy()
  })
  it.each(['fallback', 'error'] as const)('commits %s geometry statically', (state) => {
    const h = setup()
    h.change(2)
    h.state.value = state
    expect(h.page.reconcile(false)).toBe('static')
    expect(h.page.active()).toBe(false)
    expect(h.prepare).not.toHaveBeenCalled()
    h.controller.destroy()
  })
  it.each(['reset', 'resize', 'data', 'finish', 'disable'])(
    'invalidates pending replay after %s',
    (cause) => {
      const h = setup()
      h.change(2)
      if (cause === 'reset') h.currentPage.value = 1
      if (cause === 'resize') h.size.value = [600, 300]
      if (cause === 'finish') h.controller.finishAll()
      if (cause === 'disable') h.enabled.value = false
      h.page.reconcile(cause === 'data')
      h.state.value = 'success'
      expect(h.page.reconcile(false)).toBeUndefined()
      expect(h.prepare).not.toHaveBeenCalled()
      expect(h.fake.pendingFrames).toBe(0)
      h.controller.destroy()
    },
  )
  it('waits for layout and requests grid replay on the already-reset page', () => {
    const h = setup()
    h.currentPage.value = 1
    h.page.requestLayout()
    expect(h.page.enterDuration()).toBe(1000)
    h.state.value = 'success'
    h.ready.value = false
    h.page.reconcile(false)
    expect(h.page.active()).toBe(true)
    h.ready.value = true
    h.page.reconcile(false)
    const calls = h.prepare.mock.calls.length
    h.page.reconcile(false)
    expect(h.prepare).toHaveBeenCalledTimes(calls)
    h.controller.destroy()
  })
  it('stabilizes a started replay if current sampling geometry changes', () => {
    const h = setup()
    h.change(2)
    h.state.value = 'success'
    h.page.reconcile(false)
    h.controller.animate(
      { kind: 'series', id: 'a', scope: 'enter' },
      { duration: 1000, force: true },
    )
    h.signature.value = 'new-geometry'
    expect(h.page.reconcile(false)).toBe('static')
    expect(h.animator.getAnimationCount()).toBe(0)
    expect(h.page.active()).toBe(false)
    h.controller.destroy()
  })
  it('ignores same-page selection and aborts old owner tasks on replacement', () => {
    const h = setup()
    h.change(1)
    expect(h.page.active()).toBe(false)
    h.controller.animate(
      { kind: 'series', id: 'old', scope: 'enter' },
      {
        duration: 1000,
        force: true,
        aborted: h.abort,
        done: h.complete,
      },
    )
    h.change(2)
    expect(h.abort).toHaveBeenCalledTimes(1)
    expect(h.complete).not.toHaveBeenCalled()
    expect(h.page.active()).toBe(true)
    h.controller.destroy()
  })
})
