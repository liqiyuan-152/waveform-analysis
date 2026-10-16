import { init } from '../../chart/init'
import { WaveformChartError } from '../../chart/WaveformChartError'
import { imageExportError } from '../../export/imageExportError'
import type { WaveformChartEvents, WaveformChartInstance } from '../../types/native'
import type { WaveformChartOptions, WaveformChartOptionUpdate } from '../../types/options'
import type {
  WaveformChartHandle,
  WaveformControlTarget,
  WaveformControlResult,
  WaveformImageExportOptions,
} from '../../types/controls'
import type { WaveformInteractionMode } from '../../types/chart'
import { equalVueOption, snapshotVueOptions } from './vueOptionSnapshot'

export type VueChartEmit = <K extends keyof WaveformChartEvents>(
  event: K,
  ...args: WaveformChartEvents[K]
) => void

const events = [
  'update:interactionMode',
  'interaction-mode-change',
  'control-state-change',
  'point-hover',
  'zoom-intent',
  'zoom-change',
  'zoom-end',
  'pan-end',
  'zoom-reset',
  'update:annotations',
  'update:hidden-series-ids',
  'series-visibility-change',
  'annotation-create',
  'annotation-update',
  'annotation-delete',
  'page-change',
  'sampling-complete',
  'sampling-backend-change',
  'sampling-error',
  'rendered',
  'finished',
] as const satisfies readonly (keyof WaveformChartEvents)[]

// Adding a native event requires a deliberate forwarding decision here.
const allEventsForwarded: Exclude<keyof WaveformChartEvents, (typeof events)[number]> extends never
  ? true
  : never = true
void allEventsForwarded

/** Owns only framework attachment, prop differences and stable event forwarding. */
export class VueChartAdapter implements WaveformChartHandle {
  private chart?: WaveformChartInstance
  private previous: WaveformChartOptions = {}
  private disposed = false
  private readonly subscriptions: Array<() => void> = []

  constructor(private readonly emit: VueChartEmit) {}

  attach(dom: HTMLElement, options: WaveformChartOptions) {
    if (this.disposed) throw new WaveformChartError('instance-disposed', 'Adapter is disposed')
    if (this.chart) return
    this.attachSnapshot(dom, snapshotVueOptions(options))
  }

  /** Internal handoff: the Vue component already captured reactive configuration. */
  attachSnapshot(dom: HTMLElement, captured: WaveformChartOptions) {
    if (this.disposed) throw new WaveformChartError('instance-disposed', 'Adapter is disposed')
    if (this.chart) return
    this.chart = init(dom, captured)
    this.previous = captured
    const forward = <K extends keyof WaveformChartEvents>(event: K) => {
      this.subscriptions.push(this.instance.on(event, (...args) => this.emit(event, ...args)))
    }
    events.forEach(forward)
  }

  update(options: WaveformChartOptions) {
    if (!this.chart || this.disposed) return
    this.updateSnapshot(snapshotVueOptions(options))
  }

  /** Internal handoff; direct adapter callers retain the defensive update boundary above. */
  updateSnapshot(next: WaveformChartOptions) {
    if (!this.chart || this.disposed) return
    const patch: WaveformChartOptionUpdate = {}
    const collect = <K extends keyof WaveformChartOptions>(key: K) => {
      const equal =
        key === 'data'
          ? Object.is(this.previous[key], next[key])
          : equalVueOption(this.previous[key], next[key])
      if (!equal) patch[key] = next[key]
    }
    const keys = new Set([...Object.keys(this.previous), ...Object.keys(next)])
    // Keep mutations outside a chained new Set(...).forEach(...) expression:
    // a constructor purity annotation can otherwise cover the chained call
    // when the published bundle is parsed and tree-shaken by a consumer.
    for (const key of keys) collect(key as keyof WaveformChartOptions)
    if (Object.keys(patch).length) this.instance.setOption(patch)
    this.previous = next
  }

  private get instance() {
    if (!this.chart || this.disposed)
      throw new WaveformChartError('instance-disposed', 'Adapter is not attached')
    return this.chart
  }

  zoomIn(target?: WaveformControlTarget) {
    return this.instance.zoomIn(target)
  }
  zoomOut(target?: WaveformControlTarget) {
    return this.instance.zoomOut(target)
  }
  fitToData(target?: WaveformControlTarget) {
    return this.instance.fitToData(target)
  }
  resetViewport(trackIndex?: number): void
  resetViewport(target: WaveformControlTarget): WaveformControlResult
  resetViewport(target?: number | WaveformControlTarget): void | WaveformControlResult {
    return typeof target === 'object'
      ? this.instance.resetViewport(target)
      : this.instance.resetViewport(target)
  }
  setViewportDomain(domain: [number, number], trackIndex?: number): void
  setViewportDomain(domain: [number, number], target: WaveformControlTarget): WaveformControlResult
  setViewportDomain(domain: [number, number], target?: number | WaveformControlTarget) {
    return typeof target === 'object'
      ? this.instance.setViewportDomain(domain, target)
      : this.instance.setViewportDomain(domain, target)
  }
  setInteractionMode(mode: WaveformInteractionMode) {
    return this.instance.setInteractionMode(mode)
  }
  getControlState() {
    return this.instance.getControlState()
  }
  exportImage(options?: WaveformImageExportOptions): Promise<Blob> {
    if (!this.chart || this.disposed) return Promise.reject(imageExportError('export-cancelled'))
    return this.chart.exportImage(options)
  }
  resize() {
    this.chart?.resize()
  }
  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.subscriptions.splice(0).forEach((unsubscribe) => unsubscribe())
    this.chart?.dispose()
    this.chart = undefined
    this.previous = {}
  }
}
