import { afterEach, describe, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import WaveformChart from '../support/LegacyWaveformChart.vue'
import { init } from '@/chart/init'
import type { WaveformChartInstance } from '@/types/native'
import type { WaveformChartOptions } from '@/types/options'
import type { WaveformData } from '@/types/data'
import { resizeObservers } from '../support/setup'
import { flushNativeUpdates } from '../support/nativeChart'

const data: WaveformData = {
  kind: 'series',
  series: ['a', 'b', 'c', 'd'].map((id, index) => ({
    id,
    trackId: index < 2 ? 'shared' : id,
    name: `通道 ${id}`,
    unit: index ? 'V' : 'A',
    errorBar: { visible: true },
    data: {
      kind: 'points',
      points: [
        { x: 0.0012, y: index ? -index * 100 : -0.00001, error: 0.000001 },
        { x: 0.33, y: index ? index * 200 : 0.00002 },
        { x: 1.0025, y: index ? index * 100 : 0.00001 },
      ],
    },
  })),
}
const cleanup: Array<() => void> = []
afterEach(() => {
  cleanup.splice(0).forEach((dispose) => dispose())
})

function snapshot(root: Element) {
  const visible = (node: Element) => {
    for (let ancestor: Element | null = node; ancestor; ancestor = ancestor.parentElement) {
      if (
        ancestor.getAttribute('display') === 'none' ||
        (ancestor instanceof SVGElement && ancestor.style.display === 'none')
      )
        return false
      if (ancestor === root) break
    }
    return true
  }
  const attrs = (node: Element, names: string[]) =>
    Object.fromEntries(
      names.map((name) => [
        name,
        ['x1', 'x2', 'y1', 'y2'].includes(name)
          ? Number(Number(node.getAttribute(name)).toFixed(8))
          : name === 'transform'
            ? node.getAttribute(name)?.replace(/\s/g, '')
            : node.getAttribute(name),
      ]),
    )
  return [...root.querySelectorAll('.waveform-chart__track')].map((track) => ({
    attributes: attrs(track, [
      'data-track-id',
      'data-track-index',
      'data-track-left',
      'data-track-top',
      'data-track-width',
      'data-track-height',
    ]),
    axes: [...track.querySelectorAll('.waveform-chart__axis--y')].map((axis) => ({
      attributes: attrs(axis, [
        'transform',
        'data-y-axis-index',
        'data-y-axis-side',
        'data-label-domain-min',
        'data-label-domain-max',
        'data-label-unit',
      ]),
      labels: [...axis.querySelectorAll('.tick text')].map((text) => ({
        text: text.textContent,
        display: text.getAttribute('display'),
      })),
    })),
    endpoints: [...track.querySelectorAll('.waveform-chart__axis-endpoint')]
      .filter(visible)
      .map((text) => text.textContent?.trim()),
    titles: [...track.querySelectorAll('.waveform-chart__y-axis-label')].map((text) =>
      text.textContent?.trim(),
    ),
    lines: [...track.querySelectorAll('.waveform-chart__line')].map((line) =>
      attrs(line, ['data-series-id', 'data-y-axis-index', 'd', 'stroke']),
    ),
    points: [...track.querySelectorAll('.waveform-chart__point')]
      .filter(visible)
      .map((node) => attrs(node, ['d', 'fill'])),
    errors: [...track.querySelectorAll('.waveform-chart__error-bar')]
      .filter(visible)
      .map((node) => attrs(node, ['d', 'stroke', 'stroke-width'])),
    grid: [...track.querySelectorAll('[data-grid-direction]')]
      .filter(visible)
      .map((node) => attrs(node, ['data-grid-direction', 'x1', 'x2', 'y1', 'y2', 'stroke'])),
    watermark: [...track.querySelectorAll('.waveform-chart__watermark')]
      .filter(visible)
      .map((node) => ({ text: node.textContent?.trim(), ...attrs(node, ['x', 'y', 'style']) })),
    frame: [...track.querySelectorAll('.waveform-chart__plot-frame')].map((node) => ({
      ...attrs(node, ['stroke', 'stroke-width']),
      dash: node.getAttribute('stroke-dasharray') || null,
      cap: node.getAttribute('stroke-linecap') || 'butt',
    })),
    zero: [...track.querySelectorAll('.waveform-chart__zero-line')].map((line) =>
      attrs(line, ['data-y-axis-index', 'y1']),
    ),
  }))
}

async function pair(options: WaveformChartOptions, width: number) {
  const props = {
    data,
    width,
    height: 360,
    animationEnabled: false,
    rendering: { sampling: { mode: 'raw' as const } },
    ...options,
  }
  const vue = mount(WaveformChart, { props })
  cleanup.push(() => vue.unmount())
  resizeObservers.at(-1)?.resize(width, 360)
  await flushPromises()
  const host = document.createElement('div')
  const native = init(host, props, { autoResize: false })
  cleanup.push(() => native.dispose())
  await flushNativeUpdates()
  return { vue, host, native: native as WaveformChartInstance }
}

const scenarios = (['independent', 'separated', 'compact'] as const).flatMap((displayMode) =>
  (['single-axis', 'multi-axis'] as const).flatMap((overlayMode) =>
    (['default', 'edge-compact'] as const).flatMap((layoutPreset) =>
      [800, 360].map((width) => ({
        displayMode,
        overlayMode,
        layoutPreset,
        width,
      })),
    ),
  ),
)
describe('native/Vue layout and axis parity', () => {
  it.each(['axis', 'channel-label', 'channel-label-or-legend', 'legend-single-series'] as const)(
    'matches styled visual layers and unit mode %s',
    async (unitDisplayMode) => {
      const visualData: WaveformData =
        data.kind === 'series'
          ? {
              ...data,
              series: data.series.map((series, index) => ({
                ...series,
                pointType: index % 2 ? 'diamond' : 'circle',
                lineStyle: index % 2 ? 'dash-dot' : 'dashed',
                errorBar: { visible: true, width: 2, color: '#334455' },
              })),
            }
          : data
      const { vue, host, native } = await pair(
        {
          data: visualData,
          unitDisplayMode,
          layoutPreset: 'edge-compact',
          grid: {
            rowCount: 2,
            columnCount: 2,
            showPagination: false,
            trackOrder: ['empty', 'shared', 'c', 'd'],
            trackLines: { c: { horizontal: false, verticalColor: '#123456' } },
          },
          frameNumber: 100,
          frameNumbers: { shared: '试验' },
          frameStyle: {
            borderWidth: 2,
            borderStyle: 'dotted',
            borderColor: '#123456',
            backgroundColor: '#eee',
          },
          legend: { position: 'bottom', interactive: true, backgroundColor: '#fff' },
        },
        800,
      )
      const legend = (root: Element) =>
        [...root.querySelectorAll('.waveform-chart__legend-item')].map((node) => ({
          text: node.textContent?.trim(),
          pressed: node.getAttribute('aria-pressed'),
        }))
      for (const update of [
        {},
        { hiddenSeriesIds: ['a'] },
        { hiddenSeriesIds: [] },
        { cleanView: true },
      ]) {
        native.setOption(update)
        await vue.setProps(update)
        await flushNativeUpdates()
        expect(snapshot(host)).toEqual(snapshot(vue.element))
        expect(legend(host)).toEqual(legend(vue.element))
      }
    },
  )

  it('matches page correction events after ordered empty tracks, reordering and data replacement', async () => {
    const { vue, host, native } = await pair(
      {
        grid: { rowCount: 1, columnCount: 1, trackOrder: ['c', 'empty', 'shared', 'd'] },
      },
      360,
    )
    const pages: number[][] = []
    native.on('page-change', (page, count) => pages.push([page, count]))
    const click = async (label: string) => {
      host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click()
      await vue.get(`[aria-label="${label}"]`).trigger('click')
      await flushNativeUpdates()
    }
    await click('第 4 页')
    const updates: WaveformChartOptions[] = [
      { grid: { rowCount: 1, columnCount: 1, trackOrder: ['d', 'shared', 'empty', 'c'] } },
      {
        grid: {
          rowCount: 1,
          columnCount: 1,
          trackOrder: ['d', 'shared', 'empty', 'c'],
          hideEmptyTracks: true,
        },
      },
      { data: data.kind === 'series' ? { ...data, series: [data.series[2]!] } : data },
      { grid: { rowCount: 2, columnCount: 1, fillIncompleteLastRow: true } },
    ]
    for (const update of updates) {
      native.setOption(update)
      await vue.setProps(update)
      await flushNativeUpdates()
      expect(snapshot(host)).toEqual(snapshot(vue.element))
      expect(pages).toEqual(vue.emitted('page-change'))
    }
  })

  it.each(
    (['default', 'edge-compact'] as const).flatMap((layoutPreset) =>
      [800, 360].map((width) => ({ layoutPreset, width })),
    ),
  )(
    'matches pagination, resizing and clean/presentation in $layoutPreset/$width',
    async ({ layoutPreset, width }) => {
      const { vue, host, native } = await pair(
        {
          layoutPreset,
          grid: { rowCount: 1, columnCount: 1, showPagination: true },
        },
        width,
      )
      const verify = () => {
        expect(snapshot(host)).toEqual(snapshot(vue.element))
        expect(host.querySelector('svg.waveform-chart__svg')?.getAttribute('height')).toBe(
          vue.find('svg.waveform-chart__svg').attributes('height'),
        )
        expect(host.querySelector('[aria-current="page"]')?.textContent).toBe(
          vue.find('[aria-current="page"]').exists()
            ? vue.get('[aria-current="page"]').text()
            : undefined,
        )
      }
      verify()
      for (let page = 2; page <= 3; page++) {
        host.querySelector<HTMLButtonElement>('[aria-label="下一页"]')!.click()
        await vue.get('[aria-label="下一页"]').trigger('click')
        await flushNativeUpdates()
        verify()
      }
      for (const update of [
        { cleanView: true },
        { cleanView: false, presentationMode: true },
        { presentationMode: false, hiddenSeriesIds: ['c'] },
        { grid: { rowCount: 2, columnCount: 1, showPagination: true } },
        { displayMode: 'compact' as const },
      ]) {
        native.setOption(update)
        await vue.setProps(update)
        await flushNativeUpdates()
        expect(snapshot(host)).toEqual(snapshot(vue.element))
        expect(host.querySelector('svg.waveform-chart__svg')?.getAttribute('height')).toBe(
          vue.find('svg.waveform-chart__svg').attributes('height'),
        )
      }
    },
  )

  it.each(['independent', 'separated', 'compact'] as const)(
    'preserves %s layout through hidden-series, track-order and data-reference changes',
    async (displayMode) => {
      const { vue, host, native } = await pair(
        {
          displayMode,
          overlayMode: 'multi-axis',
          grid: { rowCount: 2, columnCount: 2, showPagination: false },
        },
        800,
      )
      const updates: WaveformChartOptions[] = [
        { hiddenSeriesIds: ['a'] },
        {
          hiddenSeriesIds: ['a', 'b', 'c', 'd'],
          grid: {
            rowCount: 2,
            columnCount: 2,
            showPagination: false,
            trackOrder: ['empty', 'd', 'shared', 'c'],
          },
        },
        { hiddenSeriesIds: [] },
        {
          data: data.kind === 'series' ? { ...data, series: [...data.series].reverse() } : data,
        },
      ]
      for (const update of updates) {
        native.setOption(update)
        await vue.setProps(update)
        await flushNativeUpdates()
        expect(snapshot(host)).toEqual(snapshot(vue.element))
      }
    },
  )

  it.each(scenarios)(
    '$displayMode / $overlayMode / $layoutPreset / $width',
    async ({ width, ...options }) => {
      const { vue, host } = await pair(
        {
          ...options,
          grid: {
            rowCount: 2,
            columnCount: 2,
            showPagination: false,
            trackOrder: ['c', 'empty', 'shared', 'd'],
          },
        },
        width,
      )
      expect(snapshot(host)).toEqual(snapshot(vue.element))
    },
  )

  it.each(['single-axis', 'multi-axis'] as const)(
    'matches fixed domains and amplitude-limit precedence in %s',
    async (overlayMode) => {
      const { vue, host, native } = await pair(
        {
          overlayMode,
          grid: { rowCount: 3, columnCount: 1, showPagination: false },
          yDomain: [-999, 999],
          yDomains: { a: [-0.5, 0.5], b: [-400, 400] },
          axes: { y: { upperPaddingEnabled: true, lowerPaddingEnabled: true } },
          amplitudeLimits: { a: { lower: -0.0001, upper: 0.0001 }, c: { upper: 200 } },
        },
        800,
      )
      expect(snapshot(host)).toEqual(snapshot(vue.element))
      native.setViewportDomain([0.1, 0.7])
      vue.vm.setViewportDomain([0.1, 0.7])
      await flushPromises()
      await flushNativeUpdates()
      expect(snapshot(host)).toEqual(snapshot(vue.element))
    },
  )

  it.each([800, 360])('keeps custom tick/endpoints and seconds stable at %spx', async (width) => {
    const { vue, host, native } = await pair(
      {
        layoutPreset: 'edge-compact',
        timeUnit: 's',
        axes: {
          x: { labelFormatter: (value, context) => `${value.toFixed(3)}${context.timeUnit}` },
        },
        grid: { rowCount: 3, columnCount: 1, showPagination: false },
      },
      width,
    )
    native.setViewportDomain([0.125, 0.875])
    vue.vm.setViewportDomain([0.125, 0.875])
    await flushPromises()
    await flushNativeUpdates()
    const domain = native.getControlState().targets.map((target) => target.viewport.xDomain)
    expect(snapshot(host)).toEqual(snapshot(vue.element))
    for (const timeUnit of ['ms', 's'] as const) {
      native.setOption({ timeUnit })
      await vue.setProps({ timeUnit })
      await flushNativeUpdates()
      expect(native.getControlState().targets.map((target) => target.viewport.xDomain)).toEqual(
        domain,
      )
      expect(snapshot(host)).toEqual(snapshot(vue.element))
      expect(host.querySelector('.waveform-chart__axis-endpoint')?.textContent).toBe(
        timeUnit === 'ms' ? '125.000ms' : '0.125s',
      )
    }
  })
})
