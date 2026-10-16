import type { InjectionKey } from 'vue'
import { normalizeWaveformSeries } from 'waveform-analysis'
import { normalizeDemoSeries } from './normalizeDemoSeries'
import type { WaveformData } from 'waveform-analysis'

export interface RemoteWindowRequest {
  start: number
  end: number
  seriesIds?: string[]
}

export type RemoteWindowLoader = (
  request: RemoteWindowRequest,
  signal: AbortSignal,
) => Promise<WaveformData>

export const remoteWindowLoaderKey: InjectionKey<RemoteWindowLoader> = Symbol('remoteWindowLoader')

export interface MockWindowOptions {
  delayMs?: number | ((request: RemoteWindowRequest) => number)
  empty?: boolean | ((request: RemoteWindowRequest) => boolean)
  fail?: boolean | ((request: RemoteWindowRequest) => boolean)
}

/** Preserve series identities even when a window has no samples. */
export function selectWaveformWindow(
  data: WaveformData,
  request: RemoteWindowRequest,
  empty = false,
): WaveformData {
  const series = normalizeDemoSeries(data)
  const selected = request.seriesIds ? new Set(request.seriesIds) : undefined
  const windows = series
    .filter((item) => !selected || selected.has(item.id))
    .map(({ points, ...item }) => {
      const start = Math.min(request.start, request.end)
      const end = Math.max(request.start, request.end)
      return {
        ...item,
        data: {
          kind: 'points' as const,
          points: empty ? [] : points.filter((point) => point.x >= start && point.x <= end),
        },
      }
    })
  return data.kind === 'series'
    ? { kind: 'series', series: windows }
    : (windows[0]?.data ?? { kind: 'points', points: [] })
}

export function mergeWaveformWindow(
  current: WaveformData,
  response: WaveformData,
  seriesIds?: string[],
): WaveformData {
  if (current.kind !== 'series' || response.kind !== 'series') return response
  const selected = seriesIds ? new Set(seriesIds) : undefined
  const byId = new Map(response.series.map((series) => [series.id, series]))
  const knownIds = new Set(current.series.map((series) => series.id))
  return {
    kind: 'series',
    series: [
      ...current.series.map((series) => {
        if (selected && (!series.id || !selected.has(series.id))) return series
        return byId.get(series.id) ?? { ...series, data: { kind: 'points' as const, points: [] } }
      }),
      ...response.series.filter((series) => !knownIds.has(series.id)),
    ],
  }
}

/** Metadata is derived from the complete record, never from a loaded window. */
export function waveformRecordMetadata(data: WaveformData) {
  let minimum = Infinity
  let maximum = -Infinity
  let minZoomSpan = Infinity
  for (const series of normalizeWaveformSeries(data)) {
    for (let index = 0; index < series.points.length; index++) {
      const x = series.points[index].x
      minimum = Math.min(minimum, x)
      maximum = Math.max(maximum, x)
      const previous = series.points[index - 1]?.x
      if (previous !== undefined && x > previous) {
        minZoomSpan = Math.min(minZoomSpan, x - previous)
      }
    }
  }
  return {
    domain: (minimum < maximum ? [minimum, maximum] : [0, 1]) as [number, number],
    minZoomSpan: Number.isFinite(minZoomSpan) ? minZoomSpan : undefined,
  }
}

export function createMockWindowLoader(
  source: () => WaveformData,
  options: MockWindowOptions = {},
): RemoteWindowLoader {
  return (request, signal) =>
    new Promise((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer)
        signal.removeEventListener('abort', abort)
        reject(new DOMException('Request cancelled', 'AbortError'))
      }
      const delay =
        typeof options.delayMs === 'function' ? options.delayMs(request) : options.delayMs
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', abort)
        const fail = typeof options.fail === 'function' ? options.fail(request) : options.fail
        if (fail) {
          reject(new Error('模拟数据加载失败'))
          return
        }
        const empty = typeof options.empty === 'function' ? options.empty(request) : options.empty
        resolve(selectWaveformWindow(source(), request, empty))
      }, delay ?? 80)
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) abort()
    })
}
