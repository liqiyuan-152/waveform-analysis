/** Copies public configuration/data values while preserving callback identities. */
export function snapshot<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => snapshot(item)) as T
  if (value && typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value)
    if (prototype === Object.prototype || prototype === null) {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, snapshot(item)]),
      ) as T
    }
  }
  return value
}
