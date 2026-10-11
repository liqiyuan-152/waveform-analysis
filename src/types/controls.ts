import type { WaveformInteractionMode } from './chart'

export type WaveformToolbarItem =
  'zoom-box' | 'pan' | 'annotate' | 'zoom-in' | 'zoom-out' | 'reset' | 'fit' | 'export'
export interface WaveformToolbarOptions {
  visible?: boolean
  display?: 'hover' | 'always'
  position?: 'top-right' | 'top-left'
  items?: WaveformToolbarItem[]
}
export interface WaveformControlTarget {
  trackId?: string
}
export type WaveformControlAction = 'zoom-in' | 'zoom-out' | 'set-domain' | 'fit' | 'reset'
export interface WaveformCommandMetadata {
  commandId?: string
  source?: 'toolbar' | 'api'
  action?: WaveformControlAction
}
export type WaveformTargetStatus = 'applied' | 'unchanged' | 'disabled' | 'empty-data'
export interface WaveformViewportSnapshot {
  xDomain: [number, number]
  yDomains: Record<string, [number, number]>
}
export interface WaveformTargetResult {
  trackId: string
  status: WaveformTargetStatus
  before?: WaveformViewportSnapshot
  after?: WaveformViewportSnapshot
}
export type WaveformControlResult =
  | {
      kind: 'viewport'
      status: WaveformTargetStatus | 'invalid-target' | 'invalid-domain'
      targets: WaveformTargetResult[]
    }
  | {
      kind: 'mode'
      status: 'applied' | 'requested' | 'unchanged' | 'disabled'
      targets: []
    }
export interface WaveformControlState {
  mode: WaveformInteractionMode
  independent: boolean
  targets: Array<{
    trackId: string
    label: string
    viewport: WaveformViewportSnapshot
    available: Record<WaveformControlAction, boolean>
  }>
  available: Record<WaveformToolbarItem, boolean>
}
export interface WaveformImageExportOptions {
  format?: 'png' | 'svg'
  scale?: number
  backgroundColor?: string
}
export type WaveformImageExportErrorCode =
  | 'export-invalid-options'
  | 'export-unavailable'
  | 'export-busy'
  | 'export-cancelled'
  | 'export-render-failed'
  | 'export-stale'
  | 'export-timeout'
export interface WaveformImageExportError extends Error {
  code: WaveformImageExportErrorCode
}
export interface WaveformChartHandle {
  zoomIn(target?: WaveformControlTarget): WaveformControlResult
  zoomOut(target?: WaveformControlTarget): WaveformControlResult
  fitToData(target?: WaveformControlTarget): WaveformControlResult
  resetViewport(trackIndex?: number): void
  resetViewport(target: WaveformControlTarget): WaveformControlResult
  setViewportDomain(domain: [number, number], trackIndex?: number): void
  setViewportDomain(domain: [number, number], target: WaveformControlTarget): WaveformControlResult
  setInteractionMode(mode: WaveformInteractionMode): WaveformControlResult
  getControlState(): WaveformControlState
  exportImage(options?: WaveformImageExportOptions): Promise<Blob>
}
