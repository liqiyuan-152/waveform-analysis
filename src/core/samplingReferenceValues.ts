import type { ReferenceSamplingStrategy } from './samplingReference'
import type { WorkerSamplingOutput } from './workerSampling/protocol'

interface Bounds {
  start: number
  end: number
}

function targetCount(value: number, pointCount: number) {
  if (pointCount === 0) return 0
  if (!Number.isFinite(value)) return pointCount
  return Math.min(pointCount, Math.max(1, Math.floor(value)))
}

function bucketBounds(bucket: number, bucketCount: number, start: number, end: number): Bounds {
  const span = end - start
  return {
    start: start + Math.floor((bucket * span) / bucketCount),
    end: start + Math.floor(((bucket + 1) * span) / bucketCount),
  }
}

function addUnique(indexes: number[], index: number) {
  if (indexes[indexes.length - 1] !== index) indexes.push(index)
}

function withEndpoints(length: number, target: number, selectInterior: () => number[]) {
  if (length <= target) return Array.from({ length }, (_, index) => index)
  if (target === 1) return [0]
  if (target === 2) return [0, length - 1]
  const indexes = [0]
  selectInterior().forEach((index) => addUnique(indexes, index))
  addUnique(indexes, length - 1)
  return indexes
}

function extremaIndexes(y: Float64Array, target: number, strategy: 'min' | 'max' | 'minmax') {
  const bucketCount = strategy === 'minmax' ? Math.floor((target - 2) / 2) : Math.max(0, target - 2)
  return withEndpoints(y.length, target, () => {
    if (!bucketCount) return []
    const result: number[] = []
    for (let bucket = 0; bucket < bucketCount; bucket += 1) {
      const bounds = bucketBounds(bucket, bucketCount, 1, y.length - 1)
      let minimum = bounds.start
      let maximum = bounds.start
      for (let index = bounds.start + 1; index < bounds.end; index += 1) {
        if (y[index]! < y[minimum]!) minimum = index
        if (y[index]! > y[maximum]!) maximum = index
      }
      if (strategy === 'min') addUnique(result, minimum)
      else if (strategy === 'max') addUnique(result, maximum)
      else if (minimum <= maximum) {
        addUnique(result, minimum)
        addUnique(result, maximum)
      } else {
        addUnique(result, maximum)
        addUnique(result, minimum)
      }
    }
    return result
  })
}

function peakIndexes(y: Float64Array, target: number) {
  const bucketCount = Math.floor((target - 2) / 4)
  return withEndpoints(y.length, target, () => {
    if (!bucketCount) return []
    const result: number[] = []
    for (let bucket = 0; bucket < bucketCount; bucket += 1) {
      const bounds = bucketBounds(bucket, bucketCount, 1, y.length - 1)
      let minimum = bounds.start
      let maximum = bounds.start
      for (let index = bounds.start + 1; index < bounds.end; index += 1) {
        if (y[index]! < y[minimum]!) minimum = index
        if (y[index]! > y[maximum]!) maximum = index
      }
      ;[bounds.start, minimum, maximum, bounds.end - 1]
        .sort((left, right) => left - right)
        .forEach((index) => addUnique(result, index))
    }
    return result
  })
}

function lttbIndexes(x: Float64Array, y: Float64Array, target: number) {
  return withEndpoints(x.length, target, () => {
    const bucketSize = (x.length - 2) / (target - 2)
    const result: number[] = []
    let previous = 0
    for (let bucket = 0; bucket < target - 2; bucket += 1) {
      const averageStart = Math.min(x.length, Math.floor((bucket + 1) * bucketSize) + 1)
      const averageEnd = Math.min(x.length, Math.floor((bucket + 2) * bucketSize) + 1)
      let averageX = 0
      let averageY = 0
      for (let index = averageStart; index < averageEnd; index += 1) {
        averageX += x[index]!
        averageY += y[index]!
      }
      const averageCount = averageEnd - averageStart
      if (averageCount) {
        averageX /= averageCount
        averageY /= averageCount
      } else {
        averageX = x[x.length - 1]!
        averageY = y[y.length - 1]!
      }
      const bounds = bucketBounds(bucket, target - 2, 1, x.length - 1)
      let selected = bounds.start
      let maximumArea = -1
      for (let index = bounds.start; index < bounds.end; index += 1) {
        const area = Math.abs(
          (x[previous]! - averageX) * (y[index]! - y[previous]!) -
            (x[previous]! - x[index]!) * (averageY - y[previous]!),
        )
        if (area > maximumArea) {
          maximumArea = area
          selected = index
        }
      }
      result.push(selected)
      previous = selected
    }
    return result
  })
}

function aggregates(
  x: Float64Array,
  y: Float64Array,
  target: number,
  strategy: 'average' | 'sum',
): WorkerSamplingOutput {
  const count = targetCount(target, x.length)
  const outputX = new Float64Array(count)
  const outputY = new Float64Array(count)
  for (let bucket = 0; bucket < count; bucket += 1) {
    const bounds = bucketBounds(bucket, count, 0, x.length)
    for (let index = bounds.start; index < bounds.end; index += 1) {
      outputX[bucket] += x[index]!
      outputY[bucket] += y[index]!
    }
    const size = bounds.end - bounds.start
    outputX[bucket] /= size
    if (strategy === 'average') outputY[bucket] /= size
  }
  return { kind: 'aggregates', x: outputX, y: outputY }
}

/** Numeric JavaScript fallback matching the WASM source-index and aggregate contracts. */
export function sampleWaveformReferenceValues(
  x: Float64Array,
  y: Float64Array,
  strategy: ReferenceSamplingStrategy,
  targetPointCount: number,
): WorkerSamplingOutput {
  if (x.length !== y.length) throw new Error('x and y must have the same length')
  if (strategy === 'average' || strategy === 'sum')
    return aggregates(x, y, targetPointCount, strategy)
  const target = targetCount(targetPointCount, x.length)
  const indexes =
    strategy === 'none' || x.length <= target
      ? Array.from({ length: x.length }, (_, index) => index)
      : strategy === 'peak'
        ? peakIndexes(y, target)
        : strategy === 'lttb'
          ? lttbIndexes(x, y, target)
          : extremaIndexes(y, target, strategy)
  return { kind: 'source-indexes', sourceIndexes: Uint32Array.from(indexes) }
}
