import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, type PropType } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import WaveformTrackAxes from '@/components/rendering/WaveformTrackAxes.vue'
import type { TrackLayout } from '@/components/core/types'
import { mountSizedChart } from '@tests/support/waveformChart'

async function preparedTrack(): Promise<TrackLayout> {
  const chart = await mountSizedChart(
    {
      kind: 'points',
      points: [
        { x: 0, y: 20 },
        { x: 1, y: 80 },
      ],
    },
    { animationEnabled: false },
  )
  const track = chart.findComponent(WaveformTrackAxes).props('track') as TrackLayout
  chart.unmount()
  await flushPromises()
  return track
}

function mountAxes(track: TrackLayout, formatter: (value: number) => string) {
  const host = defineComponent({
    props: { track: { type: Object as PropType<TrackLayout>, required: true } },
    setup: (props) => () =>
      h('svg', [
        h('g', { class: 'waveform-track', 'data-track-height': props.track.height }, [
          h(WaveformTrackAxes, {
            track: props.track,
            innerWidth: 800,
            cleanView: false,
            timeUnit: 's',
            axes: { x: { labelFormatter: formatter } },
            hideOverlappingMaximumLabel: true,
          }),
        ]),
      ]),
  })
  return mount(host, { props: { track } })
}

describe('axis rendering lifecycle', () => {
  it('does not invoke a consumer formatter after an immediately unmounted axis', async () => {
    const formatter = vi.fn((value: number) => `current ${value}`)
    const axes = mountAxes(await preparedTrack(), formatter)
    formatter.mockClear()
    axes.unmount()
    await flushPromises()
    expect(formatter).not.toHaveBeenCalled()
  })

  it('renders newly revealed axes using the current scale and formatter after a DOM patch', async () => {
    const track = await preparedTrack()
    const formatter = vi.fn((value: number) => `current ${value}`)
    const axes = mountAxes({ ...track, showXAxis: false }, formatter)
    try {
      await flushPromises()
      expect(formatter).not.toHaveBeenCalled()
      const xScale = track.xScale.copy().domain([0, 2])
      await axes.setProps({ track: { ...track, xScale, showXAxis: true } })
      await flushPromises()
      expect(formatter).toHaveBeenCalled()
      const labels = axes.findAll('.waveform-chart__axis--x .tick text').map((text) => text.text())
      expect(labels).toEqual(track.xAxisTickValues.map((value) => `current ${value}`))
      const ticks = axes.findAll('.waveform-chart__axis--x .tick')
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
    let axes: ReturnType<typeof mountAxes> | undefined
    try {
      axes = mountAxes(await preparedTrack(), (value) => String(value))
      await flushPromises()
      const minimum = axes.get('text[data-axis-minimum-label]').element
      const maximum = axes.get('text[data-axis-maximum-label]').element
      // Font-driven collision checks still apply to ordinary ticks, not enabled extrema.
      maximum.parentElement!.removeAttribute('data-maximum-tick')
      maximum.parentElement!.setAttribute('data-tick-y', '1')
      vi.spyOn(minimum, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 20, 12))
      const bounds = vi
        .spyOn(maximum, 'getBoundingClientRect')
        .mockReturnValue(new DOMRect(0, 0, 20, 12))
      fonts.dispatchEvent(new Event('loadingdone'))
      await flushPromises()
      expect(maximum.getAttribute('display')).toBe('none')
      bounds.mockReturnValue(new DOMRect(0, 10000, 20, 12))
      ready()
      await flushPromises()
      expect(maximum.getAttribute('display')).toBeNull()
      axes.unmount()
      axes = undefined
      bounds.mockReturnValue(new DOMRect(0, 0, 20, 12))
      fonts.dispatchEvent(new Event('loadingdone'))
      await flushPromises()
      expect(maximum.getAttribute('display')).toBeNull()
    } finally {
      axes?.unmount()
      vi.restoreAllMocks()
      if (descriptor) Object.defineProperty(document, 'fonts', descriptor)
      else Reflect.deleteProperty(document, 'fonts')
    }
  })
})
