import type { ComputedRef } from 'vue'
import { animationLayoutSignature, type AnimationContext } from './context'
import type { ResolvedAnimationProps } from './config'
import type { WaveformAnimationController } from '@/animation/WaveformAnimationController'
import { chartExportOptions } from '../controls/chartExportOptions'

/** Coordinates entrance replay; drawing remains owned by the normal series pipeline. */
export function createPaginationPresentation(
  context: AnimationContext,
  controller: WaveformAnimationController,
  config: ComputedRef<ResolvedAnimationProps>,
  effective: ComputedRef<boolean>,
  prepare: () => void,
) {
  let request:
    | {
        page: number
        trigger: 'page' | 'grid'
        environment: string
        started: boolean
        geometry?: string
        signature?: string
      }
    | undefined
  const environment = () =>
    JSON.stringify({
      options: Object.fromEntries(
        Object.entries(chartExportOptions(context.props)).filter(
          ([name]) => !['annotations', 'annotationsVisible'].includes(name),
        ),
      ),
      size: context.containerSize.value,
      amplitudeLimits: context.props.amplitudeLimits,
      hidden: context.props.hiddenSeriesIds,
      presentation: context.props.presentationMode,
    })
  function reset() {
    request = undefined
  }
  function requestPage(page: number, trigger: 'page' | 'grid' = 'page') {
    reset()
    controller.cancelAll()
    // Discard old-page presentation before recording the new request.
    controller.finishAll()
    if (!effective.value || !config.value.animation.enabled) return
    request = { page, trigger, environment: environment(), started: false }
  }
  function reconcile(dataChanged: boolean): 'replay' | 'static' | undefined {
    const current = request
    if (!current) return
    if (!config.value.animation.enabled) {
      // Category closure is handled by finishWhere; it must release, not finish annotations.
      reset()
      return
    }
    if (
      dataChanged ||
      current.page !== context.currentPage.value ||
      current.environment !== environment() ||
      !effective.value ||
      (!current.started && config.value.animation.duration === 0) ||
      ['fallback', 'error'].includes(context.sampling.state.value) ||
      (current.started &&
        (current.geometry !== animationLayoutSignature(context) ||
          current.signature !== context.sampling.requestSignature.value ||
          context.sampling.state.value !== 'success'))
    ) {
      controller.finishAll()
      reset()
      return 'static'
    }
    if (current.started && !controller.getActiveAnimationCount()) {
      reset()
      return
    }
    if (!current.started) {
      prepare()
      current.started = context.sampling.state.value === 'success' && context.layoutReady.value
      if (current.started) {
        current.geometry = animationLayoutSignature(context)
        current.signature = context.sampling.requestSignature.value
      }
    }
    return 'replay'
  }
  function wrapPagination(goToPage: (page: number) => void, count: ComputedRef<number>) {
    return (page: number) => {
      const target = Math.min(count.value, Math.max(1, Math.floor(page)))
      if (target === context.currentPage.value) return
      requestPage(target)
      goToPage(page)
    }
  }
  return {
    reset,
    reconcile,
    wrapPagination,
    requestLayout: () => requestPage(context.currentPage.value, 'grid'),
    enterDuration: () =>
      request?.trigger === 'page' && config.value.animation.duration > 0
        ? 500
        : config.value.animation.duration,
    active: () => !!request && (!request.started || controller.getActiveAnimationCount() > 0),
  }
}
