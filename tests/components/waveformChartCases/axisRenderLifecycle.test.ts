import { DOMWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AxisView } from '@/view/AxisView'
import { svgNode } from '@/rendering/SvgDom'
import { OptionManager } from '@/model/OptionManager'
import type { TrackLayout } from '@/components/core/types'
import { observeNativePresentation } from '@tests/support/nativePresentation'
import { flushVueChartUpdates, mountSizedChart } from '@tests/support/waveformChart'

const data = {
  kind: 'points' as const,
  points: [
    { x: 0, y: 20 },
    { x: 1, y: 80 },
  ],
}
afterEach(() => vi.restoreAllMocks())

async function preparedTrack(): Promise<TrackLayout> {
  const presentation = observeNativePresentation()
  const chart = await mountSizedChart(data, { animationEnabled: false })
  const track = presentation.track(chart.element)
  chart.unmount()
  await flushVueChartUpdates()
  return track
}

function mountAxes(track: TrackLayout, formatter: (value: number) => string) {
  const svg = svgNode(document, 'svg')
  const group = svgNode(document, 'g')
  svg.append(group)
  document.body.append(svg)
  const view = new AxisView(group)
  const options = new OptionManager({ timeUnit: 's', axes: { x: { labelFormatter: formatter } } })
    .value
  view.render(track, options, false)
  const wrapper = new DOMWrapper(svg)
  return {
    wrapper,
    setTrack(next: TrackLayout) {
      view.render(next, options, false)
    },
    unmount() {
      view.dispose()
      svg.remove()
    },
  }
}

describe('axis rendering lifecycle', () => {
  it('does not invoke a consumer formatter after an immediately unmounted chart', async () => {
    const formatter = vi.fn((value: number) => `current ${value}`)
    const chart = await mountSizedChart(data, { axes: { x: { labelFormatter: formatter } } })
    formatter.mockClear()
    chart.unmount()
    await flushVueChartUpdates()
    expect(formatter).not.toHaveBeenCalled()
  })

  it('renders newly revealed axes using the current scale and formatter', async () => {
    const track = await preparedTrack()
    const formatter = vi.fn((value: number) => `current ${value}`)
    const axes = mountAxes({ ...track, showXAxis: false }, formatter)
    try {
      expect(formatter).not.toHaveBeenCalled()
      const xScale = track.xScale.copy().domain([0, 2])
      axes.setTrack({ ...track, xScale, showXAxis: true })
      expect(formatter).toHaveBeenCalled()
      const labels = axes.wrapper
        .findAll('.waveform-chart__axis--x .tick text')
        .map((text) => text.text())
      expect(labels).toEqual(track.xAxisTickValues.map((value) => `current ${value}`))
      const ticks = axes.wrapper.findAll('.waveform-chart__axis--x .tick')
      const position = (index: number) =>
        Number(
          ticks
            .at(index)!
            .attributes('transform')!
            .match(/translate\(([^,]+)/)![1],
        )
      expect(position(-1) - position(0)).toBeCloseTo(
        xScale(track.xAxisTickValues.at(-1)!) - xScale(track.xAxisTickValues[0]),
      )
    } finally {
      axes.unmount()
    }
  })

  it('remeasures labels on font load and font readiness, then stops after disposal', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(document, 'fonts')
    let ready!: () => void
    const fonts = Object.assign(new EventTarget(), {
      ready: new Promise<void>((resolve) => {
        ready = resolve
      }),
    })
    Object.defineProperty(document, 'fonts', { configurable: true, value: fonts })
    let chart: Awaited<ReturnType<typeof mountSizedChart>> | undefined
    try {
      chart = await mountSizedChart(data, {
        displayMode: 'compact',
        axes: { y: { maximumTickVisible: false, minimumTickVisible: false } },
      })
      const minimum = chart.get('text[data-axis-minimum-label]').element
      const maximum = chart.get('text[data-axis-maximum-label]').element
      vi.spyOn(minimum, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 20, 12))
      const bounds = vi
        .spyOn(maximum, 'getBoundingClientRect')
        .mockReturnValue(new DOMRect(0, 0, 20, 12))
      fonts.dispatchEvent(new Event('loadingdone'))
      await flushVueChartUpdates()
      expect(maximum.getAttribute('display')).toBe('none')
      bounds.mockReturnValue(new DOMRect(0, 10000, 20, 12))
      ready()
      await flushVueChartUpdates()
      expect(maximum.getAttribute('display')).toBe('none')
      chart.unmount()
      bounds.mockReturnValue(new DOMRect(0, 0, 20, 12))
      fonts.dispatchEvent(new Event('loadingdone'))
      await flushVueChartUpdates()
      expect(maximum.getAttribute('display')).toBe('none')
    } finally {
      chart?.unmount()
      if (descriptor) Object.defineProperty(document, 'fonts', descriptor)
      else Reflect.deleteProperty(document, 'fonts')
    }
  })
})
