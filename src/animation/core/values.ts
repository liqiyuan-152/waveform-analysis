import type { AnimationDirection, AnimationValue } from './types'

export function mapValue(a: AnimationValue, fn: (value: number) => number): AnimationValue {
  return combineValues(a, a, fn)
}
export function combineValues(
  a: AnimationValue,
  b: AnimationValue,
  fn: (a: number, b: number) => number,
): AnimationValue {
  if (typeof a === 'number') return fn(a, b as number)
  return a.map((value, i) =>
    typeof value === 'number'
      ? fn(value, (b as number[])[i])
      : value.map((item, j) => fn(item, (b as number[][])[i][j])),
  ) as AnimationValue
}
export const addValues = (a: AnimationValue, b: AnimationValue) =>
  combineValues(a, b, (x, y) => x + y)
export const subtractValues = (a: AnimationValue, b: AnimationValue) =>
  combineValues(a, b, (x, y) => x - y)
export const interpolateValue = (a: AnimationValue, b: AnimationValue, p: number) =>
  combineValues(a, b, (x, y) => (p === 0 ? x : p === 1 ? y : (1 - p) * x + p * y))
export function equalValues(a: AnimationValue, b: AnimationValue): boolean {
  if (typeof a === 'number' || typeof b === 'number') return a === b
  return a.length === b.length && a.every((value, i) => equalValues(value, b[i]))
}
export function directedProgress(
  p: number,
  iteration: number,
  direction: AnimationDirection,
): number {
  const reverse =
    direction === 'reverse' ||
    (direction === 'alternate' && iteration % 2 === 1) ||
    (direction === 'alternate-reverse' && iteration % 2 === 0)
  return reverse ? 1 - p : p
}
