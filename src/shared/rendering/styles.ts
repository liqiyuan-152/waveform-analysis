import {
  curveLinear,
  curveStep,
  curveStepBefore,
  curveStepAfter,
  symbolCircle,
  symbolSquare,
  symbolTriangle,
  symbolDiamond,
} from 'd3'

export function curveFor(type: string) {
  switch (type) {
    case 'step-start':
      return curveStepBefore
    case 'step-middle':
      return curveStep
    case 'step-end':
    case 'step-after':
      return curveStepAfter
    default:
      return curveLinear
  }
}

export function pointSymbol(type: string) {
  switch (type) {
    case 'square':
      return symbolSquare
    case 'triangle':
      return symbolTriangle
    case 'diamond':
      return symbolDiamond
    default:
      return symbolCircle
  }
}

export function lineDash(style: string, dashDot: string): string | undefined {
  if (style === 'dashed') return '8 5'
  if (style === 'dash-dot') return dashDot
  return undefined
}
