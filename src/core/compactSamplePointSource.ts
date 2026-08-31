import type { WaveformPoint, WaveformTypedValues } from '../types'
import type { WaveformPointSource, WorkerSamplingDataset } from './waveformPointSource'

function bound(length: number, xAt: (index: number) => number, value: number, upper: boolean) {
  let start = 0
  let end = length
  while (start < end) {
    const middle = start + Math.floor((end - start) / 2)
    if (upper ? xAt(middle) <= value : xAt(middle) < value) start = middle + 1
    else end = middle
  }
  return start
}

export function createCompactSamplePointSource(
  y: WaveformTypedValues,
  sampleRate: number,
  startTime: number,
  sourceIndexes?: Uint32Array,
): WaveformPointSource {
  const xAt = (index: number) => startTime + (sourceIndexes?.[index] ?? index) / sampleRate
  const pointAt = (index: number) =>
    index < 0 || index >= y.length ? undefined : { x: xAt(index), y: y[index]! }
  return {
    isCompact: true,
    length: y.length,
    pointAt,
    pointsInRange(start = 0, end = y.length) {
      const rangeStart = Math.max(0, Math.min(y.length, Math.floor(start)))
      const rangeEnd = Math.max(rangeStart, Math.min(y.length, Math.ceil(end)))
      return Array.from({ length: rangeEnd - rangeStart }, (_, offset) =>
        pointAt(rangeStart + offset),
      ).filter((point): point is WaveformPoint => point !== undefined)
    },
    visibleRange(domain: [number, number]) {
      const start = Math.min(domain[0], domain[1])
      const end = Math.max(domain[0], domain[1])
      return {
        start: bound(y.length, xAt, start, false),
        end: bound(y.length, xAt, end, true),
      }
    },
    nearestPoint(x: number) {
      if (!Number.isFinite(x) || !y.length) return undefined
      if (x <= xAt(0)) return pointAt(0)
      if (x >= xAt(y.length - 1)) return pointAt(y.length - 1)
      const right = bound(y.length, xAt, x, false)
      const left = Math.max(0, right - 1)
      return Math.abs(x - xAt(left)) < Math.abs(xAt(right) - x) ? pointAt(left) : pointAt(right)
    },
    metrics() {
      let yMinimum = Number.POSITIVE_INFINITY
      let yMaximum = Number.NEGATIVE_INFINITY
      for (const value of y) {
        yMinimum = Math.min(yMinimum, value)
        yMaximum = Math.max(yMaximum, value)
      }
      return {
        xMinimum: y.length ? xAt(0) : Number.POSITIVE_INFINITY,
        xMaximum: y.length ? xAt(y.length - 1) : Number.NEGATIVE_INFINITY,
        yMinimum,
        yMaximum,
        hasErrorPoints: false,
      }
    },
    toWorkerDataset(): WorkerSamplingDataset {
      return {
        kind: 'samples',
        values: y.slice(),
        sampleRate,
        startTime,
        ...(sourceIndexes ? { sourceIndexes: sourceIndexes.slice() } : {}),
      }
    },
  }
}
