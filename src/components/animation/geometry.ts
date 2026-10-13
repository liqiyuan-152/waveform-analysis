import type { ScaleLinear } from 'd3'
import type { WaveformPoint, WaveformLineType } from '@/types'
import type { TrackSeriesPath } from '../core/types'
import type { NumericGeometry } from '@/animation/types'
import { resolveWaveformPointErrors } from '@/core'
import { createPathBuffer } from './pathBuffer'

// Weak ownership releases cached SVG strings and point arrays with their numeric snapshots.
const projections = new WeakMap<
  NumericGeometry,
  {
    path: TrackSeriesPath
    x: ScaleLinear<number, number>
    y: ScaleLinear<number, number>
    result: TrackSeriesPath
  }
>()
const dirty = new WeakSet<NumericGeometry>()
const transitions = new WeakMap<NumericGeometry, WeakMap<NumericGeometry, NumericGeometry>>()
const snapshots = new WeakMap<TrackSeriesPath, NumericGeometry>()
const pathBuffers = new WeakMap<WaveformPoint[], ReturnType<typeof createPathBuffer>>()

/** Private presentation buffer; the source/target snapshots and business points stay immutable. */
export function interpolateGeometry(from: NumericGeometry, to: NumericGeometry, p: number) {
  let targets = transitions.get(from)
  if (!targets) transitions.set(from, (targets = new WeakMap()))
  let result = targets.get(to)
  if (!result) {
    result = Object.fromEntries(
      Object.entries(to).map(([key, rows]) => [
        key,
        (rows as number[][]).map((row) => new Array<number>(row.length)),
      ]),
    )
    targets.set(to, result)
  }
  for (const key of Object.keys(to)) {
    const a = from[key] as number[][],
      b = to[key] as number[][],
      output = result[key] as number[][]
    for (let i = 0; i < b.length; i++)
      for (let j = 0; j < b[i].length; j++) {
        const value = p === 0 ? a[i][j] : p === 1 ? b[i][j] : (1 - p) * a[i][j] + p * b[i][j]
        if (!Number.isFinite(value)) throw new RangeError('Nonfinite presentation geometry')
        output[i][j] = value
      }
  }
  dirty.add(result)
  return result
}

export function generateWaveformPath(
  points: WaveformPoint[],
  type: WaveformLineType,
  x: ScaleLinear<number, number>,
  y: ScaleLinear<number, number>,
): string | null {
  if (!points.length || type === 'none') return null
  let buffer = pathBuffers.get(points)
  if (!buffer) pathBuffers.set(points, (buffer = createPathBuffer(x, y)))
  return buffer(points, type, x, y)
}
function values(points: WaveformPoint[]): number[][] {
  return points.map((point) => {
    const error = resolveWaveformPointErrors(point)
    return [point.x, point.y, error.lower, error.upper]
  })
}
export function captureGeometry(
  path: TrackSeriesPath,
  x: ScaleLinear<number, number>,
): NumericGeometry {
  let geometry = snapshots.get(path)
  if (!geometry) {
    let line: number[][] | undefined, points: number[][] | undefined, errors: number[][] | undefined
    // Layout paths are immutable. Static/enter rendering uses their existing SVG and does not
    // need numeric copies; materialize a private endpoint only when an update reads it.
    geometry = {
      get line() {
        return (line ??= values(path.lineRenderPoints ?? []))
      },
      get points() {
        return (points ??= values(path.pointRenderPoints))
      },
      get errors() {
        return (errors ??= values(path.errorBarRenderPoints))
      },
    }
    snapshots.set(path, geometry)
  }
  projections.set(geometry, { path, x, y: path.yScale, result: path })
  return geometry
}
function points(values: number[][], buffer: WaveformPoint[] = []): WaveformPoint[] {
  for (let i = 0; i < values.length; i++) {
    // Initialize all numeric fields together; overwrite before publishing the private buffer.
    const point = buffer[i] ?? (buffer[i] = { x: NaN, y: NaN, lowerError: NaN, upperError: NaN })
    const row = values[i]
    point.x = row[0]
    point.y = row[1]
    point.lowerError = row[2]
    point.upperError = row[3]
  }
  buffer.length = values.length
  return buffer
}
export function projectGeometry(
  path: TrackSeriesPath,
  geometry: NumericGeometry,
  x: ScaleLinear<number, number>,
  y: ScaleLinear<number, number>,
): TrackSeriesPath {
  const cached = projections.get(geometry)
  if (!dirty.has(geometry) && cached?.path === path && cached.x === x && cached.y === y)
    return cached.result
  const buffer = cached?.path === path && cached.result !== path ? cached.result : undefined
  const linePoints = points(geometry.line as number[][], buffer?.lineRenderPoints)
  const result = {
    ...path,
    lineRenderPoints: linePoints,
    path: generateWaveformPath(linePoints, path.series.lineType, x, y),
    pointRenderPoints: points(geometry.points as number[][], buffer?.pointRenderPoints),
    errorBarRenderPoints: points(geometry.errors as number[][], buffer?.errorBarRenderPoints),
    yScale: y,
  }
  projections.set(geometry, { path, x, y, result })
  dirty.delete(geometry)
  return result
}
export function compatibleGeometry(
  a: TrackSeriesPath,
  b: TrackSeriesPath,
  from: NumericGeometry,
  to: NumericGeometry,
): boolean {
  if (
    a.series.lineType !== b.series.lineType ||
    a.series.pointType !== b.series.pointType ||
    a.series.errorBar.visible !== b.series.errorBar.visible
  )
    return false
  return ['line', 'points', 'errors'].every((key) => {
    const old = from[key] as number[][],
      next = to[key] as number[][]
    return old.length === next.length && old.every((point, i) => point[0] === next[i][0])
  })
}
