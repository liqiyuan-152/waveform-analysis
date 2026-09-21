import type { SingleWaveformData, WaveformPoint, WaveformTypedValues } from '../types'
import { createCompactSamplePointSource } from './compactSamplePointSource'

export interface WaveformPointRange {
  start: number
  end: number
}

export interface WaveformPointMetrics {
  xMinimum: number
  xMaximum: number
  yMinimum: number
  yMaximum: number
  hasErrorPoints: boolean
}

export interface WorkerSamplingNumericDataset {
  kind: 'typed'
  x: Float64Array
  y: WaveformTypedValues
}

export interface WorkerSamplingSampleDataset {
  kind: 'samples'
  values: WaveformTypedValues
  sampleRate: number
  startTime: number
  /** Present only when invalid input samples created gaps in the original time sequence. */
  sourceIndexes?: Uint32Array
}

export interface WorkerSamplingPointDataset {
  kind: 'points'
  points: readonly WaveformPoint[]
}

export type WorkerSamplingDataset =
  WorkerSamplingNumericDataset | WorkerSamplingSampleDataset | WorkerSamplingPointDataset

/**
 * Internal source abstraction. Compact inputs stay as numeric columns until a caller needs a
 * specific point object for SVG, hover, or annotation work.
 */
export interface WaveformPointSource {
  readonly length: number
  readonly isCompact: boolean
  pointAt(index: number): WaveformPoint | undefined
  pointsInRange(start?: number, end?: number): WaveformPoint[]
  visibleRange(domain: [number, number]): WaveformPointRange
  nearestPoint(x: number): WaveformPoint | undefined
  metrics(includeErrors?: boolean): WaveformPointMetrics
  toWorkerDataset(): WorkerSamplingDataset
}

function normalizeError(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

function clampRange(start: number, end: number, length: number): WaveformPointRange {
  const boundedStart = Math.max(0, Math.min(length, Math.floor(start)))
  return { start: boundedStart, end: Math.max(boundedStart, Math.min(length, Math.floor(end))) }
}

function lowerBound(length: number, valueAt: (index: number) => number, value: number) {
  let start = 0
  let end = length
  while (start < end) {
    const middle = start + Math.floor((end - start) / 2)
    if (valueAt(middle) < value) start = middle + 1
    else end = middle
  }
  return start
}

function upperBound(length: number, valueAt: (index: number) => number, value: number) {
  let start = 0
  let end = length
  while (start < end) {
    const middle = start + Math.floor((end - start) / 2)
    if (valueAt(middle) <= value) start = middle + 1
    else end = middle
  }
  return start
}

function pointMetrics(
  length: number,
  pointAt: (index: number) => WaveformPoint | undefined,
  includeErrors: boolean,
): WaveformPointMetrics {
  let xMinimum = Number.POSITIVE_INFINITY
  let xMaximum = Number.NEGATIVE_INFINITY
  let yMinimum = Number.POSITIVE_INFINITY
  let yMaximum = Number.NEGATIVE_INFINITY
  let hasErrorPoints = false
  for (let index = 0; index < length; index += 1) {
    const point = pointAt(index)
    if (!point) continue
    xMinimum = Math.min(xMinimum, point.x)
    xMaximum = Math.max(xMaximum, point.x)
    yMinimum = Math.min(yMinimum, point.y)
    yMaximum = Math.max(yMaximum, point.y)
    if (!includeErrors) continue
    const lower = normalizeError(point.lowerError) ?? normalizeError(point.error) ?? 0
    const upper = normalizeError(point.upperError) ?? normalizeError(point.error) ?? 0
    hasErrorPoints ||= lower !== 0 || upper !== 0
    yMinimum = Math.min(yMinimum, point.y - lower)
    yMaximum = Math.max(yMaximum, point.y + upper)
  }
  return { xMinimum, xMaximum, yMinimum, yMaximum, hasErrorPoints }
}

class ObjectWaveformPointSource implements WaveformPointSource {
  readonly isCompact = false

  constructor(private readonly sourcePoints: readonly WaveformPoint[]) {}

  get length() {
    return this.sourcePoints.length
  }

  pointAt(index: number) {
    return this.sourcePoints[index]
  }

  pointsInRange(start = 0, end = this.length) {
    const range = clampRange(start, end, this.length)
    return this.sourcePoints.slice(range.start, range.end)
  }

  visibleRange(domain: [number, number]) {
    const start = Math.min(domain[0], domain[1])
    const end = Math.max(domain[0], domain[1])
    return {
      start: lowerBound(this.length, (index) => this.sourcePoints[index]!.x, start),
      end: upperBound(this.length, (index) => this.sourcePoints[index]!.x, end),
    }
  }

  nearestPoint(x: number) {
    if (!Number.isFinite(x) || !this.length) return undefined
    const first = this.sourcePoints[0]!
    const last = this.sourcePoints[this.length - 1]!
    if (x <= first.x) return first
    if (x >= last.x) return last
    const right = lowerBound(this.length, (index) => this.sourcePoints[index]!.x, x)
    const candidate = this.sourcePoints[Math.min(right, this.length - 1)]!
    const previous = this.sourcePoints[Math.max(0, right - 1)]!
    return Math.abs(x - previous.x) < Math.abs(candidate.x - x) ? previous : candidate
  }

  metrics(includeErrors = false) {
    return pointMetrics(this.length, (index) => this.sourcePoints[index], includeErrors)
  }

  toWorkerDataset(): WorkerSamplingDataset {
    return { kind: 'points', points: this.sourcePoints }
  }
}

class CompactWaveformPointSource implements WaveformPointSource {
  readonly isCompact = true

  constructor(
    private readonly x: Float64Array,
    private readonly y: WaveformTypedValues,
    private readonly error?: WaveformTypedValues,
    private readonly lowerError?: WaveformTypedValues,
    private readonly upperError?: WaveformTypedValues,
  ) {}

  get length() {
    return this.x.length
  }

  pointAt(index: number) {
    if (index < 0 || index >= this.length) return undefined
    const error = normalizeError(this.error?.[index])
    const lowerError = normalizeError(this.lowerError?.[index])
    const upperError = normalizeError(this.upperError?.[index])
    return {
      x: this.x[index]!,
      y: this.y[index]!,
      ...(error === undefined ? {} : { error }),
      ...(lowerError === undefined ? {} : { lowerError }),
      ...(upperError === undefined ? {} : { upperError }),
    }
  }

  pointsInRange(start = 0, end = this.length) {
    const range = clampRange(start, end, this.length)
    const points: WaveformPoint[] = []
    for (let index = range.start; index < range.end; index += 1) points.push(this.pointAt(index)!)
    return points
  }

  visibleRange(domain: [number, number]) {
    const start = Math.min(domain[0], domain[1])
    const end = Math.max(domain[0], domain[1])
    return {
      start: lowerBound(this.length, (index) => this.x[index]!, start),
      end: upperBound(this.length, (index) => this.x[index]!, end),
    }
  }

  nearestPoint(x: number) {
    if (!Number.isFinite(x) || !this.length) return undefined
    if (x <= this.x[0]!) return this.pointAt(0)
    if (x >= this.x[this.length - 1]!) return this.pointAt(this.length - 1)
    const right = lowerBound(this.length, (index) => this.x[index]!, x)
    const candidate = Math.min(right, this.length - 1)
    const previous = Math.max(0, right - 1)
    return Math.abs(x - this.x[previous]!) < Math.abs(this.x[candidate]! - x)
      ? this.pointAt(previous)
      : this.pointAt(candidate)
  }

  metrics(includeErrors = false) {
    let xMinimum = Number.POSITIVE_INFINITY
    let xMaximum = Number.NEGATIVE_INFINITY
    let yMinimum = Number.POSITIVE_INFINITY
    let yMaximum = Number.NEGATIVE_INFINITY
    let hasErrorPoints = false
    for (let index = 0; index < this.length; index += 1) {
      const x = this.x[index]!
      const y = this.y[index]!
      xMinimum = Math.min(xMinimum, x)
      xMaximum = Math.max(xMaximum, x)
      yMinimum = Math.min(yMinimum, y)
      yMaximum = Math.max(yMaximum, y)
      if (!includeErrors) continue
      const lower =
        normalizeError(this.lowerError?.[index]) ?? normalizeError(this.error?.[index]) ?? 0
      const upper =
        normalizeError(this.upperError?.[index]) ?? normalizeError(this.error?.[index]) ?? 0
      hasErrorPoints ||= lower !== 0 || upper !== 0
      yMinimum = Math.min(yMinimum, y - lower)
      yMaximum = Math.max(yMaximum, y + upper)
    }
    return { xMinimum, xMaximum, yMinimum, yMaximum, hasErrorPoints }
  }

  toWorkerDataset(): WorkerSamplingDataset {
    // Send private copies, never the consumer's ArrayBuffers. The Worker receives typed messages.
    return { kind: 'typed', x: this.x.slice(), y: this.y.slice() }
  }
}

function isTypedValues(value: unknown): value is WaveformTypedValues {
  return value instanceof Float32Array || value instanceof Float64Array
}

function typedPointsAreValid(data: Extract<SingleWaveformData, { kind: 'typed-points' }>) {
  const values = [data.y, data.error, data.lowerError, data.upperError]
  return (
    data.x instanceof Float64Array &&
    values.every(
      (value) => value === undefined || (isTypedValues(value) && value.length === data.x.length),
    )
  )
}

function compactSamples(data: Extract<SingleWaveformData, { kind: 'typed-samples' }>) {
  if (
    !isTypedValues(data.values) ||
    !Number.isFinite(data.sampleRate) ||
    data.sampleRate <= 0 ||
    (data.startTime !== undefined && !Number.isFinite(data.startTime))
  ) {
    return createCompactSamplePointSource(new Float64Array(), 1, 0)
  }
  const startTime = data.startTime ?? 0
  let count = 0
  for (let index = 0; index < data.values.length; index += 1)
    count += Number.isFinite(data.values[index]) ? 1 : 0
  const y = data.values instanceof Float32Array ? new Float32Array(count) : new Float64Array(count)
  const sourceIndexes = count === data.values.length ? undefined : new Uint32Array(count)
  for (let sourceIndex = 0, targetIndex = 0; sourceIndex < data.values.length; sourceIndex += 1) {
    const value = data.values[sourceIndex]
    if (!Number.isFinite(value)) continue
    y[targetIndex] = value
    if (sourceIndexes) sourceIndexes[targetIndex] = sourceIndex
    targetIndex += 1
  }
  return createCompactSamplePointSource(y, data.sampleRate, startTime, sourceIndexes)
}

function compactPoints(data: Extract<SingleWaveformData, { kind: 'typed-points' }>) {
  if (!typedPointsAreValid(data))
    return new CompactWaveformPointSource(new Float64Array(), new Float64Array())
  const indexes: number[] = []
  let ordered = true
  let previousX = Number.NEGATIVE_INFINITY
  for (let index = 0; index < data.x.length; index += 1) {
    const x = data.x[index]
    const y = data.y[index]
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    if (x < previousX) ordered = false
    previousX = x
    indexes.push(index)
  }
  if (!ordered) indexes.sort((left, right) => data.x[left]! - data.x[right]!)
  const x = new Float64Array(indexes.length)
  const y =
    data.y instanceof Float32Array
      ? new Float32Array(indexes.length)
      : new Float64Array(indexes.length)
  const copyField = (field: WaveformTypedValues | undefined) =>
    field
      ? field instanceof Float32Array
        ? new Float32Array(indexes.length)
        : new Float64Array(indexes.length)
      : undefined
  const error = copyField(data.error)
  const lowerError = copyField(data.lowerError)
  const upperError = copyField(data.upperError)
  indexes.forEach((sourceIndex, targetIndex) => {
    x[targetIndex] = data.x[sourceIndex]!
    y[targetIndex] = data.y[sourceIndex]!
    if (error) error[targetIndex] = data.error![sourceIndex]!
    if (lowerError) lowerError[targetIndex] = data.lowerError![sourceIndex]!
    if (upperError) upperError[targetIndex] = data.upperError![sourceIndex]!
  })
  return new CompactWaveformPointSource(x, y, error, lowerError, upperError)
}

export function createWaveformPointSource(
  data: SingleWaveformData,
  normalizeObjectData: (value: SingleWaveformData) => WaveformPoint[],
): WaveformPointSource {
  if (data.kind === 'typed-samples') return compactSamples(data)
  if (data.kind === 'typed-points') return compactPoints(data)
  return new ObjectWaveformPointSource(normalizeObjectData(data))
}

export function pointSourceFromPoints(points: readonly WaveformPoint[]): WaveformPointSource {
  return new ObjectWaveformPointSource(points)
}

/**
 * Keeps existing array-oriented component code compatible while constructing compact points only
 * when an index is actually read. Native array methods use `has` before indexed reads, so both
 * iteration and `slice` retain their normal semantics without eagerly allocating point objects.
 */
export function lazyPointArray(source: WaveformPointSource): WaveformPoint[] {
  if (!source.isCompact) return source.pointsInRange()
  const cache = new Map<number, WaveformPoint>()
  const maximumCachedPoints = 128
  const valueAt = (index: number) => {
    const cached = cache.get(index)
    if (cached) return cached
    const point = source.pointAt(index)
    if (point) {
      cache.set(index, point)
      if (cache.size > maximumCachedPoints) cache.delete(cache.keys().next().value!)
    }
    return point
  }
  return new Proxy(Array.from<WaveformPoint>({ length: source.length }), {
    get(target, property, receiver) {
      if (typeof property === 'string' && /^(0|[1-9]\d*)$/.test(property)) {
        return valueAt(Number(property))
      }
      return Reflect.get(target, property, receiver)
    },
    has(target, property) {
      if (typeof property === 'string' && /^(0|[1-9]\d*)$/.test(property)) {
        const index = Number(property)
        return index >= 0 && index < source.length
      }
      return Reflect.has(target, property)
    },
    ownKeys(target) {
      return [
        ...Array.from({ length: source.length }, (_, index) => String(index)),
        ...Reflect.ownKeys(target).filter((key) => key === 'length' || typeof key === 'symbol'),
      ]
    },
    getOwnPropertyDescriptor(target, property) {
      if (typeof property === 'string' && /^(0|[1-9]\d*)$/.test(property)) {
        const index = Number(property)
        if (index >= 0 && index < source.length) {
          return { configurable: true, enumerable: true, writable: true, value: valueAt(index) }
        }
      }
      return Reflect.getOwnPropertyDescriptor(target, property)
    },
  })
}

export function isWaveformPointSource(value: unknown): value is WaveformPointSource {
  return (
    typeof value === 'object' && value !== null && 'pointAt' in value && 'visibleRange' in value
  )
}
