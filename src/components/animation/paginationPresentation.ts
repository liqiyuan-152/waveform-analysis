import { shallowRef, type ComputedRef } from 'vue'
import type { AnimationContext } from './context'
import type { ResolvedAnimationProps } from './config'
import type { WaveformAnimationController } from '@/animation/WaveformAnimationController'
import { clampProgress } from '@/animation/presets/shared'
import { chartExportOptions } from '../controls/chartExportOptions'

/** A single owner-scoped fade; it holds no old page geometry. */
export function createPaginationPresentation(
  context: AnimationContext,
  controller: WaveformAnimationController,
  config: ComputedRef<ResolvedAnimationProps>,
  effective: ComputedRef<boolean>,
  commit: () => void,
) {
  const opacity = shallowRef(1)
  const key = { kind: 'custom', id: 'pagination', scope: 'update' } as const
  let sequence = 0
  let request: { page: number; version: number; environment: string; started: boolean } | undefined
  const environment = () =>
    JSON.stringify({
      options: Object.fromEntries(
        Object.entries(chartExportOptions(context.props)).filter(
          ([name]) => !['annotations', 'annotationsVisible'].includes(name),
        ),
      ),
      size: context.containerSize.value,
      hidden: context.props.hiddenSeriesIds,
      presentation: context.props.presentationMode,
    })
  function reset() {
    request = undefined
    opacity.value = 1
  }
  function cancel() {
    controller.cancel(key)
    reset()
  }
  function requestPage(page: number) {
    cancel()
    controller.finishAll()
    if (!effective.value || !config.value.animationUpdate.enabled) return
    request = { page, version: ++sequence, environment: environment(), started: false }
    if (config.value.animationUpdate.duration > 0) opacity.value = 0
  }
  function reconcile(dataChanged: boolean) {
    const current = request
    if (!current) return false
    if (
      dataChanged ||
      current.page !== context.currentPage.value ||
      current.environment !== environment() ||
      !effective.value ||
      !config.value.animationUpdate.enabled
    ) {
      controller.finishAll()
      reset()
      return true
    }
    if (!current.started && config.value.animationUpdate.duration === 0) opacity.value = 1
    commit()
    if (context.sampling.state.value === 'pending' || !context.layoutReady.value) return true
    if (context.sampling.state.value !== 'success') {
      controller.finishAll()
      reset()
      return true
    }
    if (current.started) return true
    const ids = context.tracks.value.flatMap((track) =>
      track.width > 0 && track.height > 0
        ? track.seriesList
            .filter((series) => (series.source?.length ?? series.points.length) > 0)
            .map((series) => series.id)
        : [],
    )
    if (!ids.length) {
      reset()
      return true
    }
    current.started = true
    const options = config.value.animationUpdate
    const notify = (callback?: () => void) => ids.forEach(() => callback?.())
    controller.animate(key, {
      duration: options.duration,
      easing: options.easing,
      force: true,
      initialize: () => {
        opacity.value = options.duration > 0 ? 0 : 1
      },
      during: (progress, frame) => {
        if (request?.version === current.version)
          opacity.value = frame.terminal ? 1 : clampProgress(progress)
      },
      done: () => {
        if (request?.version === current.version) reset()
        notify(options.onComplete)
      },
      aborted: () => {
        if (request?.version === current.version) reset()
        notify(options.onAbort)
      },
    })
    return true
  }
  function wrapPagination(goToPage: (page: number) => void, count: ComputedRef<number>) {
    return (page: number) => {
      const target = Math.min(count.value, Math.max(1, Math.floor(page)))
      if (target === context.currentPage.value) return
      requestPage(target)
      goToPage(page)
    }
  }
  return { opacity, reset, cancel, reconcile, wrapPagination, active: () => !!request }
}
