import { watch } from 'vue'
import { zoomIdentity } from 'd3'
import type { LifecycleContext } from './useWaveformChartLifecycle'
import { transformForDomain } from '../interaction/zoomConstraints'

/** Page slots are reused; retain independent viewports by stable track identity. */
export function usePageViewports(context: LifecycleContext) {
  const saved = new Map<string, { x: [number, number]; y?: [number, number] }>()
  const { props, trackLayouts, independentTransforms, independentYDomains } = context
  watch(
    () => [
      props.data,
      props.displayMode,
      props.integerZoom,
      props.initialXDomain,
      props.initialXDomains,
      props.xDomainStrategy,
      props.minZoomSpan,
      props.minVisiblePoints,
      props.maxZoomScale,
      props.yDomain,
      props.yDomains,
      props.amplitudeLimits,
    ],
    () => saved.clear(),
    { flush: 'sync' },
  )
  function save() {
    if (props.displayMode !== 'independent') return
    trackLayouts.value.forEach((track) => {
      saved.set(track.id, {
        x: track.xScale.domain() as [number, number],
        y: independentYDomains.value[track.index],
      })
    })
  }
  function restore() {
    if (props.displayMode !== 'independent') return
    const ys: Record<number, [number, number]> = {}
    const transforms = context.pagedTracks.value.map(() => zoomIdentity)
    trackLayouts.value.forEach((track) => {
      const previous = saved.get(track.id)
      if (!previous) return
      if (previous.y) ys[track.index] = previous.y
      transforms[track.index] = transformForDomain(
        previous.x,
        context.resolveInitialTrackDomain(track),
        track.width,
      )
    })
    independentTransforms.value = transforms
    independentYDomains.value = ys
  }
  return { save, restore }
}
