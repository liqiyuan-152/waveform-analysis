import { ZERO_LINE_DEFAULTS } from '../components/core/constants'
import type { WaveformFrameStyle, WaveformZeroLineOptions } from '../types/chart'

export function resolveFrameStyle(style?: WaveformFrameStyle) {
  const width = style?.borderWidth
  return {
    borderColor: style?.borderColor || '#1f2937',
    borderWidth: typeof width === 'number' && Number.isFinite(width) && width >= 0 ? width : 1,
    borderStyle:
      style?.borderStyle === 'dashed' || style?.borderStyle === 'dotted'
        ? style.borderStyle
        : 'solid',
    backgroundColor: style?.backgroundColor || 'transparent',
  }
}

export function resolveZeroLine(
  options: WaveformZeroLineOptions = {},
): Required<WaveformZeroLineOptions> {
  const { width, opacity, boundaryThreshold } = options
  return {
    visible: options.visible !== false,
    color: options.color || ZERO_LINE_DEFAULTS.COLOR,
    width:
      typeof width === 'number' && Number.isFinite(width) && width > 0
        ? width
        : ZERO_LINE_DEFAULTS.WIDTH,
    dash: options.dash ?? ZERO_LINE_DEFAULTS.DASH,
    opacity:
      typeof opacity === 'number' && Number.isFinite(opacity) && opacity >= 0 && opacity <= 1
        ? opacity
        : ZERO_LINE_DEFAULTS.OPACITY,
    boundaryThreshold:
      typeof boundaryThreshold === 'number' &&
      Number.isFinite(boundaryThreshold) &&
      boundaryThreshold >= 0
        ? boundaryThreshold
        : ZERO_LINE_DEFAULTS.BOUNDARY_THRESHOLD,
  }
}
