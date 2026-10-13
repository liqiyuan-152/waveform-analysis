import type { AnimationConfig } from '../core/types'
import { sameShape } from '../core/validation'
import { interpolateValue, equalValues } from '../core/values'
import type {
  AnimationBinding,
  DataUpdateOptions,
  GeometryTransitionInput,
  GeometryTransitionFrame,
} from '../types'
import { clampProgress, copyGeometry, presetConfig, validDomain, validateBinding } from './shared'

export function createPathTransitionAnimation(
  input: GeometryTransitionInput,
  write: (frame: GeometryTransitionFrame) => void,
  options: DataUpdateOptions = {},
): AnimationConfig {
  const compatible = input.compatible
  if (typeof write !== 'function' || typeof compatible !== 'boolean')
    throw new TypeError('Invalid geometry transition')
  const from = copyGeometry(input.from),
    to = copyGeometry(input.to)
  const keys = Object.keys(to)
  if (compatible) {
    if (keys.length !== Object.keys(from).length || keys.some((key) => !Object.hasOwn(from, key))) {
      throw new TypeError('Compatible geometry requires identical channels')
    }
    if (keys.some((key) => !sameShape(from[key], to[key])))
      throw new TypeError('Track values must have identical shapes')
  }
  const unchanged = compatible && keys.every((key) => equalValues(from[key], to[key]))
  return presetConfig(options, {
    duration: unchanged ? 0 : (options.duration ?? 300),
    during: (p, frame) => {
      if (frame.terminal) write({ kind: 'settled', values: to })
      else if (compatible)
        write({
          kind: 'interpolate',
          progress: p,
          values: Object.fromEntries(
            keys.map((key) => [key, interpolateValue(from[key], to[key], p)]),
          ),
        })
      else {
        const q = clampProgress(p)
        write({ kind: 'crossfade', from, to, fromOpacity: 1 - q, toOpacity: q })
      }
    },
  })
}
export function createYAxisScaleAnimation(
  binding: AnimationBinding<[number, number]>,
  to: [number, number],
  options: DataUpdateOptions = {},
): AnimationConfig {
  validateBinding(binding)
  const target: [number, number] = [...to]
  if (!validDomain(target))
    throw new RangeError('Target domain must be finite and strictly increasing')
  let from: [number, number] | undefined
  return presetConfig(options, {
    initialize: () => {
      from = [...binding.read()]
      if (!validDomain(from))
        throw new RangeError('Initial domain must be finite and strictly increasing')
    },
    during: (p, frame) => {
      if (frame.terminal) {
        binding.write([...target])
        return
      }
      const q = clampProgress(p)
      const start = from ?? target
      const value = interpolateValue(start, target, q) as [number, number]
      binding.write(validDomain(value) ? value : [...target])
    },
  })
}
