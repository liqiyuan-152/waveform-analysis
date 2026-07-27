import type { WaveformAnnotation } from '../../types'
import type {
  AnnotationBoxLayout,
  AnnotationPlacement,
  AnnotationTrackLayout,
  RenderedAnnotation,
} from './types'
import {
  ANNOTATION_BOX_MAX_WIDTH,
  ANNOTATION_BOX_MIN_HEIGHT,
  ANNOTATION_BOX_MIN_WIDTH,
  ANNOTATION_CONNECTOR_LENGTH,
  ANNOTATION_TEXT_GLYPH_HEIGHT,
  ANNOTATION_TEXT_LINE_HEIGHT,
  ANNOTATION_TEXT_PADDING,
  ANNOTATION_TEXT_VERTICAL_PADDING,
  isFiniteAnnotation,
  measureAnnotationTextWidth,
  resolveAnnotationStyle,
  wrapAnnotationText,
} from './markup'

function isWithin(value: number, domain: [number, number]): boolean {
  return value >= Math.min(domain[0], domain[1]) && value <= Math.max(domain[0], domain[1])
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

function isPlacementWithinBounds(
  anchorX: number,
  anchorY: number,
  width: number,
  height: number,
  placement: AnnotationPlacement,
  plotWidth: number,
  plotHeight: number,
): boolean {
  const position = boxPosition(anchorX, anchorY, width, height, placement)
  return (
    position.x >= 0 &&
    position.y >= 0 &&
    position.x + width <= plotWidth &&
    position.y + height <= plotHeight
  )
}

function chooseBestPlacement(
  anchorX: number,
  anchorY: number,
  width: number,
  height: number,
  plotWidth: number,
  plotHeight: number,
): AnnotationPlacement {
  const placements: AnnotationPlacement[] = [
    'top',
    'bottom',
    'right',
    'left',
    'top-right',
    'top-left',
    'bottom-right',
    'bottom-left',
  ]

  // Try to find a placement that fits completely within bounds
  for (const placement of placements) {
    if (
      isPlacementWithinBounds(anchorX, anchorY, width, height, placement, plotWidth, plotHeight)
    ) {
      return placement
    }
  }

  // Fallback to 'top' if no placement fits perfectly (will be clamped)
  return 'top'
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

export function layoutAnnotationBox(
  anchorX: number,
  anchorY: number,
  lines: string[],
  plotWidth: number,
  plotHeight: number,
  placement: AnnotationPlacement,
  offsetX = 0,
  offsetY = 0,
): AnnotationBoxLayout {
  const { width, height } = annotationBoxSize(lines, plotWidth, plotHeight)
  const position = boxPosition(anchorX, anchorY, width, height, placement)
  const clamped = clampBox(
    {
      x: position.x + offsetX,
      y: position.y + offsetY,
      width,
      height,
      lineEndX: anchorX,
      lineEndY: anchorY,
    },
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

    // Choose best placement only if no manual offset exists
    const hasManualOffset =
      (Number.isFinite(annotation.labelOffsetX) && annotation.labelOffsetX !== 0) ||
      (Number.isFinite(annotation.labelOffsetY) && annotation.labelOffsetY !== 0)

    const { width, height } = annotationBoxSize(lines, trackWidth, localHeight)
    const placement: AnnotationPlacement = hasManualOffset
      ? 'top'
      : chooseBestPlacement(localAnchorX, localAnchorY, width, height, trackWidth, localHeight)

    const box = layoutAnnotationBox(
      localAnchorX,
      localAnchorY,
      lines,
      trackWidth,
      localHeight,
      placement,
      Number.isFinite(annotation.labelOffsetX) ? annotation.labelOffsetX : 0,
      Number.isFinite(annotation.labelOffsetY) ? annotation.labelOffsetY : 0,
    )

    const globalBox = {
      ...box,
      x: box.x + trackLeft,
      y: box.y + track.top,
      lineEndX: box.lineEndX + trackLeft,
      lineEndY: box.lineEndY + track.top,
    }
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
