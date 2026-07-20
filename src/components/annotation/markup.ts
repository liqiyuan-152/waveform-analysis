import { bisector } from 'd3'

import type { WaveformAnnotation, WaveformAnnotationStyle } from '../../types'
import type {
  AnnotationBoxLayout,
  AnnotationHit,
  AnnotationPlacement,
  AnnotationSeriesCandidate,
  AnnotationTrackLayout,
  RenderedAnnotation,
} from './types'

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

const ANNOTATION_PLACEMENTS: AnnotationPlacement[] = [
  'top',
  'bottom',
  'right',
  'left',
  'top-right',
  'top-left',
  'bottom-right',
  'bottom-left',
]

const pointBisector = bisector((point: { x: number }) => point.x)

export function interpolateAnnotationPoint(
  points: Array<{ x: number; y: number }>,
  xValue: number,
): { x: number; y: number } | null {
  if (!points.length || !Number.isFinite(xValue)) return null
  const first = points[0]
  const last = points[points.length - 1]
  if (xValue < first.x || xValue > last.x) return null
  if (points.length === 1) return xValue === first.x ? { ...first } : null

  const rightIndex = pointBisector.left(points, xValue)
  const right = points[Math.min(rightIndex, points.length - 1)]
  if (right.x === xValue || rightIndex === 0) return { x: xValue, y: right.y }

  const left = points[rightIndex - 1]
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
      const point = interpolateAnnotationPoint(track.series.points, xValue)
      if (!point) return []
      const screenX = track.xScale(point.x)
      const screenY = track.top + track.yScale(point.y)
      return [
        {
          trackIndex: track.index,
          seriesId: track.series.id,
          name: track.series.name?.trim() || track.series.id,
          color: track.series.color || DEFAULT_ANNOTATION_STYLE.borderColor,
          unit: track.series.unit,
          point,
          screenX,
          screenY,
          distance: Math.hypot(screenX - pointerX, screenY - pointerY),
          xValue,
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
    if (localY < 0 || localY > track.height || track.series.points.length === 0) return

    const xValue = track.xScale.invert(pointerX)
    const centerIndex = pointBisector.center(track.series.points, xValue)
    const firstIndex = Math.max(0, centerIndex - 2)
    const lastIndex = Math.min(track.series.points.length - 1, centerIndex + 2)

    for (let candidateIndex = firstIndex; candidateIndex <= lastIndex; candidateIndex += 1) {
      const point = track.series.points[candidateIndex]
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

function isWithin(value: number, domain: [number, number]): boolean {
  return value >= Math.min(domain[0], domain[1]) && value <= Math.max(domain[0], domain[1])
}

function overlaps(first: AnnotationBoxLayout, second: AnnotationBoxLayout): boolean {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  )
}

function containsPoint(box: AnnotationBoxLayout, x: number, y: number): boolean {
  return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height
}

function clampBox(box: AnnotationBoxLayout, width: number, height: number): AnnotationBoxLayout {
  const x = Math.max(0, Math.min(box.x, Math.max(0, width - box.width)))
  const y = Math.max(0, Math.min(box.y, Math.max(0, height - box.height)))
  return {
    ...box,
    x,
    y,
    lineEndX: Math.max(x, Math.min(box.lineEndX, x + box.width)),
    lineEndY: Math.max(y, Math.min(box.lineEndY, y + box.height)),
  }
}

function resolveConnectorStart(
  box: AnnotationBoxLayout,
  anchorX: number,
  anchorY: number,
): { x: number; y: number } {
  const centerX = box.x + box.width / 2
  const centerY = box.y + box.height / 2
  const deltaX = anchorX - centerX
  const deltaY = anchorY - centerY

  if (Math.abs(deltaX) * box.height > Math.abs(deltaY) * box.width) {
    const x = deltaX >= 0 ? box.x + box.width : box.x
    const ratio = deltaX === 0 ? 0 : (x - centerX) / deltaX
    return {
      x,
      y: Math.max(box.y, Math.min(box.y + box.height, centerY + deltaY * ratio)),
    }
  }

  const y = deltaY >= 0 ? box.y + box.height : box.y
  const ratio = deltaY === 0 ? 0 : (y - centerY) / deltaY
  return {
    x: Math.max(box.x, Math.min(box.x + box.width, centerX + deltaX * ratio)),
    y,
  }
}

function boxPosition(
  anchorX: number,
  anchorY: number,
  width: number,
  height: number,
  placement: AnnotationPlacement,
): { x: number; y: number } {
  const centeredX = anchorX - width / 2
  const centeredY = anchorY - height / 2
  const rightX = anchorX + ANNOTATION_CONNECTOR_LENGTH
  const leftX = anchorX - width - ANNOTATION_CONNECTOR_LENGTH
  const topY = anchorY - height - ANNOTATION_CONNECTOR_LENGTH
  const bottomY = anchorY + ANNOTATION_CONNECTOR_LENGTH

  switch (placement) {
    case 'top':
      return { x: centeredX, y: topY }
    case 'bottom':
      return { x: centeredX, y: bottomY }
    case 'right':
      return { x: rightX, y: centeredY }
    case 'left':
      return { x: leftX, y: centeredY }
    case 'top-right':
      return { x: rightX, y: topY }
    case 'top-left':
      return { x: leftX, y: topY }
    case 'bottom-right':
      return { x: rightX, y: bottomY }
    case 'bottom-left':
      return { x: leftX, y: bottomY }
  }
}

function annotationBoxSize(
  lines: string[],
  plotWidth: number,
  plotHeight: number,
): { width: number; height: number } {
  return {
    width: Math.min(
      plotWidth,
      Math.max(
        ANNOTATION_BOX_MIN_WIDTH,
        Math.min(
          ANNOTATION_BOX_MAX_WIDTH,
          Math.ceil(Math.max(...lines.map(measureAnnotationTextWidth), 0)) +
            ANNOTATION_TEXT_PADDING * 2,
        ),
      ),
    ),
    height: Math.min(
      plotHeight,
      Math.max(
        ANNOTATION_BOX_MIN_HEIGHT,
        (lines.length - 1) * ANNOTATION_TEXT_LINE_HEIGHT +
          ANNOTATION_TEXT_GLYPH_HEIGHT +
          ANNOTATION_TEXT_VERTICAL_PADDING * 2,
      ),
    ),
  }
}

function isPlacementWithinBounds(
  anchorX: number,
  anchorY: number,
  lines: string[],
  plotWidth: number,
  plotHeight: number,
  placement: AnnotationPlacement,
): boolean {
  const { width, height } = annotationBoxSize(lines, plotWidth, plotHeight)
  const position = boxPosition(anchorX, anchorY, width, height, placement)
  return (
    position.x >= 0 &&
    position.y >= 0 &&
    position.x + width <= plotWidth &&
    position.y + height <= plotHeight
  )
}

export function layoutAnnotationBox(
  anchorX: number,
  anchorY: number,
  lines: string[],
  plotWidth: number,
  plotHeight: number,
  placement: AnnotationPlacement,
): AnnotationBoxLayout {
  const { width, height } = annotationBoxSize(lines, plotWidth, plotHeight)
  const position = boxPosition(anchorX, anchorY, width, height, placement)
  const clamped = clampBox(
    { x: position.x, y: position.y, width, height, lineEndX: anchorX, lineEndY: anchorY },
    plotWidth,
    plotHeight,
  )
  const connectorStart = resolveConnectorStart(clamped, anchorX, anchorY)
  return { ...clamped, lineEndX: connectorStart.x, lineEndY: connectorStart.y }
}

export function layoutAnnotations(
  annotations: WaveformAnnotation[],
  tracks: AnnotationTrackLayout[],
  plotWidth: number,
  plotHeight: number,
): RenderedAnnotation[] {
  const placedByTrack = new Map<number, AnnotationBoxLayout[]>()
  const rendered: RenderedAnnotation[] = []

  annotations.forEach((annotation) => {
    if (!isFiniteAnnotation(annotation)) return
    const track = tracks.find((candidate) => candidate.series.id === annotation.seriesId)
    if (!track) return
    const xDomain = track.xScale.domain() as [number, number]
    const yDomain = track.yScale.domain() as [number, number]
    if (!isWithin(annotation.x, xDomain) || !isWithin(annotation.y, yDomain)) return

    const lines = wrapAnnotationText(annotation.text)
    const trackLeft = track.left ?? 0
    const trackWidth = track.width ?? plotWidth
    const localAnchorX = track.xScale(annotation.x)
    const anchorX = trackLeft + localAnchorX
    const anchorY = track.yScale(annotation.y) + track.top
    const localHeight = Math.min(track.height, Math.max(0, plotHeight - track.top))
    const localAnchorY = anchorY - track.top
    const placed = placedByTrack.get(track.index) || []
    let placement = ANNOTATION_PLACEMENTS[0]
    let box = layoutAnnotationBox(
      localAnchorX,
      localAnchorY,
      lines,
      trackWidth,
      localHeight,
      placement,
    )
    for (const candidatePlacement of ANNOTATION_PLACEMENTS) {
      if (
        !isPlacementWithinBounds(
          localAnchorX,
          localAnchorY,
          lines,
          trackWidth,
          localHeight,
          candidatePlacement,
        )
      ) {
        continue
      }
      const candidate = layoutAnnotationBox(
        localAnchorX,
        localAnchorY,
        lines,
        trackWidth,
        localHeight,
        candidatePlacement,
      )
      if (
        !containsPoint(candidate, localAnchorX, localAnchorY) &&
        !placed.some((item) => overlaps(candidate, item))
      ) {
        box = candidate
        placement = candidatePlacement
        break
      }
    }

    const globalBox = {
      ...box,
      x: box.x + trackLeft,
      y: box.y + track.top,
      lineEndX: box.lineEndX + trackLeft,
      lineEndY: box.lineEndY + track.top,
    }
    placed.push(box)
    placedByTrack.set(track.index, placed)
    rendered.push({
      annotation,
      trackIndex: track.index,
      anchorX,
      anchorY,
      placement,
      lines,
      box: {
        ...globalBox,
      },
      style: resolveAnnotationStyle(annotation.style),
    })
  })

  return rendered
}
