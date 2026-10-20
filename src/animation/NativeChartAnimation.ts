import { Animator } from './core/Animator'
import { WaveformPresentation } from './presentation/WaveformPresentation'
import { resolveAnimationProps } from './presentation/config'
import { animationGridShape, type AnimationContext } from './presentation/context'
import type { ChartModel } from '../model/ChartModel'
import type { ChartLayoutSnapshot } from '../layout/ChartLayoutEngine'
import type { RenderSamplingController } from '../sampling/RenderSamplingController'

let instanceSequence = 0

/** Binds shared presentation to the host window and owns its animation resources. */
export class NativeChartAnimation {
  private readonly animator: Animator
  private readonly presentation: WaveformPresentation
  private readonly media?: MediaQueryList
  private disposed = false
  private reduced = false
  private previousGrid: string
  private previousData: AnimationContext['props']['data']
  private previousConfig: ReturnType<typeof resolveAnimationProps>
  private previousAnnotationsVisible: boolean
  private readonly context: AnimationContext
  private lastSnapshot?: ChartLayoutSnapshot
  private lastOptions?: ChartModel['options']['value']
  private lastSamplingState?: string
  private lastSamplingSignature?: string

  constructor(
    private readonly model: ChartModel,
    private readonly layout: () => ChartLayoutSnapshot,
    sampling: RenderSamplingController,
    private readonly window: Window,
    private readonly refresh: () => void,
  ) {
    const frames = !!window.requestAnimationFrame && !!window.cancelAnimationFrame
    this.animator = new Animator({
      now: () => window.performance.now(),
      requestFrame: frames ? (callback) => window.requestAnimationFrame(callback) : undefined,
      cancelFrame: frames ? (handle) => window.cancelAnimationFrame(handle) : undefined,
      setTimer: (callback, delay) => window.setTimeout(callback, delay),
      clearTimer: (handle) => window.clearTimeout(handle as number),
    })
    this.media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    this.reduced = this.media?.matches ?? false
    this.context = {
      get props() {
        return model.options.value
      },
      tracks: {
        get value() {
          return layout().trackLayouts
        },
      },
      currentPage: {
        get value() {
          return model.presentation.page
        },
      },
      containerSize: {
        get value() {
          const value = layout()
          return [value.width, value.height]
        },
      },
      preparedSeries: {
        get value() {
          return model.data.series
        },
      },
      layoutReady: {
        get value() {
          return layout().innerWidth > 0 && layout().innerHeight > 0
        },
      },
      innerWidth: {
        get value() {
          return layout().innerWidth
        },
      },
      innerHeight: {
        get value() {
          return layout().innerHeight
        },
      },
      sampling: {
        state: {
          get value() {
            return sampling.state
          },
        },
        requestSignature: {
          get value() {
            return sampling.signature
          },
        },
      },
    }
    this.previousGrid = animationGridShape(this.context)
    this.previousData = model.options.value.data
    this.previousConfig = resolveAnimationProps(model.options.value)
    this.previousAnnotationsVisible = model.options.value.annotationsVisible
    const effective = () => {
      const config = resolveAnimationProps(model.options.value)
      return (
        !this.reduced &&
        frames &&
        config.animationEnabled &&
        model.data.series.reduce((total, series) => total + series.source.length, 0) <
          config.animationThreshold
      )
    }
    this.presentation = new WaveformPresentation(
      this.context,
      {
        get value() {
          return resolveAnimationProps(model.options.value)
        },
      },
      {
        get value() {
          return effective()
        },
      },
      () => {
        if (!this.disposed) refresh()
      },
      `waveform-native-animation-${++instanceSequence}`,
      this.animator,
    )
    this.media?.addEventListener?.('change', this.reduceChanged)
    window.document.addEventListener('visibilitychange', this.visibilityChanged)
    this.visibilityChanged()
  }

  private readonly reduceChanged = (event: MediaQueryListEvent) => {
    if (this.disposed) return
    this.reduced = event.matches
    this.lastSnapshot = undefined
    if (event.matches) this.presentation.controller.finishAll()
    this.refresh()
  }

  private readonly visibilityChanged = () => {
    this.presentation.controller.setPauseReason('document-hidden', this.window.document.hidden)
  }

  render(snapshot: ChartLayoutSnapshot) {
    if (this.disposed) return snapshot
    const sampling = this.context.sampling
    if (
      this.lastSnapshot === snapshot &&
      this.lastOptions === this.model.options.value &&
      this.lastSamplingState === sampling.state.value &&
      this.lastSamplingSignature === sampling.requestSignature.value
    )
      return { ...snapshot, trackLayouts: this.presentation.presentationTracks() }
    this.lastSnapshot = snapshot
    this.lastOptions = this.model.options.value
    this.lastSamplingState = sampling.state.value
    this.lastSamplingSignature = sampling.requestSignature.value
    const config = resolveAnimationProps(this.model.options.value)
    this.presentation.reconcile()
    if (this.disposed) return snapshot
    const grid = animationGridShape(this.context),
      data = this.model.options.value.data
    this.presentation.reconcileGrid(grid, data, this.previousGrid, this.previousData)
    this.previousGrid = grid
    this.previousData = data
    if (this.disposed) return snapshot
    if (!this.model.options.value.annotationsVisible && this.previousAnnotationsVisible)
      this.presentation.hideAnnotations()
    if (!config.animation.enabled && this.previousConfig.animation.enabled)
      this.presentation.disableEnter()
    if (!config.animationUpdate.enabled && this.previousConfig.animationUpdate.enabled)
      this.presentation.disableUpdate()
    if (!config.animationAnnotation.enabled && this.previousConfig.animationAnnotation.enabled)
      this.presentation.disableAnnotation()
    this.previousConfig = config
    this.previousAnnotationsVisible = this.model.options.value.annotationsVisible
    return { ...snapshot, trackLayouts: this.presentation.presentationTracks() }
  }

  changePage(page: number, change: (page: number) => void) {
    this.presentation.pagination.wrapPagination(change, { value: this.layout().pageCount })(page)
  }

  annotations() {
    return this.presentation.presentationAnnotations()
  }

  stabilize(preserveViewport = false) {
    if (!this.disposed) this.presentation.stabilize(preserveViewport)
  }

  isStable() {
    return (
      !this.disposed &&
      !this.presentation.pagination.active() &&
      this.presentation.controller.getActiveAnimationCount() === 0
    )
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.media?.removeEventListener?.('change', this.reduceChanged)
    this.window.document.removeEventListener('visibilitychange', this.visibilityChanged)
    this.presentation.dispose()
    this.animator.destroy()
  }
}
