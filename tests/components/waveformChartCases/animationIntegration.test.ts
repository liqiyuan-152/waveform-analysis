import { resizeChart } from '@tests/support/setup'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { flushVueChartUpdates, mountSizedChart } from '@tests/support/waveformChart'
import { flushAnimationFrames } from '@tests/support/setup'
import WaveformChart from '@/components/WaveformChart.vue'
import { observeNativePresentation } from '@tests/support/nativePresentation'
let presentation: ReturnType<typeof observeNativePresentation>
import { generateWaveformPath } from '@/components/animation/geometry'
import type { WaveformData, WaveformAnnotation } from '@/index'

function data(y = 10, xs = [0, 1]): WaveformData {
  return {
    kind: 'series',
    series: [
      {
        id: 'a',
        name: 'A',
        data: { kind: 'points', points: xs.map((x, i) => ({ x, y: i ? y : 0 })) },
      },
    ],
  }
}
const annotation: WaveformAnnotation = { id: 'note', seriesId: 'a', x: 1, y: 10, text: 'note' }
let now = 0
const wrappers: Awaited<ReturnType<typeof mountSizedChart>>[] = []
async function chart(input = data(), props = {}) {
  const wrapper = await mountSizedChart(input, {
    animationEnabled: true,
    rendering: { sampling: { mode: 'raw' } },
    ...props,
  })
  await flushVueChartUpdates()
  await nextTick()
  wrappers.push(wrapper)
  return wrapper
}
async function frame(ms: number) {
  now += ms
  await vi.advanceTimersByTimeAsync(ms)
  flushAnimationFrames(now)
  await nextTick()
  await flushVueChartUpdates()
}
function clip(wrapper: Awaited<ReturnType<typeof chart>>) {
  return wrapper.find('.waveform-track__series-item [clipPathUnits] rect')
}
beforeEach(() => {
  presentation = observeNativePresentation()
  now = 0
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('chart animation composition', () => {
  it('reprojects both crossfade geometries as the presentation domain advances', async () => {
    const wrapper = await chart(data(), {
      animation: { duration: 0 },
      animationUpdate: { duration: 1000, easing: 'linear' },
    })
    await wrapper.setProps({ data: data(20, [0, 0.5, 1]) })
    await flushVueChartUpdates()
    await nextTick()
    let previous: string[] = []
    for (const milliseconds of [250, 500]) {
      await frame(milliseconds)
      const track = presentation.track(wrapper.element)
      const rendered = wrapper
        .findAll('.waveform-chart__line')
        .map((path) => path.attributes('d') ?? '')
      expect(rendered).toHaveLength(2)
      expect(rendered).toEqual(
        track.seriesPaths.map((path) =>
          generateWaveformPath(
            path.lineRenderPoints ?? [],
            path.series.lineType,
            track.xScale,
            path.yScale,
          ),
        ),
      )
      if (previous.length) {
        expect(rendered[0]).not.toBe(previous[0])
        expect(rendered[1]).not.toBe(previous[1])
      }
      previous = rendered
    }
    await frame(250)
    expect(wrapper.findAll('.waveform-chart__line')).toHaveLength(1)
  })
  it('publishes finite, synchronized line, point and error coordinates during updates', async () => {
    const input = (y: number, error: number): WaveformData => ({
      kind: 'series',
      series: [
        {
          id: 'a',
          name: 'A',
          pointType: 'circle',
          errorBar: { visible: true },
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 0, error: 1 },
              { x: 1, y, error },
            ],
          },
        },
      ],
    })
    const initial = input(10, 2)
    const wrapper = await chart(initial, {
      animation: { duration: 0 },
      animationUpdate: { duration: 1000, easing: 'linear' },
      yDomain: [-5, 25],
    })
    await wrapper.setProps({ data: input(20, 4) })
    await flushVueChartUpdates()
    await nextTick()
    await frame(500)
    const path = presentation.track(wrapper.element).seriesPaths[0]
    for (const points of [
      path.lineRenderPoints,
      path.pointRenderPoints,
      path.errorBarRenderPoints,
    ]) {
      expect(points).toBeDefined()
      if (!points) throw new Error('Missing animated geometry')
      expect(points[1]).toMatchObject({ x: 1, y: 15, lowerError: 3, upperError: 3 })
      expect(
        points.every(
          (point: { x: number; y: number }) => Number.isFinite(point.x) && Number.isFinite(point.y),
        ),
      ).toBe(true)
    }
    for (const element of wrapper.findAll(
      '.waveform-chart__line, .waveform-track__point, .waveform-track__error-bar',
    )) {
      expect(element.attributes('d')).not.toMatch(/NaN|Infinity/)
    }
    await frame(500)
    expect(initial).toEqual(input(10, 2))
  })
  it('continues annotation appearance independently of a data update', async () => {
    const done = vi.fn(),
      aborted = vi.fn()
    const wrapper = await chart(data(), {
      animation: { duration: 0 },
      animationUpdate: { duration: 1000, easing: 'linear' },
      animationAnnotation: { duration: 400, easing: 'linear', onComplete: done, onAbort: aborted },
    })
    await wrapper.setProps({ annotations: [annotation] })
    await flushVueChartUpdates()
    await frame(100)
    const opacity = () => Number(wrapper.find('.waveform-annotation').attributes('opacity'))
    expect(opacity()).toBeCloseTo(0.25)
    await wrapper.setProps({ data: data(20) })
    await flushVueChartUpdates()
    await nextTick()
    expect(opacity()).toBeCloseTo(0.25)
    await frame(300)
    expect(opacity()).toBe(1)
    expect(done).toHaveBeenCalledTimes(1)
    expect(aborted).not.toHaveBeenCalled()
    expect(presentation.getAnimationCount()).toBeGreaterThan(0)
    await frame(700)
    expect(presentation.getAnimationCount()).toBe(0)
  })
  it('releases a waiting annotation when a data update cancels its series enter', async () => {
    const wrapper = await chart(data(), {
      annotations: [annotation],
      animation: { duration: 1000, easing: 'linear' },
      animationUpdate: { duration: 1000, easing: 'linear' },
      animationAnnotation: { duration: 300, easing: 'linear' },
    })
    await frame(100)
    expect(Number(wrapper.find('.waveform-annotation').attributes('opacity'))).toBe(0)
    await wrapper.setProps({ data: data(20) })
    await flushVueChartUpdates()
    await nextTick()
    await frame(300)
    expect(Number(wrapper.find('.waveform-annotation').attributes('opacity'))).toBe(1)
    expect(clip(wrapper).exists()).toBe(false)
  })
  it('advances the enter clip without rebuilding unchanged geometry or axes', async () => {
    const wrapper = await chart(data(), { animation: { duration: 1000, easing: 'linear' } })
    const track = () => presentation.track(wrapper.element)
    const initial = track()
    const width = Number(clip(wrapper).attributes('width'))
    await frame(300)
    const next = track()
    expect(Number(clip(wrapper).attributes('width'))).toBeGreaterThan(width)
    expect(next.xScale).toBe(initial.xScale)
    expect(next.yAxes).toBe(initial.yAxes)
    expect(next.seriesPaths[0].path).toBe(initial.seriesPaths[0].path)
    expect(next.seriesPaths[0].lineRenderPoints).toBe(initial.seriesPaths[0].lineRenderPoints)
    expect(next.seriesPaths[0].pointRenderPoints).toBe(initial.seriesPaths[0].pointRenderPoints)
  })
  it('initializes clip before the delay, then releases it on completion', async () => {
    const wrapper = await chart(data(), {
      animation: { delay: 200, duration: 1000, easing: 'linear' },
    })
    expect(clip(wrapper).exists()).toBe(true)
    expect(Number(clip(wrapper).attributes('width'))).toBe(0)
    await frame(700)
    const width = Number(wrapper.find('.waveform-chart__track').attributes('data-track-width'))
    expect(Number(clip(wrapper).attributes('width'))).toBeCloseTo(width / 2)
    await frame(500)
    expect(clip(wrapper).exists()).toBe(false)
  })
  it('keeps identical series IDs isolated across chart instances', async () => {
    const a = await chart(),
      b = await chart()
    expect(a.find('.waveform-track__series-item [clipPathUnits]').attributes('id')).not.toBe(
      b.find('.waveform-track__series-item [clipPathUnits]').attributes('id'),
    )
    a.unmount()
    await frame(500)
    expect(Number(clip(b).attributes('width'))).toBeGreaterThan(0)
  })
  it('interpolates Y under fixed domains without rewriting source data or annotations', async () => {
    const initial = data(),
      updated = data(20)
    const wrapper = await chart(initial, {
      animation: { duration: 0 },
      animationUpdate: { duration: 1000, easing: 'linear' },
      animationAnnotation: { duration: 0 },
      yDomain: [0, 20],
      annotations: [annotation],
    })
    const old = wrapper.find('.waveform-chart__line').attributes('d')
    const oldY = Number(wrapper.find('.waveform-annotation__arrow').attributes('y2'))
    await wrapper.setProps({ data: updated })
    await flushVueChartUpdates()
    await nextTick()
    expect(wrapper.find('.waveform-chart__line').attributes('d')).toBe(old)
    await frame(500)
    const middleY = Number(wrapper.find('.waveform-annotation__arrow').attributes('y2'))
    expect(middleY).toBeLessThan(oldY)
    expect(wrapper.find('.waveform-chart__line').attributes('d')).not.toBe(old)
    await frame(500)
    const finalY = Number(wrapper.find('.waveform-annotation__arrow').attributes('y2'))
    expect(middleY).toBeCloseTo((oldY + finalY) / 2)
    expect(annotation.y).toBe(10)
    expect(updated).toEqual(data(20))
    expect(wrapper.emitted('update:annotations')).toBeUndefined()
  })
  it('retains update endpoints after annotation-only refreshes of a settled chart', async () => {
    const initial = data()
    const wrapper = await chart(initial, {
      animation: { duration: 0 },
      animationUpdate: { duration: 1000, easing: 'linear' },
      animationAnnotation: { duration: 0 },
      yDomain: [0, 20],
    })
    const path = () => wrapper.find('.waveform-chart__line').attributes('d')
    const start = path()
    await wrapper.setProps({ annotations: [annotation] })
    await flushVueChartUpdates()
    await wrapper.setProps({ annotations: [] })
    await flushVueChartUpdates()
    expect(path()).toBe(start)
    await wrapper.setProps({ data: data(20) })
    await flushVueChartUpdates()
    await nextTick()
    expect(path()).toBe(start)
    await frame(500)
    const middle = path()
    expect(middle).not.toBe(start)
    await frame(500)
    expect(path()).not.toBe(middle)
    expect(initial).toEqual(data())
    expect(presentation.getAnimationCount()).toBe(0)
  })
  it('crossfades whole series and releases previous geometry on a third update', async () => {
    const wrapper = await chart(data(), {
      animation: { duration: 0 },
      animationUpdate: { duration: 1000, easing: 'linear' },
    })
    await wrapper.setProps({ data: data(20, [0, 0.5, 1]) })
    await flushVueChartUpdates()
    await nextTick()
    await frame(400)
    expect(wrapper.findAll('.waveform-track__series-item')).toHaveLength(2)
    expect(
      wrapper
        .findAll('.waveform-track__series-item')
        .map((item) => Number(item.attributes('opacity'))),
    ).toEqual([0.6, 0.4])
    await wrapper.setProps({ data: data(30, [0, 0.25, 0.5, 1]) })
    await flushVueChartUpdates()
    await nextTick()
    expect(wrapper.findAll('.waveform-track__series-item')).toHaveLength(1)
  })
  it('removes empty series immediately and enters data added after initial empty rendering', async () => {
    const wrapper = await chart({ kind: 'points', points: [] })
    expect(clip(wrapper).exists()).toBe(false)
    await wrapper.setProps({ data: data() })
    await flushVueChartUpdates()
    await nextTick()
    expect(clip(wrapper).exists()).toBe(true)
    await wrapper.setProps({ data: { kind: 'points', points: [] } })
    await flushVueChartUpdates()
    await nextTick()
    expect(wrapper.find('.waveform-chart__line:not([display="none"])').exists()).toBe(false)
  })
  it('finishes latest state before pointer queries and external commands', async () => {
    const wrapper = await chart()
    await frame(400)
    await wrapper.get('.waveform-chart__overlay').trigger('pointermove')
    expect(clip(wrapper).exists()).toBe(false)
    await wrapper.setProps({ data: data(20) })
    await flushVueChartUpdates()
    await nextTick()
    const chartHandle = wrapper.vm as unknown as { fitToData(): unknown }
    chartHandle.fitToData()
    await nextTick()
    expect(clip(wrapper).exists()).toBe(false)
    expect(wrapper.findAll('.waveform-track__series-item')).toHaveLength(1)
  })
  it('ends only annotation style on category disable and releases annotations when enter is disabled', async () => {
    const wrapper = await chart(data(), {
      annotations: [annotation],
      animation: { duration: 1000 },
    })
    expect(Number(wrapper.find('.waveform-annotation').attributes('opacity'))).toBe(0)
    await wrapper.setProps({ animationAnnotation: { enabled: false } })
    await flushVueChartUpdates()
    expect(Number(wrapper.find('.waveform-annotation').attributes('opacity'))).toBe(1)
    expect(clip(wrapper).exists()).toBe(true)
    await wrapper.setProps({ animation: { enabled: false } })
    await flushVueChartUpdates()
    await nextTick()
    expect(clip(wrapper).exists()).toBe(false)
  })
  it('keeps readonly exit snapshots, cancels same-id leave on re-add and does not emit deletes', async () => {
    const wrapper = await chart(data(), {
      animation: { duration: 0 },
      animationAnnotation: { duration: 1000, easing: 'linear' },
      annotations: [annotation],
    })
    await frame(1000)
    await wrapper.setProps({ annotations: [] })
    await flushVueChartUpdates()
    await frame(400)
    expect(wrapper.find('.waveform-annotation').attributes('data-leaving')).toBe('true')
    expect(Number(wrapper.find('.waveform-annotation').attributes('opacity'))).toBeCloseTo(0.6)
    await wrapper.setProps({ annotations: [annotation] })
    await flushVueChartUpdates()
    await frame(500)
    expect(wrapper.findAll('.waveform-annotation')).toHaveLength(1)
    expect(wrapper.find('.waveform-annotation').attributes('data-leaving')).toBe('false')
    expect(Number(wrapper.find('.waveform-annotation').attributes('opacity'))).toBeCloseTo(0.8)
    expect(wrapper.emitted('update:annotations')).toBeUndefined()
  })
  it('statically commits resize, hidden state and global disable without replaying', async () => {
    const wrapper = await chart()
    await wrapper.setProps({ animationEnabled: false })
    await flushVueChartUpdates()
    expect(clip(wrapper).exists()).toBe(false)
    await wrapper.setProps({ animationEnabled: true })
    await flushVueChartUpdates()
    expect(clip(wrapper).exists()).toBe(false)
    await wrapper.setProps({ data: data(20) })
    await flushVueChartUpdates()
    await nextTick()
    await wrapper.setProps({ width: 600 })
    await flushVueChartUpdates()
    await nextTick()
    expect(clip(wrapper).exists()).toBe(false)
    expect(wrapper.findAll('.waveform-track__series-item')).toHaveLength(1)
    await wrapper.setProps({ hiddenSeriesIds: ['a'] })
    await flushVueChartUpdates()
    expect(wrapper.find('.waveform-chart__line:not([display="none"])').exists()).toBe(false)
  })
  it('applies category config before data updates in the same batch', async () => {
    const wrapper = await chart(data(), { animation: { duration: 0 } })
    await wrapper.setProps({ data: data(20), animationUpdate: { enabled: false } })
    await flushVueChartUpdates()
    await nextTick()
    expect(presentation.getAnimationCount()).toBe(0)
  })
  it.each([50000, 199999, 200000, 200001])(
    'counts full compact data at threshold %s before first display',
    async (count) => {
      const input: WaveformData = {
        kind: 'typed-samples',
        values: new Float64Array(count),
        sampleRate: 1000,
      }
      const wrapper = await chart(input, {
        animationEnabled: true,
        rendering: { sampling: { mode: 'raw' } },
      })
      expect(clip(wrapper).exists()).toBe(count < 200000)
    },
  )
  it('handles threshold zero, reduced motion and missing RAF statically', async () => {
    const wrapper = await chart(data(), { animationThreshold: 0 })
    expect(clip(wrapper).exists()).toBe(false)
    const media = globalThis.matchMedia('unused')
    vi.spyOn(globalThis, 'matchMedia').mockReturnValue({ ...media, matches: true })
    const reduce = await chart()
    expect(clip(reduce).exists()).toBe(false)
    const raf = globalThis.requestAnimationFrame
    vi.stubGlobal('requestAnimationFrame', undefined)
    const missing = await chart()
    expect(clip(missing).exists()).toBe(false)
    vi.stubGlobal('requestAnimationFrame', raf)
  })
})

it('reacts to reduced-motion changes and removes its media and visibility listeners', async () => {
  const original = globalThis.matchMedia('unused')
  let changed!: (event: MediaQueryListEvent) => void
  const remove = vi.fn()
  const visibilityRemove = vi.spyOn(document, 'removeEventListener')
  vi.spyOn(globalThis, 'matchMedia').mockReturnValue({
    ...original,
    matches: false,
    addEventListener: vi.fn((_, listener) => {
      changed = listener as (event: MediaQueryListEvent) => void
    }),
    removeEventListener: remove,
  })
  const wrapper = await chart()
  expect(clip(wrapper).exists()).toBe(true)
  changed({ matches: true } as MediaQueryListEvent)
  await flushVueChartUpdates()
  expect(clip(wrapper).exists()).toBe(false)
  changed({ matches: false } as MediaQueryListEvent)
  await flushVueChartUpdates()
  expect(clip(wrapper).exists()).toBe(false)
  wrapper.unmount()
  expect(remove).toHaveBeenCalledWith('change', changed)
  expect(visibilityRemove.mock.calls.some(([name]) => name === 'visibilitychange')).toBe(true)
})

it('pauses background enter without counting hidden time and finishes independently on export', async () => {
  const wrapper = await chart(data(), { animation: { duration: 1000, easing: 'linear' } })
  await frame(200)
  const width = Number(clip(wrapper).attributes('width'))
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  document.dispatchEvent(new Event('visibilitychange'))
  await frame(500)
  expect(Number(clip(wrapper).attributes('width'))).toBe(width)
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  document.dispatchEvent(new Event('visibilitychange'))
  await frame(300)
  expect(Number(clip(wrapper).attributes('width'))).toBeCloseTo(width * 2.5)
  const second = await chart()
  const exported = wrapper.vm.exportImage({ format: 'svg' })
  await frame(500)
  await vi.advanceTimersByTimeAsync(16)
  const blob = await exported
  expect(blob.type).toBe('image/svg+xml')
  expect(clip(wrapper).exists()).toBe(false)
  expect(clip(second).exists()).toBe(true)
})

it('counts hidden and non-current-page series against the global threshold', async () => {
  const input: WaveformData = {
    kind: 'series',
    series: [
      {
        id: 'a',
        name: 'A',
        data: { kind: 'typed-samples', values: new Float64Array(10), sampleRate: 1000 },
      },
      {
        id: 'b',
        name: 'B',
        data: { kind: 'typed-samples', values: new Float64Array(199990), sampleRate: 1000 },
      },
    ],
  }
  const wrapper = await chart(input, {
    grid: { rowCount: 1, columnCount: 1 },
    hiddenSeriesIds: ['b'],
  })
  expect(clip(wrapper).exists()).toBe(false)
  expect(presentation.getAnimationCount()).toBe(0)
})

it('starts initial enter when a hidden host first becomes measurable', async () => {
  const wrapper = mount(WaveformChart, {
    attachTo: document.body,
    props: {
      data: data(),
      width: 800,
      height: 360,
      animationEnabled: true,
      rendering: { sampling: { mode: 'raw' } },
      animation: { duration: 1000, easing: 'linear' },
    },
  })
  await flushVueChartUpdates()
  wrappers.push(wrapper)
  await flushVueChartUpdates()
  await nextTick()
  expect(clip(wrapper).exists()).toBe(false)
  expect(presentation.getAnimationCount()).toBe(0)
  resizeChart(798, 358)
  await flushVueChartUpdates()
  await nextTick()
  expect(clip(wrapper).exists()).toBe(true)
  await frame(500)
  expect(Number(clip(wrapper).attributes('width'))).toBeGreaterThan(0)
})

it('enters only a newly added series while keeping its clip during a shared track update', async () => {
  const initial = data() as Extract<WaveformData, { kind: 'series' }>
  initial.series[0].trackId = 'shared'
  const wrapper = await chart(initial, {
    displayMode: 'separated',
    animation: { duration: 1000, easing: 'linear' },
    animationUpdate: { duration: 1000, easing: 'linear' },
  })
  await frame(1000)
  await wrapper.setProps({
    data: {
      kind: 'series',
      series: [
        initial.series[0],
        {
          id: 'b',
          trackId: 'shared',
          name: 'B',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 20 },
            ],
          },
        },
      ],
    },
  })
  await flushVueChartUpdates()
  await nextTick()
  expect(wrapper.find('[data-series-id="a"] [clipPathUnits]').exists()).toBe(false)
  expect(wrapper.find('[data-series-id="b"] [clipPathUnits]').exists()).toBe(true)
  await frame(500)
  expect(
    Number(wrapper.find('[data-series-id="b"] [clipPathUnits] rect').attributes('width')),
  ).toBeGreaterThan(0)
})

it('clears hidden annotation exit snapshots immediately without ending series enter', async () => {
  const wrapper = await chart(data(), {
    animation: { duration: 0 },
    annotations: [annotation],
    animationAnnotation: { duration: 1000 },
  })
  await frame(1000)
  await wrapper.setProps({ annotations: [] })
  await flushVueChartUpdates()
  await frame(200)
  expect(wrapper.find('.waveform-annotation').exists()).toBe(true)
  await wrapper.setProps({ annotationsVisible: false })
  await flushVueChartUpdates()
  expect(wrapper.find('.waveform-annotation').exists()).toBe(false)
  await wrapper.setProps({ annotationsVisible: true, annotations: [annotation] })
  await flushVueChartUpdates()
  expect(wrapper.find('.waveform-annotation').exists()).toBe(true)
})

it('hides an annotation when the latest series has no full-data anchor', async () => {
  const wrapper = await chart(data(), {
    animation: { duration: 0 },
    animationAnnotation: { duration: 0 },
    annotations: [annotation],
  })
  await wrapper.setProps({
    data: {
      kind: 'series',
      series: [{ id: 'a', name: 'A', data: { kind: 'points', points: [] } }],
    },
  })
  await flushVueChartUpdates()
  await nextTick()
  expect(wrapper.find('.waveform-annotation').exists()).toBe(false)
  expect(wrapper.emitted('update:annotations')).toBeUndefined()
})
