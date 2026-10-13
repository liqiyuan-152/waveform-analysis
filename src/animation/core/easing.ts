import {
  easeLinear,
  easeQuadIn,
  easeQuadOut,
  easeQuadInOut,
  easeCubicIn,
  easeCubicOut,
  easeCubicInOut,
  easePolyIn,
  easePolyOut,
  easePolyInOut,
  easeSinIn,
  easeSinOut,
  easeSinInOut,
  easeExpIn,
  easeExpOut,
  easeExpInOut,
  easeCircleIn,
  easeCircleOut,
  easeCircleInOut,
  easeBackIn,
  easeBackOut,
  easeBackInOut,
  easeElasticIn,
  easeElasticOut,
  easeElasticInOut,
  easeBounceIn,
  easeBounceOut,
  easeBounceInOut,
} from 'd3'
import type { EasingFunction, EasingType } from './types'

const easings: Record<EasingType, EasingFunction> = {
  linear: easeLinear,
  quadIn: easeQuadIn,
  quadOut: easeQuadOut,
  quadInOut: easeQuadInOut,
  cubicIn: easeCubicIn,
  cubicOut: easeCubicOut,
  cubicInOut: easeCubicInOut,
  quartIn: easePolyIn.exponent(4),
  quartOut: easePolyOut.exponent(4),
  quartInOut: easePolyInOut.exponent(4),
  quintIn: easePolyIn.exponent(5),
  quintOut: easePolyOut.exponent(5),
  quintInOut: easePolyInOut.exponent(5),
  sineIn: easeSinIn,
  sineOut: easeSinOut,
  sineInOut: easeSinInOut,
  expoIn: easeExpIn,
  expoOut: easeExpOut,
  expoInOut: easeExpInOut,
  circIn: easeCircleIn,
  circOut: easeCircleOut,
  circInOut: easeCircleInOut,
  backIn: easeBackIn,
  backOut: easeBackOut,
  backInOut: easeBackInOut,
  elasticIn: easeElasticIn,
  elasticOut: easeElasticOut,
  elasticInOut: easeElasticInOut,
  bounceIn: easeBounceIn,
  bounceOut: easeBounceOut,
  bounceInOut: easeBounceInOut,
}

/** Preserve custom functions and overshoot; execution errors belong to the task runtime. */
export function getEasingFunction(easing: EasingType | EasingFunction): EasingFunction {
  if (typeof easing === 'function') return easing
  if (typeof easing !== 'string' || !Object.hasOwn(easings, easing)) {
    throw new TypeError(`Unknown animation easing: ${String(easing)}`)
  }
  return easings[easing]
}
