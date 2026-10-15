import type { WaveformChartOptions } from '../../types/options'

function copy(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (!value || typeof value !== 'object') return value
  if (seen.has(value)) return seen.get(value)
  if (Array.isArray(value)) {
    const result: unknown[] = []
    seen.set(value, result)
    value.forEach((item) => result.push(copy(item, seen)))
    return result
  }
  const result: Record<string, unknown> = {}
  seen.set(value, result)
  for (const [key, item] of Object.entries(value)) result[key] = copy(item, seen)
  return result
}

/** Read reactive configuration fields; data is deliberately opaque and retains its identity. */
export function snapshotVueOptions(options: WaveformChartOptions): WaveformChartOptions {
  const seen = new WeakMap<object, unknown>()
  return Object.fromEntries(
    Object.entries(options).map(([key, value]) => [
      key,
      key === 'data' ? value : legacyFallback(key, copy(value, seen)),
    ]),
  )
}

/** Keep the Vue prop boundary's historical fallbacks; native setOption still validates inputs. */
function legacyFallback(key: string, value: unknown) {
  if ((key === 'width' || key === 'height') && value !== undefined && !Number.isFinite(value))
    return undefined
  if (
    key === 'panXDomain' &&
    Array.isArray(value) &&
    (!value.every(Number.isFinite) || value[0] >= value[1])
  )
    return undefined
  return value
}

export function equalVueOption(
  previous: unknown,
  next: unknown,
  seen = new WeakMap<object, object>(),
): boolean {
  if (Object.is(previous, next)) return true
  if (!previous || !next || typeof previous !== 'object' || typeof next !== 'object') return false
  if (Array.isArray(previous) !== Array.isArray(next)) return false
  if (seen.get(previous) === next) return true
  seen.set(previous, next)
  const before = Object.entries(previous)
  const after = Object.entries(next)
  return (
    before.length === after.length &&
    before.every(
      ([key, value]) =>
        Object.hasOwn(next, key) &&
        equalVueOption(value, (next as Record<string, unknown>)[key], seen),
    )
  )
}
