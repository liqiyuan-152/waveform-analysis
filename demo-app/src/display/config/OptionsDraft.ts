import type { ValueAxisOptions, WaveformOptions, WaveformSeries } from 'waveform-analysis/display'
import { setAtPath } from './fields'

function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clone) as T
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])) as T
  return value
}

/** Stores only user-authored overrides. Effective snapshots are display-only. */
export class OptionsDraft {
  private raw: WaveformOptions
  private multi?: {
    axes: ValueAxisOptions[]
    bindings: Array<string | undefined>
    grid?: string
    zero?: string
  }
  constructor(options: WaveformOptions) {
    this.raw = clone(options)
  }
  get options() {
    return clone(this.raw)
  }

  private axes(): ValueAxisOptions[] {
    return clone(
      this.raw.yAxes ?? [
        { id: 'left', ...this.raw.yAxis },
        { id: 'right', position: 'right', ...this.raw.secondaryYAxis },
      ],
    )
  }

  set(path: string, value: unknown): WaveformOptions {
    if (path === 'responsive.minHeight' || path === 'responsive.maxHeight') {
      const candidate = setAtPath(this.raw, path, value)
      const min = candidate.responsive?.minHeight
      const max = candidate.responsive?.maxHeight
      if (typeof min === 'number' && typeof max === 'number' && min > max) {
        throw new Error('最小高度不能大于最大高度')
      }
    }
    if (path.startsWith('yAxes.')) {
      const axes = this.axes()
      const updated = setAtPath({ yAxes: axes }, path, value).yAxes
      this.raw = { ...this.raw, yAxes: updated }
      return { yAxes: clone(updated) }
    }
    this.raw = setAtPath(this.raw, path, value)
    return setAtPath({} as WaveformOptions, path, value)
  }

  switchAxes(
    mode: 'single' | 'multiple',
    series: WaveformSeries[],
  ): { options: WaveformOptions; data: WaveformSeries[] } {
    let axes = this.axes()
    let data = clone(series)
    let grid: string | undefined
    let zero: string | undefined
    if (mode === 'single') {
      this.multi = {
        axes,
        bindings: data.map((item) => item.yAxis),
        grid: this.raw.grid?.y?.axisId,
        zero: this.raw.zeroLine?.axisId,
      }
      axes = [axes.find((axis) => axis.position !== 'right') ?? axes[0] ?? { id: 'left' }]
      data = data.map((item) => ({ ...item, yAxis: axes[0].id }))
      grid = zero = axes[0].id
    } else {
      const left = axes[0] ?? { id: 'left', position: 'left' as const }
      axes = this.multi
        ? [left, ...this.multi.axes.filter((axis) => axis.id !== left.id)]
        : [left, { id: 'right', position: 'right', visible: true }]
      data = data.map((item, index) => ({
        ...item,
        yAxis:
          this.multi && index < this.multi.bindings.length
            ? this.multi.bindings[index]
            : axes[index < Math.ceil(data.length / 2) ? 0 : axes.length - 1].id,
      }))
      grid = this.multi ? this.multi.grid : axes[0].id
      zero = this.multi ? this.multi.zero : axes[0].id
    }
    const patch: WaveformOptions = {
      yAxes: axes,
      grid: { y: { axisId: grid } },
      zeroLine: { axisId: zero },
    }
    this.raw = {
      ...this.raw,
      yAxes: clone(axes),
      grid: { ...this.raw.grid, y: { ...this.raw.grid?.y, axisId: grid } },
      zeroLine: { ...this.raw.zeroLine, axisId: zero },
    }
    return { options: clone(patch), data }
  }
}
