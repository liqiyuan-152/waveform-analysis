import { fadeOpacity, interpolateNumber } from '../../../shared/animation/geometry'
import type { RenderContext } from '../../renderer/context.js'
import type { WaveformSeries } from '../../types/data.js'
import { equalValue } from '../../config/equal.js'
import { resolveXTicks, resolveYTicks } from '../../layout/ticks/resolve.js'
import { Animation } from '../Animation.js'
import { clampProgress } from '../easing.js'
import { entryClip } from './clip.js'
import { diffSeries } from './SeriesDiff.js'
import {
  planGeometry,
  interpolateGeometry,
  type GeometryTransition,
} from './GeometryTransitionPlanner.js'

type Track = {
  previous?: WaveformSeries
  target?: WaveformSeries
  geometry?: GeometryTransition
  entry?: Animation
  opacity: number
  clip?: { x: number; width: number }
}
type Domain = [number, number]

function compatibleDomain(from: Domain, to: Domain) {
  const a = from[1] - from[0]
  const b = to[1] - to[0]
  return (
    Number.isFinite(a) && Number.isFinite(b) && a !== 0 && b !== 0 && Math.sign(a) === Math.sign(b)
  )
}

function domainAt(from: Domain, to: Domain, progress: number): Domain {
  return [interpolateNumber(from[0], to[0], progress), interpolateNumber(from[1], to[1], progress)]
}

/** Prepared once at commit; frames consume only snapshots and numeric plans. */
export class WaveformPresentation {
  readonly enter: boolean
  readonly update: boolean
  readonly hasCrossfade: boolean
  private readonly updateTiming: Animation

  private constructor(
    readonly target: RenderContext,
    private readonly previous: RenderContext | undefined,
    private readonly tracks: Track[],
  ) {
    const options = target.options
    this.enter = tracks.some((track) => !!track.entry)
    this.hasCrossfade = tracks.some(
      (track) => !!track.previous && !!track.target && !track.geometry,
    )
    this.update =
      !!previous &&
      options.animationUpdate.enabled &&
      options.animationUpdate.duration > 0 &&
      (tracks.some((track) => !!track.previous) ||
        !equalValue(previous.xDomain, target.xDomain) ||
        target.yAxes.some((axis, index) => !equalValue(axis.domain, previous.yAxes[index].domain)))
    this.updateTiming = new Animation(options.animationUpdate)
  }

  static create(
    previous: RenderContext | undefined,
    target: RenderContext,
  ): WaveformPresentation | undefined {
    const options = target.options
    const count = (ctx: RenderContext | undefined) =>
      ctx
        ? Math.max(
            ctx.legendItems.reduce((sum, item) => sum + item.series.data.length, 0),
            ctx.series.reduce((sum, series) => sum + series.data.length, 0),
          )
        : 0
    if (
      !options.animationEnabled ||
      !target.series.length ||
      count(target) >= options.animationThreshold ||
      count(previous) + 2 * count(target) > 20000
    )
      return undefined
    if (
      previous &&
      (previous.innerWidth !== target.innerWidth ||
        previous.innerHeight !== target.innerHeight ||
        previous.options.padding.left !== options.padding.left ||
        previous.options.padding.top !== options.padding.top ||
        previous.yAxes.length !== target.yAxes.length ||
        !compatibleDomain(previous.xDomain, target.xDomain) ||
        target.yAxes.some(
          (axis, index) =>
            axis.options.id !== previous.yAxes[index].options.id ||
            axis.options.position !== previous.yAxes[index].options.position ||
            axis.offset !== previous.yAxes[index].offset ||
            !compatibleDomain(previous.yAxes[index].domain, axis.domain),
        ))
    )
      return undefined
    const matches = previous
      ? diffSeries(previous.series, target.series)
      : target.series.map((series) => ({ target: series, previous: undefined }))
    if (!matches) return undefined
    let entryIndex = 0
    const tracks: Track[] = []
    for (const match of matches) {
      if (match.previous && match.target && match.previous.yAxis !== match.target.yAxis)
        return undefined
      const effect = previous?.seriesEffects?.[previous.series.indexOf(match.previous!)]
      const track: Track = { ...match, opacity: effect?.opacity ?? 1, clip: effect?.clip }
      if (
        !match.previous &&
        match.target &&
        options.animation.enabled &&
        options.animation.duration > 0
      ) {
        track.entry = new Animation({
          ...options.animation,
          delay: options.animation.delay + entryIndex++ * options.animation.staggerDelay,
        })
      }
      if (match.previous && match.target) {
        const oldType = match.previous.style?.lineType ?? previous!.options.line.type
        const newType = match.target.style?.lineType ?? options.line.type
        if (oldType === newType)
          track.geometry = planGeometry(match.previous.data, match.target.data)
        if (track.geometry) {
          const oldY = previous!.yAxisById.get(match.previous.yAxis ?? '') ?? previous!.primaryYAxis
          const newY = target.yAxisById.get(match.target.yAxis ?? '') ?? target.primaryYAxis
          const limit = 4 * Math.hypot(target.innerWidth, target.innerHeight)
          for (let i = 0; i < track.geometry.from.length; i++) {
            const from = track.geometry.from[i]
            const to = track.geometry.to[i]
            const distance = Math.hypot(
              target.x(to.x) - previous!.x(from.x),
              newY.scale(to.y) - oldY.scale(from.y),
            )
            if (!Number.isFinite(distance) || distance > limit) return undefined
          }
        }
      }
      tracks.push(track)
    }
    const result = new WaveformPresentation(target, previous, tracks)
    return result.enter || result.update ? result : undefined
  }

  frame(elapsed: number, finishEnter = false, finishUpdate = false) {
    const sampled =
      this.update && !finishUpdate ? this.updateTiming.sample(elapsed) : { done: true, value: 1 }
    const updateDone = !this.update || finishUpdate || sampled.done
    const progress = updateDone ? 1 : sampled.value
    const domainProgress = clampProgress(progress)
    const target = this.target
    const previous = this.previous
    const ctx = { ...target }
    if (previous && !updateDone) {
      ctx.xDomain = domainAt(previous.xDomain, target.xDomain, domainProgress)
      if (!compatibleDomain(ctx.xDomain, target.xDomain))
        throw new Error('Non-invertible animation X domain')
      ctx.x = target.x.copy().domain(ctx.xDomain)
      ctx.xTickLayout = resolveXTicks(ctx.xDomain, target.options.xAxis, target.innerWidth)
      ctx.xTicks = ctx.xTickLayout.majorValues
      ctx.yAxes = target.yAxes.map((axis, index) => {
        const domain = domainAt(previous.yAxes[index].domain, axis.domain, domainProgress)
        if (!compatibleDomain(domain, axis.domain))
          throw new Error('Non-invertible animation Y domain')
        return {
          ...axis,
          domain,
          formatDomain: axis.domain,
          scale: axis.scale.copy().domain(domain),
          ticks: resolveYTicks(domain, axis.options, false),
        }
      })
      ctx.yAxisById = new Map(ctx.yAxes.map((axis) => [axis.options.id, axis]))
      ctx.primaryYAxis = ctx.yAxisById.get(target.primaryYAxis.options.id)!
    }
    ctx.series = []
    ctx.seriesEffects = []
    let enterDone = true
    const append = (
      series: WaveformSeries,
      effect: NonNullable<RenderContext['seriesEffects']>[number] = {},
    ) => {
      ctx.series.push(series)
      ctx.seriesEffects!.push(effect)
    }
    for (const track of this.tracks) {
      if (!track.target) {
        if (!updateDone)
          append(track.previous!, {
            opacity: fadeOpacity(track.opacity, 0, domainProgress),
            clip: track.clip,
          })
      } else if (track.entry && !finishEnter) {
        const entry = track.entry.sample(elapsed)
        enterDone &&= entry.done
        append(track.target, {
          clip: entryClip(ctx.innerWidth, entry.value, target.options.animation.direction),
        })
      } else if (track.previous && !updateDone) {
        if (track.geometry)
          append(
            { ...track.target, data: interpolateGeometry(track.geometry, progress) },
            {
              opacity: fadeOpacity(track.opacity, 1, domainProgress),
              clip: track.clip && {
                x: track.clip.x * (1 - domainProgress),
                width: track.clip.width * (1 - domainProgress) + ctx.innerWidth * domainProgress,
              },
            },
          )
        else {
          append(track.previous, {
            opacity: fadeOpacity(track.opacity, 0, domainProgress),
            clip: track.clip,
          })
          append(track.target, { opacity: fadeOpacity(0, 1, domainProgress) })
        }
      } else append(track.target)
    }
    return { context: enterDone && updateDone ? target : ctx, enterDone, updateDone }
  }
}
