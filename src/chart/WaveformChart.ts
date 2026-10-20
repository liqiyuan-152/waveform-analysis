import type {
  WaveformChartInstance,
  WaveformChartAction,
  WaveformChartEvents,
  WaveformChartEventHandler,
} from '../types/native'
import type {
  WaveformChartOptions,
  WaveformChartOptionUpdate,
  WaveformChartInitOptions,
} from '../types/options'
import type {
  WaveformControlTarget,
  WaveformControlResult,
  WaveformImageExportOptions,
} from '../types/controls'
import type { WaveformInteractionMode } from '../types/chart'
import { ChartModel } from '../model/ChartModel'
import { OptionManager } from '../model/OptionManager'
import { ChartLayoutEngine, type ChartLayoutSnapshot } from '../layout/ChartLayoutEngine'
import { SvgChartRenderer } from '../rendering/SvgChartRenderer'
import { ChartCommandDispatcher } from '../controls/ChartCommandDispatcher'
import { validateChartAction } from '../controls/validateChartAction'
import { ChartPaginationController } from '../controls/ChartPaginationController'
import { ChartExporter } from '../export/ChartExporter'
import { ChartEventEmitter } from './ChartEventEmitter'
import { ChartResources } from './ChartResources'
import { ChartUpdateScheduler } from './ChartUpdateScheduler'
import { ChartSizeObserver } from './ChartSizeObserver'
import { WaveformChartError } from './WaveformChartError'
import { NativeSamplingSession } from '../sampling/NativeSamplingSession'
import { RenderSamplingController } from '../sampling/RenderSamplingController'
import { resolveWaveformRenderingOptions } from '../core/renderingOptions'
import { NativeChartAnimation } from '../animation/NativeChartAnimation'
import { InteractionManager } from '../interaction/InteractionManager'
import { ViewportRestorer } from '../interaction/ViewportRestorer'
import { ControlStateObserver } from '../controls/ControlStateObserver'
import { AnnotationController } from '../annotation/AnnotationController'
import { ToolbarView } from '../view/ToolbarView'
import { changedOptionKeys, samplingIndependentOptions } from './optionEffects'
import { refreshLayoutColors } from '../rendering/refreshLayoutColors'

let samplingInstanceSequence = 0
/** Internal facade. The public entry exposes only the registered init factory. */
export class WaveformChart implements WaveformChartInstance {
  private readonly resources = new ChartResources()
  private readonly events = new ChartEventEmitter()
  private readonly model: ChartModel
  private readonly layout: ChartLayoutEngine
  private readonly renderer: SvgChartRenderer
  private readonly scheduler: ChartUpdateScheduler
  private readonly size: ChartSizeObserver
  private readonly commands: ChartCommandDispatcher
  private readonly pagination: ChartPaginationController
  private readonly exporter: ChartExporter
  private readonly sampling: RenderSamplingController
  private readonly animation: NativeChartAnimation
  private readonly interaction: InteractionManager
  private readonly viewportRestorer: ViewportRestorer
  private readonly controlState: ControlStateObserver
  private readonly annotations: AnnotationController
  private readonly toolbar: ToolbarView
  private snapshot?: ChartLayoutSnapshot
  private disposed = false

  constructor(
    host: HTMLElement,
    options: WaveformChartOptions,
    initOptions: WaveformChartInitOptions,
    unregister: () => void,
  ) {
    this.resources.add(unregister)
    try {
      const manager = new OptionManager(options)
      const window = host.ownerDocument.defaultView!
      const session = new NativeSamplingSession(window)
      this.resources.add(() => session.dispose())
      session.prewarm(manager.value)
      this.model = new ChartModel(manager)
      this.resources.add(() => this.model.data.dispose())
      this.layout = new ChartLayoutEngine(this.model, host.ownerDocument)
      const root = host.ownerDocument.createElement('div')
      root.className = 'waveform-chart waveform-native-chart'
      root.style.position = 'relative'
      host.append(root)
      this.resources.add(() => root.remove())
      this.resources.add(() => this.events.dispose())
      this.renderer = new SvgChartRenderer(
        root,
        (id) => this.toggleSeriesVisibility(id),
        () => {
          if (this.disposed) return
          this.snapshot = undefined
          this.scheduler.refresh('layout')
          this.controlState?.schedule()
        },
        (page) => {
          this.annotations?.cancel()
          this.interaction.cancel()
          this.animation.changePage(page, (target) => this.pagination.change(target))
        },
      )
      this.resources.add(() => this.renderer.dispose())
      this.sampling = new RenderSamplingController(
        `native-${++samplingInstanceSequence}`,
        this.events,
        () => {
          if (this.disposed) return
          this.snapshot = undefined
          this.scheduler.refresh('layout', this.sampling.ready())
          this.controlState?.schedule()
        },
        session,
      )
      this.resources.add(() => this.sampling.dispose())
      this.scheduler = new ChartUpdateScheduler(
        {
          request: (callback) =>
            window.requestAnimationFrame
              ? window.requestAnimationFrame(callback)
              : window.setTimeout(callback, 16),
          cancel: (id) =>
            window.cancelAnimationFrame ? window.cancelAnimationFrame(id) : window.clearTimeout(id),
          microtask: (callback) => window.queueMicrotask(callback),
        },
        {
          data: () => {},
          layout: () => {
            this.ensureLayout(false)
          },
          sampling: () => this.prepareSampling(),
          view: () => {
            const layout = refreshLayoutColors(
              this.animation.render(this.ensureLayout()),
              this.model.data.series,
              this.model.options.value.lineColor,
            )
            if (this.disposed) return false
            const rendered = this.renderer.render(
              layout,
              this.model.options.value,
              this.model.visibility.snapshot(this.model.options.value.hiddenSeriesIds),
            )
            if (!this.disposed) this.interaction.render()
            if (!this.disposed) this.annotations.render(layout)
            if (!this.disposed) this.toolbar.render(layout, this.model.options.value)
            return rendered
          },
          isStable: () =>
            this.renderer.isStable() && this.sampling.ready() && this.animation.isStable(),
        },
        this.events,
      )
      this.resources.add(() => this.scheduler.dispose())
      this.size = new ChartSizeObserver(
        host,
        root,
        () => this.model.options.value,
        () => {
          this.annotations?.cancel()
          this.interaction?.cancel()
          this.changed()
        },
        initOptions.autoResize,
        () =>
          this.renderer.remeasureTitle(
            this.size.value.width,
            this.model.options.value,
            this.snapshot?.titleHeight,
          ),
      )
      this.resources.add(() => this.size.dispose())
      this.animation = new NativeChartAnimation(
        this.model,
        () => this.ensureLayout(),
        this.sampling,
        window,
        () => this.scheduler.refresh('view'),
      )
      this.resources.add(() => this.animation.dispose())
      this.interaction = new InteractionManager(root, this.renderer.svg, {
        model: this.model,
        layout: () => this.ensureLayout(false),
        events: this.events,
        window,
        changed: () => this.changed(),
        stabilize: (preserveViewport) => this.animation.stabilize(preserveViewport),
        alive: () => !this.disposed,
      })
      this.resources.add(() => this.interaction.dispose())
      this.annotations = new AnnotationController(
        root,
        this.renderer.svg,
        {
          model: this.model,
          layout: () => this.ensureLayout(false),
          events: this.events,
          window,
          changed: () => this.changed(),
          stabilize: () => this.animation.stabilize(),
          alive: () => !this.disposed,
        },
        (active, cancelled) => this.interaction.blockAnnotationHover(active, cancelled),
        undefined,
        () => this.animation.annotations(),
      )
      this.resources.add(() => this.annotations.dispose())
      this.viewportRestorer = new ViewportRestorer(
        this.model,
        () => this.ensureLayout(false),
        () => {
          this.snapshot = undefined
        },
      )
      this.commands = new ChartCommandDispatcher(
        this.model,
        () => this.ensureLayout(false),
        this.events,
        () => this.changed(),
      )
      this.pagination = new ChartPaginationController(
        this.model,
        () => this.ensureLayout(false),
        () => this.changed(),
        this.events,
        () => this.disposed,
      )
      this.exporter = new ChartExporter(this.renderer.svg, this.scheduler, () => ({
        ...this.size.value,
        width: this.ensureLayout(false).renderedWidth,
        titleHeight: this.ensureLayout(false).titleHeight,
      }))
      this.resources.add(() => this.exporter.dispose())
      this.toolbar = new ToolbarView(root, {
        state: () => this.commands.getControlState(),
        commands: {
          execute: (type, target, domain) =>
            this.executeToolbarAction(
              type === 'set-domain' ? { type, target, domain: domain! } : { type, target },
            ),
          setInteractionMode: (mode) => this.executeToolbarAction({ type: 'set-mode', mode }),
        },
        cancel: () => this.interaction.cancel(),
        export: (options) => this.exportImage(options),
      })
      this.resources.add(() => this.toolbar.dispose())
      this.size.resize()
      this.controlState = new ControlStateObserver(
        () => this.commands.getControlState(),
        this.events,
        (callback) => window.queueMicrotask(callback),
      )
      this.resources.add(() => this.controlState.dispose())
      this.prepareSampling()
      this.scheduler.invalidate('data')
    } catch (error) {
      this.resources.dispose()
      throw error
    }
  }

  private assertAlive() {
    if (this.disposed) throw new WaveformChartError('instance-disposed', 'Chart is disposed')
  }
  private ensureLayout(includeGeometry = true) {
    if (includeGeometry && !this.snapshot?.geometryReady) this.snapshot = undefined
    this.snapshot ??= this.layout.calculate(
      this.size.value.width,
      this.size.value.height,
      this.renderer.measureTitle(this.size.value.width, this.model.options.value),
      this.sampling.overrides,
      includeGeometry,
    )
    return this.snapshot
  }

  private changed(invalidateSampling = true) {
    if (invalidateSampling) this.sampling?.invalidatePending()
    this.snapshot = undefined
    this.exporter?.invalidate()
    this.scheduler.invalidate('layout')
    this.interaction?.clearHover()
    this.controlState?.schedule()
    this.annotations?.reconcile()
  }

  private prepareSampling() {
    this.sampling.update({
      series: this.model.data.series,
      tracks: this.ensureLayout(false).trackLayouts,
      rendering: resolveWaveformRenderingOptions(this.model.options.value.rendering),
    })
  }
  setOption(options: WaveformChartOptionUpdate) {
    this.assertAlive()
    const oldMode = this.model.presentation.mode(this.model.options.value)
    const previousOptions = this.model.options.value
    const previousLayout = this.ensureLayout(false)
    const captured = this.viewportRestorer.capture((track) => this.interaction.pendingDomain(track))
    const result = this.model.setOption(options)
    if (!result.changed) return
    const keys = changedOptionKeys(previousOptions, this.model.options.value)
    if (keys.every((key) => key === 'lineColor') || keys.every((key) => key === 'showTooltip')) {
      if (previousOptions.lineColor !== this.model.options.value.lineColor && this.snapshot)
        refreshLayoutColors(
          this.snapshot,
          this.model.data.series,
          this.model.options.value.lineColor,
        )
      this.exporter.invalidate()
      this.scheduler.invalidate('view')
      return
    }
    this.annotations.cancel()
    if (result.dataChanged) {
      this.sampling.prepareReplacement(this.model.data.series)
      this.viewportRestorer.restore(captured, previousOptions)
      this.interaction.rebindData(previousOptions)
    } else {
      this.interaction.cancel()
      this.viewportRestorer.reconcileBounds(previousOptions)
    }
    this.changed(Object.keys(options).some((key) => !samplingIndependentOptions.has(key)))
    this.size.resize()
    this.pagination.reconcile(previousOptions, previousLayout)
    if (this.disposed) return
    this.prepareSampling()
    const mode = this.model.presentation.mode(this.model.options.value)
    if (mode !== oldMode) this.events.emit('interaction-mode-change', mode)
  }

  resize() {
    this.assertAlive()
    this.size.resize()
  }

  private toggleSeriesVisibility(seriesId: string) {
    if (this.disposed || !this.model.data.series.some((series) => series.id === seriesId)) return
    const controlled = this.model.options.value.hiddenSeriesIds
    const visible = this.model.visibility.snapshot(controlled).has(seriesId)
    const ids = this.model.visibility.request(seriesId, visible, controlled)
    this.annotations.cancel()
    this.interaction.cancel()
    if (controlled === undefined) {
      this.viewportRestorer.clearFitBounds()
      this.changed()
    }
    this.events.emit('update:hidden-series-ids', ids.slice())
    this.events.emit('series-visibility-change', {
      seriesId,
      visible,
      hiddenSeriesIds: ids.slice(),
    })
  }

  dispatchAction(action: WaveformChartAction) {
    return this.executeAction(action, 'api')
  }

  private executeToolbarAction(action: WaveformChartAction) {
    return this.executeAction(action, 'toolbar')
  }

  private executeAction(action: WaveformChartAction, source: 'api' | 'toolbar') {
    this.assertAlive()
    validateChartAction(action)
    this.annotations.cancel()
    this.interaction.cancel()
    this.animation.stabilize(action.type !== 'set-mode')
    this.assertAlive()
    return this.commands.execute(action, source)
  }

  zoomIn(target?: WaveformControlTarget) {
    return this.dispatchAction({ type: 'zoom-in', target })
  }
  zoomOut(target?: WaveformControlTarget) {
    return this.dispatchAction({ type: 'zoom-out', target })
  }
  fitToData(target?: WaveformControlTarget) {
    return this.dispatchAction({ type: 'fit', target })
  }
  setInteractionMode(mode: WaveformInteractionMode) {
    return this.dispatchAction({ type: 'set-mode', mode })
  }

  resetViewport(trackIndex?: number): void
  resetViewport(target: WaveformControlTarget): WaveformControlResult
  resetViewport(target?: number | WaveformControlTarget) {
    this.assertAlive()
    if (typeof target === 'object') return this.dispatchAction({ type: 'reset', target })
    this.annotations.cancel()
    this.interaction.cancel()
    this.animation.stabilize(true)
    this.assertAlive()
    this.commands.legacyReset(target)
  }

  setViewportDomain(domain: [number, number], trackIndex?: number): void
  setViewportDomain(domain: [number, number], target: WaveformControlTarget): WaveformControlResult
  setViewportDomain(domain: [number, number], target?: number | WaveformControlTarget) {
    this.assertAlive()
    if (typeof target === 'object')
      return this.dispatchAction({ type: 'set-domain', domain, target })
    this.annotations.cancel()
    this.interaction.cancel()
    this.animation.stabilize(true)
    this.assertAlive()
    this.commands.legacySet(domain, target)
  }

  getControlState() {
    this.assertAlive()
    return this.commands.getControlState()
  }
  exportImage(options?: WaveformImageExportOptions) {
    return this.exporter.exportImage(options)
  }

  on<K extends keyof WaveformChartEvents>(event: K, handler: WaveformChartEventHandler<K>) {
    this.assertAlive()
    return this.events.on(event, handler)
  }

  off<K extends keyof WaveformChartEvents>(event: K, handler?: WaveformChartEventHandler<K>) {
    this.events.off(event, handler)
  }

  isDisposed() {
    return this.disposed
  }
  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.events.dispose()
    this.resources.dispose()
    this.snapshot = undefined
  }
}
