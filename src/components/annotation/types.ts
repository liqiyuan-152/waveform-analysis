import type { ScaleLinear } from 'd3'

import type { WaveformAnnotation, WaveformPoint } from '../../types'

export interface AnnotationTrackLayout {
  index: number
  series: {
    id: string
    name?: string
    color?: string
    unit?: string
    points: WaveformPoint[]
  }
  left?: number
  top: number
  width?: number
  height: number
  xScale: ScaleLinear<number, number>
  yScale: ScaleLinear<number, number>
}

export interface AnnotationHit {
  trackIndex: number
  seriesId: string
  point: WaveformPoint
  screenX: number
  screenY: number
  distance: number
  /** Data-space X under the pointer; omitted for snapped sample hits. */
  xValue?: number
}

export interface AnnotationSeriesCandidate extends AnnotationHit {
  name: string
  color: string
  unit?: string
}

export interface AnnotationEditorAnchor {
  x: number
  y: number
}

export interface AnnotationBoxLayout {
  x: number
  y: number
  width: number
  height: number
  lineEndX: number
  lineEndY: number
}

export type AnnotationPlacement =
  | 'top'
  | 'bottom'
  | 'right'
  | 'left'
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left'

export interface RenderedAnnotation {
  annotation: WaveformAnnotation
  trackIndex: number
  anchorX: number
  anchorY: number
  placement: AnnotationPlacement
  lines: string[]
  box: AnnotationBoxLayout
  style: {
    borderColor: string
    textColor: string
    backgroundColor: string
  }
}

export type AnnotationEditorDraft =
  | { mode: 'add'; annotation: WaveformAnnotation; anchor: AnnotationEditorAnchor }
  | {
      mode: 'edit'
      annotation: WaveformAnnotation
      previous: WaveformAnnotation
      anchor: AnnotationEditorAnchor
    }

export interface AnnotationContextMenuState {
  x: number
  y: number
  annotationId?: string
  createHit?: AnnotationHit
  editorAnchor?: AnnotationEditorAnchor
}

export interface AnnotationSeriesInfo {
  id: string
  name: string
  color: string
  unit?: string
}
