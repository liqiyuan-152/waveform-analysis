import { createResizeObserver } from '../shared/dom/resizeObserver'
import { EventEmitter } from './core/EventEmitter.js'
import { RenderScheduler } from './core/RenderScheduler.js'
import { ActionDispatcher } from './core/ActionDispatcher.js'
import { equalValue } from './config/equal.js'
import { dimensionPixels, parseDimension } from './config/dimension.js'
import { WaveformAnimationController } from './animation/WaveformAnimationController.js'
import type { WaveformAnimation } from './types/animation.js'
import type { WaveformEvents } from './types/events.js'
import type { WaveformAction } from './types/actions.js'
import { SvgRenderer } from './renderer/SvgRenderer.js'
import { resolveTarget } from './core/target.js'
import { OptionManager } from './model/OptionManager.js'
import { LayoutEngine } from './layout/LayoutEngine.js'
import { WaveformModel } from './model/WaveformModel.js'
import { measureYAxis } from './renderer/axes.js'
import type { RenderContext } from './renderer/context.js'
import type { WaveformData } from './types/data.js'
import type { WaveformLayoutChange, WaveformOptions } from './types/options.js'

let instanceCounter = 0
const instances = new WeakMap<HTMLElement, Waveform>()

function onlyDomainPatch(options: WaveformOptions | undefined) {
  if (!options || !Object.keys(options).length) return false
  return Object.entries(options).every(([key, value]) => {
    if (key === 'yAxes')
      return (
        Array.isArray(value) &&
        value.every((axis) =>
          Object.keys(axis).every((field) => ['id', 'min', 'max'].includes(field)),
        )
      )
    return (
      ['xAxis', 'yAxis', 'secondaryYAxis'].includes(key) &&
      value &&
      typeof value === 'object' &&
      Object.keys(value).every((field) => field === 'min' || field === 'max')
    )
  })
}

export class Waveform {
  static init(
    target: string | HTMLElement,
    data: WaveformData = [],
    options: WaveformOptions = {},
  ) {
    const element = resolveTarget(target)!
    return instances.get(element) ?? new Waveform(element, data, options)
  }

  static getInstanceByDom(target: string | HTMLElement): Waveform | undefined {
    const element = resolveTarget(target, false)
    return element ? instances.get(element) : undefined
  }

  private readonly scheduler = new RenderScheduler(() => this.draw())
  private readonly events = new EventEmitter<WaveformEvents>(
    () => !this.destroyed,
    (error) => this.reportError(error),
  )
  private readonly actions: ActionDispatcher
  private readonly renderer: SvgRenderer
  private readonly animationController: WaveformAnimationController
  readonly animation: WaveformAnimation
  private animateNext = true
  private replaceAnimation = false
  private container: HTMLElement
  private readonly model: WaveformModel
  private readonly optionManager: OptionManager

  private get rawOptions() {
    return this.optionManager.raw
  }
  private get hiddenSeriesKeys() {
    return this.model.hiddenKeys
  }
  private resizeObserver?: ResizeObserver
  private readonly instanceId = ++instanceCounter
  private lastNaturalPadding?: WaveformLayoutChange['naturalPadding']
  private latestNaturalPadding?: WaveformLayoutChange['naturalPadding']
  private layoutChangeScheduled = false
  private forceLayoutChange = false
  private destroyed = false

  constructor(target: string | HTMLElement, data: WaveformData, options: WaveformOptions = {}) {
    const el = resolveTarget(target)!
    if (instances.has(el)) throw new Error('Waveform container already has an active instance')
    this.container = el
    this.model = new WaveformModel(data)
    this.actions = new ActionDispatcher(this.model, (key) => this.toggleSeries(key))
    this.optionManager = new OptionManager(options)
    this.renderer = new SvgRenderer(el)
    this.animationController = new WaveformAnimationController(
      el.ownerDocument.defaultView as Window & typeof globalThis,
      (context) => this.renderer.draw(context),
      (error) => this.reportError(error),
    )
    this.animation = this.animationController
    try {
      this.scheduler.request('visual')
      this.setupResponsive()
      instances.set(el, this)
    } catch (error) {
      this.destroy()
      throw error
    }
  }

  updateData(data: WaveformData) {
    this.update({ data })
  }

  updateOptions(options: WaveformOptions) {
    this.update({ options })
  }

  update(change: { data?: WaveformData; options?: WaveformOptions }) {
    this.assertAlive()
    if (change.data === undefined && change.options === undefined) return
    const previousOptions = this.optionManager.resolved
    const previousData = this.model.series
    if (change.options !== undefined) {
      const callback = change.options.onLayoutChange
      const previousCallback = this.rawOptions.onLayoutChange
      this.optionManager.update(change.options)
      if (typeof callback === 'function' && callback !== previousCallback)
        this.forceLayoutChange = true
    }
    const dataChanged = change.data !== undefined && this.model.update(change.data)
    if (!dataChanged && equalValue(previousOptions, this.optionManager.resolved)) return
    if (
      !dataChanged &&
      change.options &&
      Object.keys(change.options).every((key) =>
        ['animation', 'animationUpdate', 'animationEnabled', 'animationThreshold'].includes(key),
      )
    ) {
      const options = this.optionManager.resolved
      this.animationController.configure(options)
      return
    }
    const nextOptions = this.optionManager.resolved
    if (
      previousOptions.responsive.enabled !== nextOptions.responsive.enabled ||
      previousOptions.width !== nextOptions.width ||
      previousOptions.height !== nextOptions.height
    )
      this.setupResponsive()
    this.animationController.invalidateNotifications()
    const geometry = (series: typeof previousData) =>
      series.map((item) => ({ id: item.id, yAxis: item.yAxis, data: item.data }))
    this.animateNext =
      (dataChanged && !equalValue(geometry(previousData), geometry(this.model.series))) ||
      onlyDomainPatch(change.options)
    this.replaceAnimation = this.animateNext
    this.scheduler.request(change.data !== undefined ? 'data' : 'layout')
  }

  on<K extends keyof WaveformEvents>(
    type: K,
    listener: (value: WaveformEvents[K]) => void,
  ): () => void {
    this.assertAlive()
    if (
      !['layoutChange', 'seriesVisibilityChange'].includes(type) ||
      typeof listener !== 'function'
    )
      throw new Error('Invalid Waveform subscription')
    return this.events.on(type, listener)
  }

  dispatchAction(action: WaveformAction) {
    this.assertAlive()
    this.actions.dispatch(action)
  }

  private reportError(error: unknown) {
    const realm = this.container.ownerDocument.defaultView as Window & typeof globalThis
    realm.queueMicrotask(() => {
      if (typeof realm.reportError === 'function') realm.reportError(error)
      else
        realm.setTimeout(() => {
          throw error
        }, 0)
    })
  }

  getOptions(): WaveformOptions {
    if (this.destroyed) throw new Error('Waveform has been destroyed')
    return this.optionManager.getOptions()
  }

  toSVGString(): string {
    if (this.destroyed) return ''
    this.animationController.finish(true)
    return this.renderer.serialize()
  }

  downloadSVG(filename = 'waveform.svg') {
    const source = this.toSVGString()
    if (!source) return
    const realm = this.container.ownerDocument.defaultView as Window & typeof globalThis
    const blob = new realm.Blob([source], { type: 'image/svg+xml;charset=utf-8' })
    const url = realm.URL.createObjectURL(blob)
    const link = this.container.ownerDocument.createElement('a')
    link.href = url
    link.download = filename
    try {
      link.click()
    } finally {
      realm.URL.revokeObjectURL(url)
    }
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    const notifyAbort = this.animationController.destroy()
    if (instances.get(this.container) === this) instances.delete(this.container)
    this.latestNaturalPadding = undefined
    this.layoutChangeScheduled = false
    this.forceLayoutChange = false
    this.scheduler.destroy()
    this.events.clear()
    this.resizeObserver?.disconnect()
    this.renderer.destroy()
    notifyAbort?.()
  }

  private assertAlive() {
    if (this.destroyed) throw new Error('Waveform has been destroyed')
  }

  resize() {
    this.assertAlive()
    this.render()
  }

  private setupResponsive() {
    this.resizeObserver?.disconnect()
    const options = this.optionManager.resolved
    if (
      !options.responsive.enabled &&
      !parseDimension(options.width)?.percent &&
      !parseDimension(options.height)?.percent
    )
      return
    let width = this.container.clientWidth,
      height = this.container.clientHeight
    this.resizeObserver = createResizeObserver(this.container, () => {
      const nextWidth = this.container.clientWidth,
        nextHeight = this.container.clientHeight
      if (nextWidth === width && nextHeight === height) return
      width = nextWidth
      height = nextHeight
      if (!this.destroyed) this.render()
    })
    this.resizeObserver?.observe(this.container)
  }

  private notifyLayoutChange(naturalPadding: WaveformLayoutChange['naturalPadding']) {
    if (this.destroyed) return
    this.latestNaturalPadding = { ...naturalPadding }
    const unchanged =
      this.lastNaturalPadding?.left === naturalPadding.left &&
      this.lastNaturalPadding.right === naturalPadding.right
    if (!this.forceLayoutChange && unchanged && !this.layoutChangeScheduled) return
    if (this.layoutChangeScheduled) return

    this.layoutChangeScheduled = true
    queueMicrotask(() => {
      this.layoutChangeScheduled = false
      if (this.destroyed) return
      const naturalPadding = this.latestNaturalPadding
      if (!naturalPadding) return
      const unchanged =
        this.lastNaturalPadding?.left === naturalPadding.left &&
        this.lastNaturalPadding.right === naturalPadding.right
      const force = this.forceLayoutChange
      this.forceLayoutChange = false
      if (!force && unchanged) return

      this.lastNaturalPadding = { ...naturalPadding }
      this.events.emit(
        'layoutChange',
        { naturalPadding: { ...naturalPadding } },
        this.rawOptions.onLayoutChange,
      )
    })
  }

  private toggleSeries(key: string) {
    this.assertAlive()
    const seriesIndex = this.model.keyedSeries.findIndex((item) => item.key === key)
    const item = this.model.keyedSeries[seriesIndex]
    const visible = this.model.toggle(key)
    this.render()
    this.events.emit('seriesVisibilityChange', {
      seriesKey: key,
      seriesId: item.series.id?.trim() || undefined,
      seriesIndex,
      visible,
    })
  }

  render() {
    this.assertAlive()
    this.animateNext = false
    this.replaceAnimation = false
    this.scheduler.request('visual')
  }

  private draw() {
    this.assertAlive()
    const animate = this.animateNext
    const replace = this.replaceAnimation
    this.animateNext = false
    this.replaceAnimation = false
    const options = this.optionManager.resolved
    const measuredWidth = this.container.clientWidth || 800
    const width = dimensionPixels(options.width, measuredWidth)
    let height = dimensionPixels(options.height, this.container.clientHeight || 320)
    if (options.responsive.enabled && parseDimension(options.width)?.percent) {
      height = Math.min(
        options.responsive.maxHeight,
        Math.max(options.responsive.minHeight, width / options.responsive.aspectRatio),
      )
    }

    const series = this.model.series
    const keyedSeries = this.model.keyedSeries
    const widthDefinition = parseDimension(options.width)!
    const svg = this.renderer.prepare(
      width,
      height,
      widthDefinition.percent ? `${widthDefinition.value}%` : width,
    )

    if (!series.length) {
      this.renderer.clear()
      if (options.emptyState.visible) {
        svg
          .append('text')
          .attr('x', width / 2)
          .attr('y', height / 2)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('fill', options.emptyState.color)
          .attr('font-size', options.emptyState.fontSize)
          .text(options.emptyState.text)
      }
      this.notifyLayoutChange({ left: options.padding.left, right: options.padding.right })
      this.animationController.clear()
      return
    }

    const layout = new LayoutEngine(this.rawOptions, {
      measureAxis: (axis, domain, ticks) =>
        measureYAxis(
          axis,
          domain,
          svg,
          axis.tickStrategy === 'nice'
            ? [...ticks.majorValues, ...ticks.boundaryValues]
            : ticks.majorValues,
        ),
    }).calculate(this.model, options, width, height)
    const {
      plottedSeries,
      singleChannel,
      effectiveOptions,
      naturalPadding,
      p,
      innerWidth,
      innerHeight,
      xDomain,
      x,
      xTicks,
      xTickLayout,
      yAxes,
      yAxisById,
      primaryYAxis,
    } = layout
    const clipId = `waveform-clip-${this.instanceId}`
    const plot = this.renderer.plot(clipId, innerWidth, innerHeight, p.left, p.top)

    const resolvedOptions = { ...effectiveOptions, padding: p }
    const ctx: RenderContext = {
      svg,
      plot,
      series: plottedSeries,
      options: resolvedOptions,
      width,
      height,
      innerWidth,
      innerHeight,
      channelName: singleChannel ? series[0].name?.trim() || 'Series 1' : undefined,
      legendItems: keyedSeries.map((item) => ({
        ...item,
        visible: !this.hiddenSeriesKeys.has(item.key),
      })),
      toggleSeries: (key) => this.actions.dispatchKey(key),
      xTicks,
      xTickLayout,
      x,
      yAxes,
      yAxisById,
      primaryYAxis,
      xDomain,
      clipId,
    }

    this.notifyLayoutChange({ left: naturalPadding.left, right: naturalPadding.right })
    this.animationController.commit(ctx, animate, replace)
  }
}
