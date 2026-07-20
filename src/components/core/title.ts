export const TITLE_AREA_MIN_HEIGHT = 44
export const TITLE_AREA_MAX_HEIGHT = 160
export const TITLE_AREA_HORIZONTAL_PADDING = 24
export const TITLE_AREA_VERTICAL_PADDING = 18

const TRIGONOMETRY_EPSILON = 1e-6

export interface RotatedTitleLayout {
  textWidth: number
  textHeight: number
  visualWidth: number
  visualHeight: number
  areaHeight: number
  scale: number
  wrapped: boolean
}

export interface RotatedTitleLayoutOptions {
  naturalWidth: number
  naturalHeight: number
  availableWidth: number
  rotation: number
}

function clampPositive(value: number): number {
  return Number.isFinite(value) ? Math.max(1, value) : 1
}

export function calculateRotatedTitleLayout({
  naturalWidth,
  naturalHeight,
  availableWidth,
  rotation,
}: RotatedTitleLayoutOptions): RotatedTitleLayout {
  const safeNaturalWidth = clampPositive(naturalWidth)
  const safeNaturalHeight = clampPositive(naturalHeight)
  const safeAvailableWidth = clampPositive(availableWidth)
  const safeRotation = Number.isFinite(rotation) ? rotation : 0
  const radians = (safeRotation * Math.PI) / 180
  const absoluteCosine = Math.abs(Math.cos(radians))
  const absoluteSine = Math.abs(Math.sin(radians))
  const normalizedRotation = ((safeRotation % 360) + 360) % 360
  const isRotated =
    normalizedRotation > TRIGONOMETRY_EPSILON &&
    Math.abs(normalizedRotation - 360) > TRIGONOMETRY_EPSILON

  if (!isRotated) {
    const lineCount = Math.max(1, Math.ceil(safeNaturalWidth / safeAvailableWidth))
    const textWidth = safeAvailableWidth
    const textHeight = safeNaturalHeight * lineCount
    return {
      textWidth,
      textHeight,
      visualWidth: textWidth,
      visualHeight: textHeight,
      areaHeight: Math.max(TITLE_AREA_MIN_HEIGHT, textHeight + TITLE_AREA_VERTICAL_PADDING),
      scale: 1,
      wrapped: lineCount > 1,
    }
  }

  const maximumVisualHeight = TITLE_AREA_MAX_HEIGHT - TITLE_AREA_VERTICAL_PADDING
  const naturalVisualWidth = safeNaturalWidth * absoluteCosine + safeNaturalHeight * absoluteSine
  const naturalVisualHeight = safeNaturalWidth * absoluteSine + safeNaturalHeight * absoluteCosine
  const scale = Math.min(
    1,
    safeAvailableWidth / naturalVisualWidth,
    maximumVisualHeight / naturalVisualHeight,
  )
  const visualWidth = naturalVisualWidth * scale
  const visualHeight = naturalVisualHeight * scale
  const areaHeight = Math.min(
    TITLE_AREA_MAX_HEIGHT,
    Math.max(TITLE_AREA_MIN_HEIGHT, visualHeight + TITLE_AREA_VERTICAL_PADDING),
  )

  return {
    textWidth: safeNaturalWidth,
    textHeight: safeNaturalHeight,
    visualWidth,
    visualHeight,
    areaHeight,
    scale,
    wrapped: false,
  }
}
