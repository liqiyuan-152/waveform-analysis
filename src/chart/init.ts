import type { WaveformChartInstance } from '../types/native'
import type { WaveformChartOptions, WaveformChartInitOptions } from '../types/options'
import { chartRegistry } from './ChartRegistry'
import { WaveformChart } from './WaveformChart'
import { WaveformChartError } from './WaveformChartError'

function isContainer(value: unknown): value is HTMLElement {
  if (!value || typeof value !== 'object' || !('ownerDocument' in value)) return false
  const window = (value.ownerDocument as Document | undefined)?.defaultView
  return !!window && value instanceof window.HTMLElement
}

export function init(
  dom: HTMLElement,
  options: WaveformChartOptions = {},
  initOptions: WaveformChartInitOptions = {},
): WaveformChartInstance {
  if (!isContainer(dom))
    throw new WaveformChartError('invalid-container', 'Expected an HTMLElement')
  const existing = chartRegistry.get(dom)
  if (existing && !existing.isDisposed()) return existing
  if (
    !initOptions ||
    typeof initOptions !== 'object' ||
    Array.isArray(initOptions) ||
    (initOptions.autoResize !== undefined && typeof initOptions.autoResize !== 'boolean')
  )
    throw new WaveformChartError('invalid-option', 'Invalid initOptions', 'autoResize')
  const chart = new WaveformChart(dom, options, initOptions, () => chartRegistry.delete(dom))
  chartRegistry.set(dom, chart)
  return chart
}

export function getInstanceByDom(dom: HTMLElement): WaveformChartInstance | undefined {
  return chartRegistry.get(dom)
}

export function dispose(domOrInstance: HTMLElement | WaveformChartInstance) {
  if (isContainer(domOrInstance)) chartRegistry.get(domOrInstance)?.dispose()
  else domOrInstance.dispose()
}
