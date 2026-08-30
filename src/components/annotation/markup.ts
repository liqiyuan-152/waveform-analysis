import type { WaveformAnnotation, WaveformAnnotationStyle, WaveformLineType } from '../../types'
import {
  isWaveformPointSource,
  pointSourceFromPoints,
  type WaveformPointSource,
} from '../../core/waveformPointSource'
import type { AnnotationHit, AnnotationSeriesCandidate, AnnotationTrackLayout } from './types'

export const DEFAULT_ANNOTATION_STYLE = {
  borderColor: '#1677ff',
  textColor: '#333333',
  backgroundColor: 'rgba(255, 255, 255, 0.92)',
} as const

export const ANNOTATION_HIT_RADIUS = 12
export const ANNOTATION_AMBIGUITY_DISTANCE = 5
export const ANNOTATION_MAX_TEXT_LENGTH = 40
export const ANNOTATION_TEXT_PADDING = 8
export const ANNOTATION_BOX_MIN_WIDTH = ANNOTATION_TEXT_PADDING * 2
export const ANNOTATION_BOX_MAX_WIDTH = 240
export const ANNOTATION_BOX_MIN_HEIGHT = 26
export const ANNOTATION_TEXT_HORIZONTAL_PADDING = ANNOTATION_TEXT_PADDING
export const ANNOTATION_TEXT_VERTICAL_PADDING = ANNOTATION_TEXT_PADDING
export const ANNOTATION_TEXT_LINE_HEIGHT = 16
export const ANNOTATION_TEXT_GLYPH_HEIGHT = 14
export const ANNOTATION_TEXT_FONT = '12px Arial, sans-serif'
export const ANNOTATION_CONNECTOR_LENGTH = 32

type PointCollection = Array<{ x: number; y: number }> | WaveformPointSource

function sourceFor(points: PointCollection) {
  return isWaveformPointSource(points) ? points : pointSourceFromPoints(points)
}

function findNearestPointOnScreen(
  track: AnnotationTrackLayout,
  pointerX: number,
  pointerY: number,
): { point: { x: number; y: number }; screenX: number; screenY: number; distance: number } | null {
  let nearest: {
    point: { x: number; y: number }
    screenX: number
    screenY: number
    distance: number
  } | null = null
  const source = track.series.source ?? pointSourceFromPoints(track.series.points)
  for (let index = 0; index < source.length; index += 1) {
    const point = source.pointAt(index)!
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue
    const screenX = track.xScale(point.x)
    const screenY = track.top + track.yScale(point.y)
    const distance = Math.hypot(screenX - pointerX, screenY - pointerY)
    if (!nearest || distance < nearest.distance) {
      nearest = { point, screenX, screenY, distance }
    }
  }
  return nearest
}

export function findNearestPointByX(
  points: PointCollection,
  xValue: number,
): { x: number; y: number } | null {
  const source = sourceFor(points)
  if (!source.length || !Number.isFinite(xValue)) return null
  const rightIndex = source.visibleRange([xValue, xValue]).start
  const right = source.pointAt(Math.min(rightIndex, source.length - 1))!
  const left = source.pointAt(Math.max(0, rightIndex - 1))!
  return Math.abs(xValue - left.x) < Math.abs(right.x - xValue) ? left : right
}

export function interpolateAnnotationPoint(
  points: PointCollection,
  xValue: number,
  lineType: WaveformLineType = 'linear',
): { x: number; y: number } | null {
  const source = sourceFor(points)
  if (!source.length || !Number.isFinite(xValue)) return null
  const first = source.pointAt(0)!
  const last = source.pointAt(source.length - 1)!
  if (xValue < first.x || xValue > last.x) return null
  if (source.length === 1) return xValue === first.x ? { ...first } : null

  const rightIndex = source.visibleRange([xValue, xValue]).start
  const right = source.pointAt(Math.min(rightIndex, source.length - 1))!
  if (right.x === xValue || rightIndex === 0) return { x: xValue, y: right.y }
  if (lineType === 'none') return null

  const left = source.pointAt(rightIndex - 1)!
  if (lineType === 'step-start') return { x: xValue, y: right.y }
  if (lineType === 'step-middle') {
    return { x: xValue, y: xValue < (left.x + right.x) / 2 ? left.y : right.y }
  }
  if (lineType === 'step-end' || lineType === 'step-after') {
    return { x: xValue, y: left.y }
  }
  const xSpan = right.x - left.x
  if (xSpan === 0) return { x: xValue, y: right.y }
  const ratio = (xValue - left.x) / xSpan
  return { x: xValue, y: left.y + (right.y - left.y) * ratio }
}

export function findAnnotationSeriesCandidates(
  tracks: AnnotationTrackLayout[],
  xValue: number,
  pointerX: number,
  pointerY: number,
): AnnotationSeriesCandidate[] {
  return tracks
    .flatMap((track): AnnotationSeriesCandidate[] => {
      if (track.series.lineType === 'none') {
        const nearest = findNearestPointOnScreen(track, pointerX, pointerY)
        if (!nearest) return []
        return [
          {
            trackIndex: track.index,
            seriesId: track.series.id,
            name: track.series.name?.trim() || track.series.id,
            color: track.series.color || DEFAULT_ANNOTATION_STYLE.borderColor,
            unit: track.series.unit,
            ...nearest,
          },
        ]
      }
      const interpolatedPoint = interpolateAnnotationPoint(
        track.series.source ?? pointSourceFromPoints(track.series.points),
        xValue,
        track.series.lineType,
      )
      if (!interpolatedPoint) return []

      // Always snap to nearest actual sample point for the anchor
      // This ensures annotations align with visible data points
      const nearestPoint = findNearestPointByX(
        track.series.source ?? pointSourceFromPoints(track.series.points),
        xValue,
      )
      if (!nearestPoint) return []

      // Use interpolated point for distance calculation to get accurate series selection
      const interpolatedScreenX = track.xScale(interpolatedPoint.x)
      const interpolatedScreenY = track.top + track.yScale(interpolatedPoint.y)

      // But use nearest point as the actual anchor
      const screenX = track.xScale(nearestPoint.x)
      const screenY = track.top + track.yScale(nearestPoint.y)

      return [
        {
          trackIndex: track.index,
          seriesId: track.series.id,
          name: track.series.name?.trim() || track.series.id,
          color: track.series.color || DEFAULT_ANNOTATION_STYLE.borderColor,
          unit: track.series.unit,
          point: nearestPoint,
          screenX,
          screenY,
          distance: Math.hypot(interpolatedScreenX - pointerX, interpolatedScreenY - pointerY),
        },
      ]
    })
    .sort(
      (first, second) => first.distance - second.distance || first.trackIndex - second.trackIndex,
    )
}
let annotationTextMeasurementContext: CanvasRenderingContext2D | null | undefined

function fallbackAnnotationTextWidth(text: string): number {
  return Array.from(text).reduce(
    (width, character) => width + (character.codePointAt(0)! > 0xff ? 12 : 6.7),
    0,
  )
}

export function measureAnnotationTextWidth(text: string): number {
  if (annotationTextMeasurementContext === undefined) {
    annotationTextMeasurementContext = null
    if (typeof document !== 'undefined' && typeof CanvasRenderingContext2D !== 'undefined') {
      const canvas = document.createElement('canvas')
      annotationTextMeasurementContext = canvas.getContext('2d')
      if (annotationTextMeasurementContext) {
        annotationTextMeasurementContext.font = ANNOTATION_TEXT_FONT
      }
    }
  }
  return (
    annotationTextMeasurementContext?.measureText(text).width ?? fallbackAnnotationTextWidth(text)
  )
}

export function resolveAnnotationStyle(style?: WaveformAnnotationStyle) {
  return {
    borderColor: style?.borderColor || DEFAULT_ANNOTATION_STYLE.borderColor,
    textColor: style?.textColor || DEFAULT_ANNOTATION_STYLE.textColor,
    backgroundColor: style?.backgroundColor || DEFAULT_ANNOTATION_STYLE.backgroundColor,
  }
}

export function isFiniteAnnotation(annotation: WaveformAnnotation): boolean {
  return (
    Boolean(annotation.id && annotation.seriesId) &&
    Number.isFinite(annotation.x) &&
    Number.isFinite(annotation.y) &&
    typeof annotation.text === 'string' &&
    annotation.text.trim().length > 0
  )
}

export function wrapAnnotationText(text: string, maxChars = 10): string[] {
  const lines: string[] = []
  text.split(/\r?\n/).forEach((paragraph) => {
    const chars = Array.from(paragraph)
    if (chars.length === 0) {
      lines.push('')
      return
    }
    for (let index = 0; index < chars.length; index += maxChars) {
      lines.push(chars.slice(index, index + maxChars).join(''))
    }
  })
  return lines.length ? lines : ['']
}

export function findNearestAnnotationPoint(
  tracks: AnnotationTrackLayout[],
  pointerX: number,
  pointerY: number,
  maxDistance = ANNOTATION_HIT_RADIUS,
): AnnotationHit | null {
  let closest: AnnotationHit | null = null

  tracks.forEach((track) => {
    const localY = pointerY - track.top
    const source = track.series.source ?? pointSourceFromPoints(track.series.points)
    if (localY < 0 || localY > track.height || source.length === 0) return

    const xValue = track.xScale.invert(pointerX)
    const centerIndex = source.visibleRange([xValue, xValue]).start
    const firstIndex = Math.max(0, centerIndex - 2)
    const lastIndex = Math.min(source.length - 1, centerIndex + 2)

    for (let candidateIndex = firstIndex; candidateIndex <= lastIndex; candidateIndex += 1) {
      const point = source.pointAt(candidateIndex)!
      const screenX = track.xScale(point.x)
      const screenY = track.yScale(point.y) + track.top
      const distance = Math.hypot(screenX - pointerX, screenY - pointerY)
      if (distance > maxDistance || (closest && distance >= closest.distance)) continue
      closest = {
        trackIndex: track.index,
        seriesId: track.series.id,
        point,
        screenX,
        screenY,
        distance,
      }
    }
  })

  return closest
}

export { layoutAnnotationBox, layoutAnnotations } from './annotationLayout'
