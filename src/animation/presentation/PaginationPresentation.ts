import {
  animationLayoutSignature,
  type AnimationContext,
  type AnimationValueReader,
} from './context'
import type { ResolvedAnimationProps } from './config'
import type { WaveformAnimationController } from '../WaveformAnimationController'
import { chartExportOptions } from '../../components/controls/chartExportOptions'

interface ReplayRequest {
  page: number
  trigger: 'page' | 'grid'
  environment: string
  started: boolean
  geometry?: string
  signature?: string
}

/** Owns entrance replay requests; the normal series pipeline owns drawing tasks. */
export class PaginationPresentation {
  private request?: ReplayRequest

  constructor(
    private readonly context: AnimationContext,
    private readonly controller: WaveformAnimationController,
    private readonly config: AnimationValueReader<ResolvedAnimationProps>,
    private readonly effective: AnimationValueReader<boolean>,
    private readonly prepare: () => void,
  ) {}

  private environment() {
    const context = this.context
    return JSON.stringify({
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
  }

  reset() {
    this.request = undefined
  }

  private requestPage(page: number, trigger: 'page' | 'grid' = 'page') {
    this.reset()
    this.controller.cancelAll()
    // Discard old-page presentation before recording the new request.
    this.controller.finishAll()
    if (!this.effective.value || !this.config.value.animation.enabled) return
    this.request = { page, trigger, environment: this.environment(), started: false }
  }

  reconcile(dataChanged: boolean): 'replay' | 'static' | undefined {
    const current = this.request
    if (!current) return
    if (!this.config.value.animation.enabled) {
      // Category closure releases requests without finishing unrelated annotations.
      this.reset()
      return
    }
    const context = this.context
    if (
      dataChanged ||
      current.page !== context.currentPage.value ||
      current.environment !== this.environment() ||
      !this.effective.value ||
      (!current.started && this.config.value.animation.duration === 0) ||
      ['fallback', 'error'].includes(context.sampling.state.value) ||
      (current.started &&
        (current.geometry !== animationLayoutSignature(context) ||
          current.signature !== context.sampling.requestSignature.value ||
          context.sampling.state.value !== 'success'))
    ) {
      this.controller.finishAll()
      this.reset()
      return 'static'
    }
    if (current.started && !this.controller.getActiveAnimationCount()) {
      this.reset()
      return
    }
    if (!current.started) {
      this.prepare()
      current.started = context.sampling.state.value === 'success' && context.layoutReady.value
      if (current.started) {
        current.geometry = animationLayoutSignature(context)
        current.signature = context.sampling.requestSignature.value
      }
    }
    return 'replay'
  }

  // Passed directly out of the Vue adapter; preserve the owning instance when detached.
  readonly wrapPagination =
    (goToPage: (page: number) => void, count: AnimationValueReader<number>) => (page: number) => {
      const target = Math.min(count.value, Math.max(1, Math.floor(page)))
      if (target === this.context.currentPage.value) return
      this.requestPage(target)
      goToPage(page)
    }

  requestLayout() {
    this.requestPage(this.context.currentPage.value, 'grid')
  }

  enterDuration() {
    return this.request?.trigger === 'page' && this.config.value.animation.duration > 0
      ? 500
      : this.config.value.animation.duration
  }

  active() {
    return (
      !!this.request && (!this.request.started || this.controller.getActiveAnimationCount() > 0)
    )
  }
}
