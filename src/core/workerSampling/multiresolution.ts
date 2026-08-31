import type { WaveformPoint } from '@/types'

import type { WorkerSamplingOutput } from './protocol'

export type IndexedSamplingStrategy =
  'none' | 'peak' | 'lttb' | 'average' | 'min' | 'max' | 'minmax' | 'sum'

interface ExtremaLayer {
  minimumIndexes: Uint32Array
  maximumIndexes: Uint32Array
}

interface SumLayer {
  x: Float64Array
  y: Float64Array
  count: Uint32Array
}

export interface MultiResolutionSamplingIndexOptions {
  /** Bounds one accessed dataset's lazily-built indexes; source points are not included. */
  maxBytes?: number
}

const DEFAULT_MAX_BYTES = 8 * 1024 * 1024

function targetCount(value: number, pointCount: number) {
  if (pointCount === 0) return 0
  if (!Number.isFinite(value)) return pointCount
  return Math.min(pointCount, Math.max(1, Math.floor(value)))
}

function bucketBounds(bucket: number, bucketCount: number, start: number, end: number) {
  const span = end - start
  return {
    start: start + Math.floor((bucket * span) / bucketCount),
    end: start + Math.floor(((bucket + 1) * span) / bucketCount),
  }
}

function addUnique(indexes: number[], index: number) {
  if (indexes[indexes.length - 1] !== index) indexes.push(index)
}

function byteLength(layer: ExtremaLayer | SumLayer) {
  return 'minimumIndexes' in layer
    ? layer.minimumIndexes.byteLength + layer.maximumIndexes.byteLength
    : layer.x.byteLength + layer.y.byteLength + layer.count.byteLength
}

function largestAlignedBlock(start: number, remaining: number) {
  let size = 1
  while (size * 2 <= remaining && start % (size * 2) === 0) size *= 2
  return size
}

export class MultiResolutionSamplingIndex {
  private readonly extremaLayers: Array<ExtremaLayer | undefined> = []
  private readonly sumLayers: Array<SumLayer | undefined> = []
  private indexBytes = 0
  private readonly maxBytes: number

  constructor(
    private readonly points: readonly WaveformPoint[],
    options: MultiResolutionSamplingIndexOptions = {},
  ) {
    this.maxBytes = Number.isFinite(options.maxBytes)
      ? Math.max(0, Math.floor(options.maxBytes ?? 0))
      : DEFAULT_MAX_BYTES
  }

  get byteLength() {
    return this.indexBytes
  }

  dispose() {
    this.extremaLayers.length = 0
    this.sumLayers.length = 0
    this.indexBytes = 0
  }

  sample(
    start: number,
    end: number,
    strategy: IndexedSamplingStrategy,
    requestedTarget: number,
  ): WorkerSamplingOutput | undefined {
    const rangeStart = Math.max(0, Math.min(this.points.length, Math.floor(start)))
    const rangeEnd = Math.max(rangeStart, Math.min(this.points.length, Math.floor(end)))
    const count = rangeEnd - rangeStart
    const target = targetCount(requestedTarget, count)
    if (strategy === 'lttb') return undefined
    if (strategy === 'average' || strategy === 'sum') {
      return this.aggregate(rangeStart, rangeEnd, target, strategy)
    }
    if (strategy === 'none' || count <= target) return this.allIndexes(rangeStart, rangeEnd)
    if (target === 1) return this.indexes([rangeStart])
    if (target === 2) return this.indexes([rangeStart, rangeEnd - 1])
    return this.extrema(rangeStart, rangeEnd, target, strategy)
  }

  private allIndexes(start: number, end: number): WorkerSamplingOutput {
    return {
      kind: 'source-indexes',
      sourceIndexes: Uint32Array.from({ length: end - start }, (_, index) => start + index),
    }
  }

  private indexes(indexes: number[]): WorkerSamplingOutput {
    return { kind: 'source-indexes', sourceIndexes: Uint32Array.from(indexes) }
  }

  private extrema(
    start: number,
    end: number,
    target: number,
    strategy: Exclude<IndexedSamplingStrategy, 'none' | 'lttb' | 'average' | 'sum'>,
  ): WorkerSamplingOutput | undefined {
    const bucketCount =
      strategy === 'peak'
        ? Math.floor((target - 2) / 4)
        : strategy === 'minmax'
          ? Math.floor((target - 2) / 2)
          : Math.max(0, target - 2)
    if (bucketCount === 0) return this.indexes([start, end - 1])
    const indexes = [start]
    for (let bucket = 0; bucket < bucketCount; bucket += 1) {
      const bounds = bucketBounds(bucket, bucketCount, start + 1, end - 1)
      const range = this.queryExtrema(bounds.start, bounds.end)
      if (!range) return undefined
      if (strategy === 'min') addUnique(indexes, range.minimum)
      else if (strategy === 'max') addUnique(indexes, range.maximum)
      else if (strategy === 'minmax') {
        if (range.minimum <= range.maximum) {
          addUnique(indexes, range.minimum)
          addUnique(indexes, range.maximum)
        } else {
          addUnique(indexes, range.maximum)
          addUnique(indexes, range.minimum)
        }
      } else {
        for (const index of [bounds.start, range.minimum, range.maximum, bounds.end - 1].sort(
          (left, right) => left - right,
        )) {
          addUnique(indexes, index)
        }
      }
    }
    addUnique(indexes, end - 1)
    return this.indexes(indexes)
  }

  private aggregate(
    start: number,
    end: number,
    target: number,
    strategy: 'average' | 'sum',
  ): WorkerSamplingOutput | undefined {
    const x = new Float64Array(target)
    const y = new Float64Array(target)
    for (let bucket = 0; bucket < target; bucket += 1) {
      const bounds = bucketBounds(bucket, target, start, end)
      const aggregate = this.querySum(bounds.start, bounds.end)
      if (!aggregate || aggregate.count === 0) return undefined
      x[bucket] = aggregate.x / aggregate.count
      y[bucket] = strategy === 'average' ? aggregate.y / aggregate.count : aggregate.y
    }
    return { kind: 'aggregates', x, y }
  }

  private queryExtrema(start: number, end: number) {
    const level = Math.floor(Math.log2(Math.max(1, end - start)))
    if (!this.ensureExtrema(level)) return undefined
    let minimum = start
    let maximum = start
    for (let position = start; position < end;) {
      const size = largestAlignedBlock(position, end - position)
      const blockLevel = Math.floor(Math.log2(size))
      const block = position / size
      const layer = this.extremaLayers[blockLevel]
      const nextMinimum = layer ? layer.minimumIndexes[block]! : position
      const nextMaximum = layer ? layer.maximumIndexes[block]! : position
      if (this.isMinimum(nextMinimum, minimum)) minimum = nextMinimum
      if (this.isMaximum(nextMaximum, maximum)) maximum = nextMaximum
      position += size
    }
    return { minimum, maximum }
  }

  private querySum(start: number, end: number) {
    const level = Math.floor(Math.log2(Math.max(1, end - start)))
    if (!this.ensureSum(level)) return undefined
    let x = 0
    let y = 0
    let count = 0
    for (let position = start; position < end;) {
      const size = largestAlignedBlock(position, end - position)
      const blockLevel = Math.floor(Math.log2(size))
      const block = position / size
      const layer = this.sumLayers[blockLevel]
      if (layer) {
        x += layer.x[block]!
        y += layer.y[block]!
        count += layer.count[block]!
      } else {
        const point = this.points[position]!
        x += point.x
        y += point.y
        count += 1
      }
      position += size
    }
    return { x, y, count }
  }

  private ensureExtrema(level: number) {
    for (let current = 1; current <= level; current += 1) {
      if (this.extremaLayers[current]) continue
      const length = Math.ceil(this.points.length / 2 ** current)
      const layer: ExtremaLayer = {
        minimumIndexes: new Uint32Array(length),
        maximumIndexes: new Uint32Array(length),
      }
      if (!this.reserve(byteLength(layer))) return false
      const previous = this.extremaLayers[current - 1]
      for (let block = 0; block < length; block += 1) {
        const left = block * 2
        const right = left + 1
        const leftMinimum = previous ? previous.minimumIndexes[left]! : left
        const leftMaximum = previous ? previous.maximumIndexes[left]! : left
        const hasRight = previous
          ? right < previous.minimumIndexes.length
          : right < this.points.length
        const rightMinimum = previous && hasRight ? previous.minimumIndexes[right]! : right
        const rightMaximum = previous && hasRight ? previous.maximumIndexes[right]! : right
        layer.minimumIndexes[block] =
          hasRight && this.isMinimum(rightMinimum, leftMinimum) ? rightMinimum : leftMinimum
        layer.maximumIndexes[block] =
          hasRight && this.isMaximum(rightMaximum, leftMaximum) ? rightMaximum : leftMaximum
      }
      this.extremaLayers[current] = layer
    }
    return true
  }

  private ensureSum(level: number) {
    for (let current = 1; current <= level; current += 1) {
      if (this.sumLayers[current]) continue
      const length = Math.ceil(this.points.length / 2 ** current)
      const layer: SumLayer = {
        x: new Float64Array(length),
        y: new Float64Array(length),
        count: new Uint32Array(length),
      }
      if (!this.reserve(byteLength(layer))) return false
      const previous = this.sumLayers[current - 1]
      for (let block = 0; block < length; block += 1) {
        const left = block * 2
        const right = left + 1
        if (previous) {
          layer.x[block] = previous.x[left]! + (right < previous.x.length ? previous.x[right]! : 0)
          layer.y[block] = previous.y[left]! + (right < previous.y.length ? previous.y[right]! : 0)
          layer.count[block] =
            previous.count[left]! + (right < previous.count.length ? previous.count[right]! : 0)
        } else {
          const leftPoint = this.points[left]!
          const rightPoint = this.points[right]
          layer.x[block] = leftPoint.x + (rightPoint?.x ?? 0)
          layer.y[block] = leftPoint.y + (rightPoint?.y ?? 0)
          layer.count[block] = rightPoint ? 2 : 1
        }
      }
      this.sumLayers[current] = layer
    }
    return true
  }

  private reserve(bytes: number) {
    if (this.indexBytes + bytes > this.maxBytes) return false
    this.indexBytes += bytes
    return true
  }

  private isMinimum(candidate: number, current: number) {
    const candidatePoint = this.points[candidate]!
    const currentPoint = this.points[current]!
    return (
      candidatePoint.y < currentPoint.y ||
      (candidatePoint.y === currentPoint.y && candidate < current)
    )
  }

  private isMaximum(candidate: number, current: number) {
    const candidatePoint = this.points[candidate]!
    const currentPoint = this.points[current]!
    return (
      candidatePoint.y > currentPoint.y ||
      (candidatePoint.y === currentPoint.y && candidate < current)
    )
  }
}
