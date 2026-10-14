import type { TrackLayout, TrackSeriesPath } from '../core/types'
import type { WaveformAnnotation } from '@/types'
import type { NumericGeometry } from '@/animation/types'
import {
  captureGeometry,
  compatibleGeometry,
  projectGeometry,
  interpolateGeometry,
} from './geometry'
import { interpolateValue } from '@/animation/core/values'
import { clampProgress, validDomain } from '@/animation/presets/shared'
import type { ScaleLinear } from 'd3'

function presentationScale(scale: ScaleLinear<number, number>, domain: [number, number]) {
  const current = scale.domain()
  return current[0] === domain[0] && current[1] === domain[1] ? scale : scale.copy().domain(domain)
}

interface AnchorValue {
  seriesId: string
  annotationY: number
  x: number
  y: number
}
interface SeriesGeometry {
  path: TrackSeriesPath
  values: NumericGeometry
  old?: { path: TrackSeriesPath; values: NumericGeometry }
  opacity: number
}
export interface TrackPresentation {
  target: TrackLayout
  series: Map<string, SeriesGeometry>
  xDomain: [number, number]
  yDomains: [number, number][]
  anchors: Map<string, AnchorValue>
  clips: Map<string, { id: string; x: number; width: number }>
}
export function staticTrack(
  track: TrackLayout,
  annotations: WaveformAnnotation[],
  previous?: TrackPresentation,
  refreshAnchors = false,
): TrackPresentation {
  const anchors = new Map<string, AnchorValue>()
  for (const annotation of annotations) {
    const series = track.seriesList.find((series) => series.id === annotation.seriesId)
    if (!series || (series.source?.length ?? series.points.length) === 0) continue
    const cached = previous?.anchors.get(annotation.id)
    const point = refreshAnchors ? series.source?.nearestPoint(annotation.x) : undefined
    if (refreshAnchors && !point) continue
    anchors.set(annotation.id, {
      seriesId: series.id,
      annotationY: annotation.y,
      x: annotation.x,
      y:
        point?.y ??
        (cached?.x === annotation.x && cached.annotationY === annotation.y
          ? cached.y
          : annotation.y),
    })
  }
  return {
    target: track,
    series: new Map(
      track.seriesPaths.map((path) => [
        path.series.id,
        { path, values: captureGeometry(path, track.xScale), opacity: 1 },
      ]),
    ),
    xDomain: track.xScale.domain() as [number, number],
    yDomains: track.yAxes.map((axis) => axis.scale.domain() as [number, number]),
    anchors,
    clips: new Map(),
  }
}
function domain(from: [number, number], to: [number, number], p: number): [number, number] {
  if (!validDomain(to)) return from
  const value = interpolateValue(from, to, clampProgress(p)) as [number, number]
  return validDomain(value) ? value : to
}
export function hasThirdGeometry(from: TrackPresentation): boolean {
  return [...from.series.values()].some((series) => !!series.old)
}
export function transitionTrack(
  from: TrackPresentation,
  to: TrackPresentation,
  p: number,
  terminal: boolean,
): TrackPresentation {
  if (terminal) return to
  const series = new Map<string, SeriesGeometry>()
  for (const [id, next] of to.series) {
    const previous = from.series.get(id)
    if (!previous || (next.path.series.source?.length ?? next.path.series.points.length) === 0) {
      series.set(id, next)
      continue
    }
    const compatible = compatibleGeometry(previous.path, next.path, previous.values, next.values)
    series.set(
      id,
      compatible
        ? {
            ...next,
            values: interpolateGeometry(previous.values, next.values, p),
          }
        : {
            ...next,
            old: { path: previous.path, values: previous.values },
            opacity: clampProgress(p),
          },
    )
  }
  const anchors = new Map<string, AnchorValue>()
  for (const [id, next] of to.anchors) {
    const previous = from.anchors.get(id)
    anchors.set(
      id,
      previous && !series.get(next.seriesId)?.old
        ? {
            seriesId: next.seriesId,
            annotationY: next.annotationY,
            x: (1 - p) * previous.x + p * next.x,
            y: (1 - p) * previous.y + p * next.y,
          }
        : next,
    )
  }
  return {
    ...to,
    series,
    anchors,
    xDomain: domain(from.xDomain, to.xDomain, p),
    yDomains: to.yDomains.map((target, i) => domain(from.yDomains[i] ?? target, target, p)),
    clips: to.clips,
  }
}
export function projectTrack(state: TrackPresentation): TrackLayout {
  const target = state.target
  const xScale = presentationScale(target.xScale, state.xDomain)
  const projectedAxes = target.yAxes.map((axis, index) => {
    const scale = presentationScale(axis.scale, state.yDomains[index])
    return scale === axis.scale ? axis : { ...axis, scale }
  })
  const yAxes = projectedAxes.every((axis, index) => axis === target.yAxes[index])
    ? target.yAxes
    : projectedAxes
  const seriesPaths: TrackSeriesPath[] = []
  for (const [id, series] of state.series) {
    const y = yAxes[series.path.yAxisIndex]?.scale ?? target.yScale
    if (series.old)
      seriesPaths.push({
        ...projectGeometry(series.old.path, series.old.values, xScale, y),
        presentationKey: `${id}:old`,
        opacity: 1 - series.opacity,
      })
    seriesPaths.push({
      ...projectGeometry(series.path, series.values, xScale, y),
      presentationKey: id,
      opacity: series.opacity,
      animationClip: state.clips.get(id),
    })
  }
  return {
    ...target,
    xScale,
    yScale: yAxes[0]?.scale ?? target.yScale,
    yAxes,
    seriesPaths,
    path: seriesPaths[0]?.path ?? null,
  }
}
