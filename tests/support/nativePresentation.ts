import { vi } from 'vitest'
import { Animator } from '@/animation/core/Animator'
import { SvgChartRenderer } from '@/rendering/SvgChartRenderer'
import type { ChartLayoutSnapshot } from '@/layout/ChartLayoutEngine'

/** Observe the actual render boundary without depending on the removed Vue component tree. */
export function observeNativePresentation() {
  const snapshots = new WeakMap<Element, ChartLayoutSnapshot>()
  const animators = new Set<Animator>()
  const render = SvgChartRenderer.prototype.render
  vi.spyOn(SvgChartRenderer.prototype, 'render').mockImplementation(function (
    this: SvgChartRenderer,
    ...args
  ) {
    snapshots.set(this.svg, args[0])
    return render.apply(this, args)
  })
  const animate = Animator.prototype.animatePaused
  vi.spyOn(Animator.prototype, 'animatePaused').mockImplementation(function (
    this: Animator,
    ...args
  ) {
    animators.add(this)
    return animate.apply(this, args)
  })
  return {
    track(host: Element, index = 0) {
      const svg = host.querySelector('.waveform-chart__svg')
      const track = svg && snapshots.get(svg)?.trackLayouts[index]
      if (!track) throw new Error('No rendered native track')
      return track
    },
    getAnimationCount() {
      return [...animators].reduce((count, animator) => count + animator.getAnimationCount(), 0)
    },
  }
}
