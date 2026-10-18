/** Value equality for committed public options/data; callbacks retain identity semantics. */
export function equalValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false
  if (Array.isArray(left) !== Array.isArray(right)) return false
  const a = Object.keys(left),
    b = Object.keys(right)
  if (a.length !== b.length) return false
  return a.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(right, key) &&
      equalValue((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
  )
}
