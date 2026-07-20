import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { resizeObservers } from '../test/setup'
import WaveformChart from './WaveformChart.vue'
import { normalizeWaveformData, normalizeWaveformSeries, type WaveformData } from './waveform'

async function mountSizedChart(data: WaveformData, extraProps = {}) {
  const wrapper = mount(WaveformChart, {
    props: { data, ...extraProps },
  })
  resizeObservers.at(-1)?.resize(800, 360)
  await flushPromises()
  return wrapper
}

describe('normalizeWaveformData', () => {
  it('converts samples into time-based points', () => {
    expect(
      normalizeWaveformData({
        kind: 'samples',
        values: [2, 4, 6],
        sampleRate: 2,
        startTime: 1,
      }),
    ).toEqual([
      { x: 1, y: 2 },
      { x: 1.5, y: 4 },
      { x: 2, y: 6 },
    ])
  })

  it('sorts explicit points and filters non-finite values', () => {
    expect(
      normalizeWaveformData({
        kind: 'points',
        points: [
          { x: 2, y: 4 },
          { x: Number.NaN, y: 3 },
          { x: 1, y: 2 },
        ],
      }),
    ).toEqual([
      { x: 1, y: 2 },
      { x: 2, y: 4 },
    ])
  })

  it('returns no points for an invalid sample rate', () => {
    expect(normalizeWaveformData({ kind: 'samples', values: [1, 2], sampleRate: 0 })).toEqual([])
  })

  it('normalizes multiple named series and removes empty series', () => {
    expect(
      normalizeWaveformSeries({
        kind: 'series',
        series: [
          {
            name: 'BT2_2M',
            unit: 'T',
            data: { kind: 'points', points: [{ x: 1, y: 2 }] },
          },
          {
            name: 'empty',
            data: { kind: 'samples', values: [1], sampleRate: 0 },
          },
        ],
      }),
    ).toEqual([
      {
        id: 'series-0',
        name: 'BT2_2M',
        unit: 'T',
        color: undefined,
        points: [{ x: 1, y: 2 }],
      },
    ])
  })
})

describe('WaveformChart', () => {
  const gridSeries = (count: number): WaveformData => ({
    kind: 'series',
    series: Array.from({ length: count }, (_, index) => ({
      id: `channel-${index}`,
      name: `通道 ${index + 1}`,
      data: {
        kind: 'points',
        points: [
          { x: 0, y: index },
          { x: 1, y: index + 1 },
        ],
      },
    })),
  })

  it('paginates channels into a row-major two by one grid', async () => {
    const wrapper = await mountSizedChart(gridSeries(5), {
      grid: { rowCount: 2, columnCount: 1 },
    })

    expect(wrapper.findAll('.waveform-chart__track')).toHaveLength(2)
    expect(
      wrapper.findAll('.waveform-chart__line').map((line) => line.attributes('data-series-id')),
    ).toEqual(['channel-0', 'channel-1'])
    const previousButton = () => wrapper.get('.ant-pagination-prev button')
    const nextButton = () => wrapper.get('.ant-pagination-next button')

    expect(wrapper.get('.ant-pagination-item-1').classes()).toContain('ant-pagination-item-active')
    expect(wrapper.get('.ant-pagination-prev').classes()).toContain('ant-pagination-disabled')

    await nextButton().trigger('click')
    expect(
      wrapper.findAll('.waveform-chart__line').map((line) => line.attributes('data-series-id')),
    ).toEqual(['channel-2', 'channel-3'])
    expect(wrapper.emitted('page-change')?.at(-1)).toEqual([2, 3])

    await previousButton().trigger('click')
    expect(wrapper.get('.ant-pagination-item-1').classes()).toContain('ant-pagination-item-active')
    expect(wrapper.emitted('page-change')?.at(-1)).toEqual([1, 3])

    await nextButton().trigger('click')
    await nextButton().trigger('click')
    expect(
      wrapper.findAll('.waveform-chart__line').map((line) => line.attributes('data-series-id')),
    ).toEqual(['channel-4'])
    expect(wrapper.get('.ant-pagination-item-3').classes()).toContain('ant-pagination-item-active')
    expect(wrapper.get('.ant-pagination-next').classes()).toContain('ant-pagination-disabled')
  })

  it('renders independent cells with separate x axes and overlays', async () => {
    const wrapper = await mountSizedChart(gridSeries(4), {
      displayMode: 'independent',
      grid: { rowCount: 2, columnCount: 2 },
    })

    expect(wrapper.findAll('.waveform-chart__track')).toHaveLength(4)
    expect(wrapper.findAll('.waveform-chart__axis--x')).toHaveLength(4)
    expect(wrapper.findAll('.waveform-chart__overlay--independent')).toHaveLength(4)
    const tracks = wrapper.findAll('.waveform-chart__track')
    const firstTop = Number(tracks[0].attributes('data-track-top'))
    const secondRowTop = Number(tracks[2].attributes('data-track-top'))
    const firstHeight = Number(tracks[0].attributes('data-track-height'))
    expect(secondRowTop).toBeGreaterThan(firstTop + firstHeight + 20)
  })

  it('reserves horizontal clearance for Y-axis labels in multi-column grids', async () => {
    for (const displayMode of ['independent', 'separated', 'compact'] as const) {
      const wrapper = await mountSizedChart(gridSeries(4), {
        displayMode,
        grid: { rowCount: 2, columnCount: 2 },
      })
      const tracks = wrapper.findAll('.waveform-chart__track')
      const firstLeft = Number(tracks[0].attributes('data-track-left') ?? 0)
      const firstWidth = Number(tracks[0].attributes('data-track-width'))
      const secondLeft = Number(tracks[1].attributes('data-track-left'))
      const labelX = Number(tracks[1].attributes('data-y-axis-label-x'))

      expect(secondLeft - (firstLeft + firstWidth)).toBeGreaterThanOrEqual(Math.abs(labelX) + 16)
      expect(tracks[1].find('.waveform-chart__y-axis-label-bg').exists()).toBe(true)
    }
  })

  it('expands the Y-axis label gutter for signed values and long exponents', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: Array.from({ length: 4 }, (_, index) => ({
          id: `wide-axis-${index}`,
          name: `宽范围 ${index + 1}`,
          data: {
            kind: 'points',
            points: [
              { x: 0, y: -1e120 },
              { x: 0.5, y: 0 },
              { x: 1, y: 1e120 },
            ],
          },
        })),
      },
      { displayMode: 'compact', grid: { rowCount: 2, columnCount: 2 } },
    )
    const tracks = wrapper.findAll('.waveform-chart__track')
    const labelX = Number(tracks[0].attributes('data-y-axis-label-x'))
    const firstWidth = Number(tracks[0].attributes('data-track-width'))
    const secondLeft = Number(tracks[1].attributes('data-track-left'))
    const labelBackgroundX = Number(
      tracks[0].get('.waveform-chart__y-axis-label-bg').attributes('x'),
    )

    expect(labelX).toBe(-95)
    expect(labelBackgroundX).toBe(labelX - 12)
    expect(Number(wrapper.attributes('data-chart-left-margin'))).toBe(111)
    expect(secondLeft - firstWidth).toBeGreaterThanOrEqual(111)
  })

  it('keeps a tick-only gutter when channel labels are empty', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: Array.from({ length: 2 }, (_, index) => ({
          id: `unnamed-${index}`,
          name: '',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: -1e120 },
              { x: 1, y: 1e120 },
            ],
          },
        })),
      },
      { yLabel: '', grid: { rowCount: 1, columnCount: 2 } },
    )
    const tracks = wrapper.findAll('.waveform-chart__track')
    const firstWidth = Number(tracks[0].attributes('data-track-width'))
    const secondLeft = Number(tracks[1].attributes('data-track-left'))

    expect(wrapper.findAll('.waveform-chart__y-axis-label')).toHaveLength(0)
    expect(Number(wrapper.attributes('data-chart-left-margin'))).toBe(81)
    expect(secondLeft - firstWidth).toBeGreaterThanOrEqual(81)
  })

  it('keeps the Y-axis label gutter stable while paging between value ranges', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'short-axis',
            name: '短范围',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
            },
          },
          {
            id: 'wide-axis',
            name: '宽范围',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: -1e120 },
                { x: 1, y: 1e120 },
              ],
            },
          },
        ],
      },
      { grid: { rowCount: 1, columnCount: 1 } },
    )
    const initialMargin = wrapper.attributes('data-chart-left-margin')
    const initialLabelX = wrapper.get('.waveform-chart__track').attributes('data-y-axis-label-x')

    await wrapper.get('.ant-pagination-next button').trigger('click')

    expect(wrapper.attributes('data-chart-left-margin')).toBe(initialMargin)
    expect(wrapper.get('.waveform-chart__track').attributes('data-y-axis-label-x')).toBe(
      initialLabelX,
    )
  })

  it('hides only secondary-column Y-axis labels when the grid is too narrow', async () => {
    const wrapper = await mountSizedChart(gridSeries(4), {
      displayMode: 'independent',
      grid: { rowCount: 2, columnCount: 2 },
    })

    resizeObservers.at(-1)?.resize(120, 360)
    await flushPromises()

    expect(wrapper.findAll('.waveform-chart__y-axis-label')).toHaveLength(2)
    expect(wrapper.findAll('.waveform-chart__axis--y')).toHaveLength(4)
    const tracks = wrapper.findAll('.waveform-chart__track')
    const firstWidth = Number(tracks[0].attributes('data-track-width'))
    const secondLeft = Number(tracks[1].attributes('data-track-left'))
    expect(secondLeft - firstWidth).toBeGreaterThanOrEqual(39)
  })

  it('uses one shared overlay and bottom-row x axes for separated and compact grids', async () => {
    for (const displayMode of ['separated', 'compact'] as const) {
      const wrapper = await mountSizedChart(gridSeries(4), {
        displayMode,
        grid: { rowCount: 2, columnCount: 2 },
      })
      expect(wrapper.findAll('.waveform-chart__overlay--shared')).toHaveLength(1)
      expect(wrapper.findAll('.waveform-chart__axis--x')).toHaveLength(2)
      const tracks = wrapper.findAll('.waveform-chart__track')
      const firstTop = Number(tracks[0].attributes('data-track-top'))
      const secondRowTop = Number(tracks[2].attributes('data-track-top'))
      const firstHeight = Number(tracks[0].attributes('data-track-height'))
      if (displayMode === 'compact') expect(secondRowTop).toBe(firstTop + firstHeight)
      else expect(secondRowTop).toBeGreaterThan(firstTop + firstHeight)
    }
  })

  it('keeps unused compact cells visually empty while preserving bottom X axes', async () => {
    const data = gridSeries(4)
    if (data.kind === 'series') {
      data.series.forEach((series, index) => {
        series.data = {
          kind: 'points',
          points: [
            { x: 100, y: index },
            { x: 200, y: index + 1 },
          ],
        }
      })
    }
    const wrapper = await mountSizedChart(data, {
      displayMode: 'compact',
      grid: { rowCount: 2, columnCount: 3 },
    })

    const tracks = wrapper.findAll('.waveform-chart__track')
    const emptyTracks = wrapper.findAll('.waveform-chart__track--empty')
    const firstTrackTop = Number(tracks[0].attributes('data-track-top'))
    const firstTrackHeight = Number(tracks[0].attributes('data-track-height'))
    const secondRowFirstTrackTop = Number(tracks[3].attributes('data-track-top'))

    expect(tracks).toHaveLength(6)
    expect(emptyTracks).toHaveLength(2)
    expect(wrapper.find('.waveform-chart__grid-slot-placeholder').exists()).toBe(false)
    expect(secondRowFirstTrackTop).toBe(firstTrackTop + firstTrackHeight)
    expect(wrapper.findAll('.waveform-chart__axis--x')).toHaveLength(3)
    expect(wrapper.findAll('.waveform-chart__line')).toHaveLength(4)
    expect(emptyTracks[0].findAll('.waveform-chart__grid')).toHaveLength(0)
    expect(emptyTracks[0].find('.waveform-chart__plot-frame').exists()).toBe(false)
    expect(emptyTracks[0].find('.waveform-chart__axis--y').exists()).toBe(false)
    expect(emptyTracks[0].find('.waveform-chart__line').exists()).toBe(false)
    expect(emptyTracks[0].find('.waveform-chart__y-axis-label').exists()).toBe(false)
    expect(emptyTracks[0].find('.waveform-chart__watermark').exists()).toBe(false)

    const populatedBottomTrack = tracks[3]
    expect(emptyTracks[0].get('.waveform-chart__axis-endpoint--start').text()).toBe(
      populatedBottomTrack.get('.waveform-chart__axis-endpoint--start').text(),
    )
    expect(emptyTracks[0].get('.waveform-chart__axis-endpoint--end').text()).toBe(
      populatedBottomTrack.get('.waveform-chart__axis-endpoint--end').text(),
    )
  })

  it('shows the global empty state when compact data has no valid channels', async () => {
    const wrapper = await mountSizedChart(
      { kind: 'samples', values: [1], sampleRate: -1 },
      { displayMode: 'compact', grid: { rowCount: 2, columnCount: 3 } },
    )

    expect(wrapper.get('.waveform-chart__empty').text()).toContain('暂无有效波形数据')
    expect(wrapper.findAll('.waveform-chart__track')).toHaveLength(0)
    expect(wrapper.findAll('.waveform-chart__axis--x')).toHaveLength(0)
    expect(wrapper.findAll('.waveform-chart__line')).toHaveLength(0)
  })

  it('resets the page when the grid configuration changes', async () => {
    const wrapper = await mountSizedChart(gridSeries(5), {
      grid: { rowCount: 1, columnCount: 1 },
    })
    await wrapper.get('.ant-pagination-next button').trigger('click')
    expect(wrapper.get('.ant-pagination-item-2').classes()).toContain('ant-pagination-item-active')

    await wrapper.setProps({ grid: { rowCount: 2, columnCount: 1 } })
    await flushPromises()
    expect(wrapper.get('.ant-pagination-item-1').classes()).toContain('ant-pagination-item-active')
  })

  it('keeps the shared x domain stable while paging separated and compact grids', async () => {
    for (const displayMode of ['separated', 'compact'] as const) {
      const wrapper = await mountSizedChart(gridSeries(3), {
        displayMode,
        grid: { rowCount: 1, columnCount: 1 },
      })
      const initialEnd = wrapper.get('.waveform-chart__axis-endpoint--end').text()
      await wrapper.get('.ant-pagination-next button').trigger('click')
      expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe(initialEnd)
    }
  })

  it('keeps annotations bound to their channel while paging', async () => {
    const wrapper = await mountSizedChart(gridSeries(3), {
      grid: { rowCount: 1, columnCount: 1 },
      annotations: [
        { id: 'channel-2-note', seriesId: 'channel-1', x: 1, y: 2, text: '当前页标注' },
      ],
    })
    expect(wrapper.find('[data-annotation-id="channel-2-note"]').exists()).toBe(false)
    await wrapper.get('.ant-pagination-next button').trigger('click')
    expect(wrapper.find('[data-annotation-id="channel-2-note"]').exists()).toBe(true)
  })
  it('renders a path for sample data and responds to width changes', async () => {
    const wrapper = await mountSizedChart({
      kind: 'samples',
      values: [0, 1, -1, 0.5],
      sampleRate: 4,
    })
    const initialPath = wrapper.get('.waveform-chart__line').attributes('d')

    expect(initialPath).toContain('L')
    expect(wrapper.get('.waveform-chart__svg').attributes('width')).toBe('800')
    expect(wrapper.find('.waveform-annotation-toolbar').exists()).toBe(false)
    expect(wrapper.attributes('data-interaction-mode')).toBeUndefined()

    resizeObservers.at(-1)?.resize(500, 360)
    await flushPromises()

    expect(wrapper.get('.waveform-chart__svg').attributes('width')).toBe('500')
    expect(wrapper.get('.waveform-chart__line').attributes('d')).not.toBe(initialPath)
  })

  it('uses fixed dimensions when both width and height are specified', async () => {
    const wrapper = mount(WaveformChart, {
      props: {
        data: { kind: 'samples', values: [0, 1], sampleRate: 1 },
        width: 640,
        height: 420,
      },
    })

    expect(wrapper.attributes('style')).toContain('width: 640px')
    expect(wrapper.attributes('style')).toContain('height: 420px')
    expect(wrapper.get('.waveform-chart__svg').attributes('width')).toBe('640')
    expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('420')

    resizeObservers.at(-1)?.resize(640, 420)
    await flushPromises()

    expect(wrapper.get('.waveform-chart__svg').attributes('width')).toBe('640')
    expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('420')
  })

  it('allows fixed width and adaptive height to work independently', async () => {
    const wrapper = mount(WaveformChart, {
      props: {
        data: { kind: 'samples', values: [0, 1], sampleRate: 1 },
        width: 640,
      },
    })

    expect(wrapper.attributes('style')).toContain('width: 640px')
    expect(wrapper.attributes('style')).toContain('height: 100%')

    resizeObservers.at(-1)?.resize(640, 500)
    await flushPromises()

    expect(wrapper.get('.waveform-chart__svg').attributes('width')).toBe('640')
    expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('500')
  })

  it('allows adaptive width and fixed height to work independently', async () => {
    const wrapper = mount(WaveformChart, {
      props: {
        data: { kind: 'samples', values: [0, 1], sampleRate: 1 },
        height: 420,
      },
    })

    expect(wrapper.attributes('style')).toContain('width: 100%')
    expect(wrapper.attributes('style')).toContain('height: 420px')

    resizeObservers.at(-1)?.resize(900, 420)
    await flushPromises()

    expect(wrapper.get('.waveform-chart__svg').attributes('width')).toBe('900')
    expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('420')
  })

  it('fills both dimensions and responds to container size changes by default', async () => {
    const wrapper = mount(WaveformChart, {
      props: { data: { kind: 'samples', values: [0, 1], sampleRate: 1 } },
    })

    expect(wrapper.attributes('style')).toContain('width: 100%')
    expect(wrapper.attributes('style')).toContain('height: 100%')
    expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('180')

    resizeObservers.at(-1)?.resize(800, 520)
    await flushPromises()
    expect(wrapper.get('.waveform-chart__svg').attributes('width')).toBe('800')
    expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('520')

    resizeObservers.at(-1)?.resize(500, 300)
    await flushPromises()
    expect(wrapper.get('.waveform-chart__svg').attributes('width')).toBe('500')
    expect(wrapper.get('.waveform-chart__svg').attributes('height')).toBe('300')
  })

  it('applies size fallbacks for minimum, negative, and non-finite values', async () => {
    const minimumWrapper = mount(WaveformChart, {
      props: {
        data: { kind: 'samples', values: [0, 1], sampleRate: 1 },
        width: -20,
        height: -20,
      },
    })

    expect(minimumWrapper.attributes('style')).toContain('width: 0px')
    expect(minimumWrapper.attributes('style')).toContain('height: 180px')
    expect(minimumWrapper.get('.waveform-chart__svg').attributes('height')).toBe('180')

    const adaptiveWrapper = mount(WaveformChart, {
      props: {
        data: { kind: 'samples', values: [0, 1], sampleRate: 1 },
        width: Number.POSITIVE_INFINITY,
        height: Number.NaN,
      },
    })

    expect(adaptiveWrapper.attributes('style')).toContain('width: 100%')
    expect(adaptiveWrapper.attributes('style')).toContain('height: 100%')
  })

  it('keeps a 100k-point SVG path bounded by the plot width', async () => {
    const sourcePoints = Array.from({ length: 100_000 }, (_, index) => ({
      x: index / 1_000,
      y: index === 50_001 ? 100 : Math.sin(index / 50),
    }))
    const wrapper = await mountSizedChart(
      { kind: 'points', points: sourcePoints },
      { rendering: { downsampleThreshold: 1_000, maxPointsPerPixel: 4 } },
    )
    const overlayWidth = Number(wrapper.get('.waveform-chart__overlay').attributes('width'))
    const path = wrapper.get('.waveform-chart__line').attributes('d') ?? ''
    const renderedPointCount = path.match(/[ML]/g)?.length ?? 0

    expect(renderedPointCount).toBeGreaterThan(0)
    expect(renderedPointCount).toBeLessThanOrEqual(Math.floor(overlayWidth * 4) + 2)
    expect(path).toContain(',0')
  })

  it('renders explicit points and supports a single point', async () => {
    const wrapper = await mountSizedChart({ kind: 'points', points: [{ x: 3, y: 8 }] })

    expect(wrapper.get('.waveform-chart__line').attributes('d')).toContain('M')
    expect(wrapper.find('.waveform-chart__empty').exists()).toBe(false)
  })

  it('shows an empty state for empty and invalid data', async () => {
    const wrapper = await mountSizedChart({ kind: 'samples', values: [1], sampleRate: -1 })

    expect(wrapper.get('.waveform-chart__empty').text()).toContain('暂无有效波形数据')
    expect(wrapper.find('.waveform-chart__line').exists()).toBe(false)
  })

  it('emits the nearest point on hover and clears it on leave', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { grid: { rowCount: 1, columnCount: 1 } },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    const overlayWidth = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: 290 }),
    })

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 700, clientY: 120, bubbles: true }),
    )
    await flushPromises()
    expect(wrapper.emitted('point-hover')?.at(-1)).toEqual([{ x: 1, y: 5 }])
    expect(wrapper.find('.waveform-chart__tooltip').exists()).toBe(true)
    expect(wrapper.get('.waveform-chart__tooltip').text()).toContain('ms: 1,000.0000')

    await overlay.trigger('pointerleave')
    expect(wrapper.emitted('point-hover')?.at(-1)).toEqual([null])
  })

  it('renders reference grid styling and an optional frame watermark', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
      { frameNumber: 12 },
    )

    expect(wrapper.findAll('.waveform-chart__grid--major line').length).toBeGreaterThan(0)
    expect(wrapper.findAll('.waveform-chart__grid--minor line').length).toBeGreaterThan(0)
    expect(wrapper.find('.waveform-chart__plot-frame').exists()).toBe(true)
    expect(wrapper.get('.waveform-chart__watermark').text()).toBe('12')
    expect(wrapper.get('.waveform-chart__line').attributes('stroke')).toBe('#0960bd')
  })

  it('continues minor x-grid lines beyond the final major tick to the exact endpoint', async () => {
    const wrapper = await mountSizedChart({
      kind: 'points',
      points: [
        { x: -8, y: 0 },
        { x: 4.9903, y: 1 },
      ],
    })
    const majorGridPositions = wrapper
      .findAll('.waveform-chart__grid--major line')
      .map((line) => Number(line.attributes('x1')))
      .filter(Number.isFinite)
    const minorGridPositions = wrapper
      .findAll('.waveform-chart__grid--minor line')
      .map((line) => Number(line.attributes('x1')))
      .filter(Number.isFinite)
    const trackWidth = Number(wrapper.get('.waveform-chart__track').attributes('data-track-width'))

    expect(Math.max(...minorGridPositions)).toBeGreaterThan(Math.max(...majorGridPositions))
    expect(Math.max(...minorGridPositions)).toBeLessThan(trackWidth)
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').attributes('x')).toBe(
      String(trackWidth),
    )
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('4,990')
  })

  it('uses one shared scientific exponent only for large and tiny Y-axis domains', async () => {
    const cases = [
      { values: [0, 50], exponent: null },
      { values: [0, 254], exponent: 'E+02' },
      { values: [0, 0.0002], exponent: 'E-04' },
    ]

    for (const { values, exponent } of cases) {
      const wrapper = await mountSizedChart({
        kind: 'points',
        points: values.map((y, x) => ({ x, y })),
      })
      const labels = wrapper
        .get('.waveform-chart__axis--y')
        .findAll('.tick text')
        .map((tick) => tick.text())
      const exponentLabels = labels.filter((label) => label.startsWith('E'))

      if (exponent === null) {
        expect(exponentLabels).toEqual([])
      } else {
        expect(exponentLabels).toHaveLength(1)
        expect(exponentLabels[0]).toMatch(new RegExp(`^${exponent.replace('+', '\\+')} `))
        expect(labels.at(-1)).toBe(exponentLabels[0])
      }

      wrapper.unmount()
    }
  })

  it('uses milliseconds by default and supports seconds with a custom label', async () => {
    const data: WaveformData = {
      kind: 'points',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    }
    const millisecondsChart = await mountSizedChart(data)
    const millisecondTicks = millisecondsChart
      .get('.waveform-chart__axis--x')
      .findAll('.tick text')
      .map((tick) => tick.text())

    expect(millisecondsChart.text()).toContain('时间（ms）')
    expect(millisecondTicks.length).toBeGreaterThan(0)
    expect(millisecondsChart.get('.waveform-chart__axis-endpoint--end').text()).toBe('1,000')
    expect(millisecondsChart.find('.waveform-chart__watermark').exists()).toBe(false)

    const secondsChart = await mountSizedChart(data, { timeUnit: 's', xLabel: 'Elapsed time' })
    expect(secondsChart.text()).toContain('Elapsed time')
    expect(secondsChart.get('.waveform-chart__axis-endpoint--end').text()).toBe('1')
  })

  it('pins the exact visible range values to both x-axis endpoints', async () => {
    const wrapper = await mountSizedChart({
      kind: 'samples',
      values: Array.from({ length: 2000 }, (_, index) => Math.sin(index / 10)),
      sampleRate: 1000,
    })
    const start = wrapper.get('.waveform-chart__axis-endpoint--start')
    const end = wrapper.get('.waveform-chart__axis-endpoint--end')
    const middleTickLabels = wrapper
      .get('.waveform-chart__axis--x')
      .findAll('.tick text')
      .map((tick) => tick.text())

    expect(start.attributes('x')).toBe('0')
    expect(start.attributes('text-anchor')).toBe('start')
    expect(start.text()).toBe('0')
    expect(end.attributes('x')).toBe(
      wrapper.get('.waveform-chart__track').attributes('data-track-width'),
    )
    expect(end.attributes('text-anchor')).toBe('end')
    expect(end.text()).toBe('1,999')
    expect(middleTickLabels.length).toBeGreaterThan(0)
    expect(middleTickLabels).not.toContain('0')
    expect(wrapper.findAll('.waveform-chart__grid--major line').length).toBeGreaterThan(
      middleTickLabels.length,
    )
    const middleTick = wrapper.get('.waveform-chart__axis--x .tick text')
    const endpointGroup = wrapper.get('.waveform-chart__axis-endpoints')
    const xAxis = wrapper.get('.waveform-chart__axis--x')
    expect(start.attributes('y')).toBe(middleTick.attributes('y'))
    expect(start.attributes('dy')).toBe(middleTick.attributes('dy'))
    expect(end.attributes('y')).toBe(middleTick.attributes('y'))
    expect(end.attributes('dy')).toBe(middleTick.attributes('dy'))
    expect(endpointGroup.attributes('font-family')).toBe(xAxis.attributes('font-family'))
    expect(endpointGroup.attributes('font-size')).toBe(xAxis.attributes('font-size'))
  })

  it('keeps zoom-change domains in source seconds', async () => {
    const wrapper = await mountSizedChart({
      kind: 'points',
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 1 },
      ],
    })
    const overlay = wrapper.get('.waveform-chart__overlay')
    const overlayWidth = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: 290 }),
    })

    const initialStart = wrapper.get('.waveform-chart__axis-endpoint--start').text()
    const initialEnd = wrapper.get('.waveform-chart__axis-endpoint--end').text()

    overlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -4000,
        clientX: overlayWidth / 2,
        clientY: 145,
        bubbles: true,
        cancelable: true,
      }),
    )
    await flushPromises()

    const emittedDomain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as
      [number, number] | undefined
    expect(emittedDomain).toBeDefined()
    expect(emittedDomain?.[0]).toBeGreaterThanOrEqual(0)
    expect(emittedDomain?.[1]).toBeLessThanOrEqual(2)
    expect(wrapper.get('.waveform-chart__axis-endpoint--start').attributes('x')).toBe('0')
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').attributes('x')).toBe(
      String(overlayWidth),
    )
    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).not.toBe(initialStart)
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).not.toBe(initialEnd)
    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).toContain('.')
  })

  it('keeps independent multi-column zoom inside the active track domain', async () => {
    const wrapper = await mountSizedChart(gridSeries(2), {
      displayMode: 'independent',
      grid: { rowCount: 1, columnCount: 2 },
    })
    const overlays = wrapper.findAll('.waveform-chart__overlay--independent')
    const endpoints = () =>
      wrapper.findAll('.waveform-chart__axis-endpoint--end').map((item) => item.text())
    const initialEndpoints = endpoints()
    const firstWidth = Number(overlays[0].attributes('width'))
    Object.defineProperty(overlays[0].element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: firstWidth, height: 260 }),
    })

    overlays[0].element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -4_000,
        clientX: firstWidth - 1,
        clientY: 130,
        bubbles: true,
        cancelable: true,
      }),
    )
    await flushPromises()

    const domain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
    expect(domain[0]).toBeGreaterThanOrEqual(0)
    expect(domain[1]).toBeLessThanOrEqual(1)
    expect(endpoints()[0]).not.toBe(initialEndpoints[0])
    expect(endpoints()[1]).toBe(initialEndpoints[1])
  })

  it('rebuilds cached domains only when the data reference changes', async () => {
    const firstData: WaveformData = {
      kind: 'points',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    }
    const wrapper = await mountSizedChart(firstData)
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('1,000')

    firstData.points.push({ x: 2, y: 2 })
    await flushPromises()
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('1,000')

    await wrapper.setProps({ data: { ...firstData, points: [...firstData.points] } })
    await flushPromises()
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('2,000')
  })

  it('renders named multi-channel paths as independent tracks by default', async () => {
    const wrapper = await mountSizedChart({
      kind: 'series',
      series: [
        {
          name: 'BT2_2M',
          unit: 'T',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 2 },
            ],
          },
        },
        {
          name: 'BT1_2M',
          unit: 'T',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: -1 },
              { x: 2, y: 3 },
            ],
          },
        },
      ],
    })
    const paths = wrapper.findAll('.waveform-chart__line')

    expect(paths).toHaveLength(2)
    expect(wrapper.findAll('.waveform-chart__svg')).toHaveLength(1)
    expect(wrapper.findAll('.waveform-chart__track')).toHaveLength(2)
    expect(wrapper.findAll('.waveform-chart__axis--x')).toHaveLength(2)
    expect(wrapper.findAll('.waveform-chart__overlay--independent')).toHaveLength(2)
    expect(paths[0].attributes('stroke')).toBe('#0960bd')
    expect(paths[1].attributes('stroke')).toBe('#ff7f0e')
    expect(paths[0].attributes('data-series-name')).toBe('BT2_2M')
    const yAxisLabels = wrapper.findAll('.waveform-chart__y-axis-label')
    expect(yAxisLabels.map((label) => label.text())).toEqual(['BT2_2M', 'BT1_2M'])
    expect(yAxisLabels.map((label) => label.attributes('fill'))).toEqual(['#0960bd', '#ff7f0e'])
    const labelX = Number(
      yAxisLabels[0].attributes('transform')?.match(/^translate\(([-\d.]+),/)?.[1],
    )
    expect(labelX).toBeLessThan(-46)
    expect(Number(wrapper.get('.waveform-chart__y-axis-label-bg').attributes('x'))).toBe(
      labelX - 12,
    )
    expect(yAxisLabels.every((label) => !label.text().includes('(T)'))).toBe(true)
    expect(wrapper.findAll('.waveform-chart__track-label')).toHaveLength(0)
    expect(
      wrapper.findAll('.waveform-chart__axis-endpoint--end').map((item) => item.text()),
    ).toEqual(['1,000', '2,000'])
  })

  it('keeps the zero Y-axis label on upper compact tracks', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            name: 'first',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
            },
          },
          {
            name: 'second',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: -1 },
                { x: 1, y: 2 },
              ],
            },
          },
        ],
      },
      { displayMode: 'compact' },
    )

    const tracks = wrapper.findAll('.waveform-chart__track')
    const firstAxisTicks = tracks[0].findAll('.waveform-chart__axis--y .tick')
    const zeroTicks = firstAxisTicks.filter((tick) => Number(tick.text()) === 0)
    const firstTrackHeight = Number(tracks[0].attributes('data-track-height'))
    const zeroTickY = Number(
      zeroTicks[0].attributes('transform')?.match(/translate\(0,\s*([\d.]+)\)/)?.[1],
    )

    expect(zeroTicks).toHaveLength(1)
    expect(Math.abs(zeroTickY - firstTrackHeight)).toBeLessThanOrEqual(1)
  })

  it.each(['independent', 'separated', 'compact'] as const)(
    'shows a non-zero Y-axis start value once in %s mode',
    async (displayMode) => {
      const wrapper = await mountSizedChart(
        {
          kind: 'series',
          series: [
            {
              name: 'first',
              data: {
                kind: 'points',
                points: [
                  { x: 0, y: 0.11 },
                  { x: 1, y: 0.89 },
                ],
              },
            },
            {
              name: 'second',
              data: {
                kind: 'points',
                points: [
                  { x: 0, y: 4 },
                  { x: 1, y: 5 },
                ],
              },
            },
          ],
        },
        { displayMode },
      )

      const firstTrack = wrapper.findAll('.waveform-chart__track')[0]
      const firstTrackHeight = Number(firstTrack.attributes('data-track-height'))
      const startTicks = firstTrack.findAll('.waveform-chart__axis--y .tick').filter((tick) => {
        const match = tick.attributes('transform')?.match(/translate\(0,\s*([\d.]+)\)/)
        return match ? Math.abs(Number(match[1]) - firstTrackHeight) <= 1 : false
      })

      expect(startTicks).toHaveLength(1)
      expect(Number(startTicks[0].text())).toBe(0.1)
    },
  )

  it.each(['independent', 'separated'] as const)(
    'shows the Y-axis end value once on every track in %s mode',
    async (displayMode) => {
      const wrapper = await mountSizedChart(
        {
          kind: 'series',
          series: [
            {
              name: 'first',
              data: {
                kind: 'points',
                points: [
                  { x: 0, y: 0.11 },
                  { x: 1, y: 0.89 },
                ],
              },
            },
            {
              name: 'second',
              data: {
                kind: 'points',
                points: [
                  { x: 0, y: 4.11 },
                  { x: 1, y: 4.89 },
                ],
              },
            },
          ],
        },
        { displayMode },
      )

      const expectedEndValues = [0.9, 4.9]
      wrapper.findAll('.waveform-chart__track').forEach((track, index) => {
        const endTicks = track.findAll('.waveform-chart__axis--y .tick').filter((tick) => {
          const match = tick.attributes('transform')?.match(/translate\(0,\s*([\d.]+)\)/)
          return match ? Math.abs(Number(match[1])) <= 1 : false
        })

        expect(endTicks).toHaveLength(1)
        expect(Number(endTicks[0].text())).toBe(expectedEndValues[index])
      })
    },
  )

  it('shows Y-axis end values only on the top row in compact mode', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            name: 'top-left',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0.11 },
                { x: 1, y: 0.89 },
              ],
            },
          },
          {
            name: 'top-right',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 1.11 },
                { x: 1, y: 1.89 },
              ],
            },
          },
          {
            name: 'bottom-left',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 2 },
                { x: 1, y: 3 },
              ],
            },
          },
          {
            name: 'bottom-right',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 4 },
                { x: 1, y: 5 },
              ],
            },
          },
        ],
      },
      { displayMode: 'compact', grid: { rowCount: 2, columnCount: 2 } },
    )

    const tracks = wrapper.findAll('.waveform-chart__track')
    const endTicks = tracks.map((track) =>
      track.findAll('.waveform-chart__axis--y .tick').filter((tick) => {
        const match = tick.attributes('transform')?.match(/translate\(0,\s*([\d.]+)\)/)
        return match ? Math.abs(Number(match[1])) <= 1 : false
      }),
    )

    expect(endTicks[0]).toHaveLength(1)
    expect(Number(endTicks[0][0].text())).toBe(0.9)
    expect(endTicks[1]).toHaveLength(1)
    expect(Number(endTicks[1][0].text())).toBe(1.9)
    expect(endTicks[2]).toHaveLength(0)
    expect(endTicks[3]).toHaveLength(0)
  })

  it('keeps the shared exponent on the top visible tick in compact mode', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            name: 'large',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 254 },
              ],
            },
          },
          {
            name: 'tiny',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 0.0002 },
              ],
            },
          },
        ],
      },
      { displayMode: 'compact' },
    )

    const axes = wrapper.findAll('.waveform-chart__axis--y')
    expect(axes).toHaveLength(2)
    axes.forEach((axis) => {
      const labels = axis.findAll('.tick text').map((tick) => tick.text())
      expect(labels.filter((label) => label.startsWith('E'))).toHaveLength(1)
      expect(labels.at(-1)).toMatch(/^E[+-]\d{2} /)
    })
  })

  it('prefers a trimmed series name and falls back to yLabel for unnamed data', async () => {
    const namedChart = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            name: '  BT2_2M  ',
            unit: 'T',
            data: { kind: 'points', points: [{ x: 0, y: 1 }] },
          },
        ],
      },
      { yLabel: 'T' },
    )
    const unnamedChart = await mountSizedChart(
      { kind: 'points', points: [{ x: 0, y: 1 }] },
      { yLabel: '自定义幅值' },
    )

    expect(namedChart.get('.waveform-chart__y-axis-label').text()).toBe('BT2_2M')
    expect(unnamedChart.get('.waveform-chart__y-axis-label').text()).toBe('自定义幅值')
  })

  it('synchronizes every channel tooltip in separated mode and preserves the legacy event', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            name: 'BT2_2M',
            unit: 'T',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 1 },
                { x: 1, y: 2 },
              ],
            },
          },
          {
            name: 'BT1_2M',
            unit: 'T',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 3 },
                { x: 1, y: 4 },
              ],
            },
          },
        ],
      },
      { displayMode: 'separated' },
    )
    const overlay = wrapper.get('.waveform-chart__overlay--shared')
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 712, height: 290 }),
    })

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 700, clientY: 120, bubbles: true }),
    )
    await flushPromises()

    const tooltip = wrapper.get('.waveform-chart__tooltip')
    expect(tooltip.text()).toContain('BT2_2M:')
    expect(tooltip.text()).toContain('2 T')
    expect(tooltip.text()).toContain('BT1_2M:')
    expect(tooltip.text()).toContain('4 T')
    expect(wrapper.findAll('.waveform-chart__crosshair circle')).toHaveLength(2)
    expect(wrapper.emitted('point-hover')?.at(-1)).toEqual([{ x: 1, y: 2 }])
  })

  it('keeps separated tracks apart while sharing one x-axis and one interaction layer', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            name: 'A',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 2, y: 1 },
              ],
            },
          },
          {
            name: 'B',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 10 },
                { x: 2, y: 20 },
              ],
            },
          },
        ],
      },
      { displayMode: 'separated' },
    )
    const tracks = wrapper.findAll('.waveform-chart__track')
    const firstTop = Number(tracks[0].attributes('data-track-top'))
    const firstHeight = Number(tracks[0].attributes('data-track-height'))
    const secondTop = Number(tracks[1].attributes('data-track-top'))

    expect(wrapper.findAll('.waveform-chart__svg')).toHaveLength(1)
    expect(wrapper.findAll('.waveform-chart__axis--x')).toHaveLength(1)
    expect(wrapper.findAll('.waveform-chart__axis--y')).toHaveLength(2)
    expect(wrapper.findAll('.waveform-chart__y-axis-label').map((label) => label.text())).toEqual([
      'A',
      'B',
    ])
    expect(wrapper.findAll('.waveform-chart__overlay--shared')).toHaveLength(1)
    expect(secondTop).toBeGreaterThan(firstTop + firstHeight)
  })

  it('joins compact tracks without a gap and keeps only the bottom x-axis', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            name: 'A',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: -1 },
                { x: 1, y: 1 },
              ],
            },
          },
          {
            name: 'B',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 100 },
                { x: 1, y: 200 },
              ],
            },
          },
        ],
      },
      { displayMode: 'compact' },
    )
    const tracks = wrapper.findAll('.waveform-chart__track')
    const firstTop = Number(tracks[0].attributes('data-track-top'))
    const firstHeight = Number(tracks[0].attributes('data-track-height'))
    const secondTop = Number(tracks[1].attributes('data-track-top'))

    expect(wrapper.attributes('data-display-mode')).toBe('compact')
    expect(wrapper.findAll('.waveform-chart__axis--x')).toHaveLength(1)
    expect(wrapper.findAll('.waveform-chart__y-axis-label').map((label) => label.text())).toEqual([
      'A',
      'B',
    ])
    expect(secondTop).toBeCloseTo(firstTop + firstHeight, 6)
    expect(wrapper.findAll('.waveform-chart__axis--y')[0].text()).not.toBe(
      wrapper.findAll('.waveform-chart__axis--y')[1].text(),
    )
  })

  it('zooms only the active independent track and resets when the mode changes', async () => {
    const wrapper = await mountSizedChart({
      kind: 'series',
      series: [
        {
          name: 'A',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 0 },
              { x: 2, y: 1 },
            ],
          },
        },
        {
          name: 'B',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 2 },
              { x: 2, y: 3 },
            ],
          },
        },
      ],
    })
    const endpoints = () =>
      wrapper.findAll('.waveform-chart__axis-endpoint--end').map((item) => item.text())
    const initialEndpoints = endpoints()
    const firstOverlay = wrapper.findAll('.waveform-chart__overlay--independent')[0]
    Object.defineProperty(firstOverlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 712, height: 130 }),
    })

    firstOverlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -4000,
        clientX: 356,
        clientY: 65,
        bubbles: true,
        cancelable: true,
      }),
    )
    await flushPromises()

    expect(endpoints()[0]).not.toBe(initialEndpoints[0])
    expect(endpoints()[1]).toBe(initialEndpoints[1])

    await wrapper.setProps({ displayMode: 'separated' })
    await flushPromises()

    expect(wrapper.findAll('.waveform-chart__axis--x')).toHaveLength(1)
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('2,000')
  })

  it('updates rendering props and disables zoom interaction', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 1 },
          { x: 1, y: 2 },
        ],
      },
      { zoomable: true, lineColor: '#ff0000' },
    )

    expect(wrapper.get('.waveform-chart__line').attributes('stroke')).toBe('#ff0000')
    expect(wrapper.get('.waveform-chart__overlay').classes()).toContain('is-zoomable')

    await wrapper.setProps({ zoomable: false, lineColor: '#00aa00' })
    await flushPromises()

    expect(wrapper.get('.waveform-chart__line').attributes('stroke')).toBe('#00aa00')
    expect(wrapper.get('.waveform-chart__overlay').classes()).not.toContain('is-zoomable')
  })

  it('binds zoom only while zooming is enabled', async () => {
    const wrapper = await mountSizedChart({
      kind: 'points',
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 1 },
      ],
    })
    const overlay = wrapper.get('.waveform-chart__overlay')
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 712, height: 290 }),
    })
    const initialZoomEventCount = wrapper.emitted('zoom-change')?.length ?? 0
    overlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -4000,
        clientX: 356,
        clientY: 145,
        bubbles: true,
        cancelable: true,
      }),
    )
    await flushPromises()

    expect(wrapper.emitted('zoom-change')?.length ?? 0).toBeGreaterThan(initialZoomEventCount)

    await wrapper.setProps({ zoomable: false })
    await flushPromises()
    const zoomEventCount = wrapper.emitted('zoom-change')?.length ?? 0
    overlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -4000,
        clientX: 356,
        clientY: 145,
        bubbles: true,
        cancelable: true,
      }),
    )
    await flushPromises()

    expect(wrapper.emitted('zoom-change')?.length ?? 0).toBe(zoomEventCount)
    expect(overlay.classes()).not.toContain('is-zoomable')
  })

  it('keeps the annotation toolbar available behind the compatibility prop', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { showAnnotationToolbar: true },
    )

    expect(wrapper.find('.waveform-annotation-toolbar').exists()).toBe(true)
    await wrapper.get('button[aria-label="添加标注"]').trigger('click')
    expect(wrapper.attributes('data-interaction-mode')).toBe('annotation')
  })

  it('creates a controlled annotation from externally selected annotation mode', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { interactionMode: 'annotation' },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    const overlayWidth = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: 290 }),
    })
    const path = wrapper.get('.waveform-chart__line').attributes('d') ?? ''
    const endpoint = path.match(/L([\d.-]+),([\d.-]+)$/)
    expect(endpoint).not.toBeNull()

    expect(wrapper.attributes('data-interaction-mode')).toBe('annotation')
    overlay.element.dispatchEvent(
      new MouseEvent('click', {
        clientX: Number(endpoint?.[1]),
        clientY: Number(endpoint?.[2]),
        bubbles: true,
        cancelable: true,
      }),
    )
    await flushPromises()

    expect(wrapper.find('.waveform-annotation-editor').exists()).toBe(true)
    await wrapper.get('textarea[aria-label="标注文本"]').setValue('峰值点')
    await wrapper.get('.waveform-annotation-editor button.is-primary').trigger('click')

    const annotations = wrapper.emitted('update:annotations')?.at(-1)?.[0] as
      Array<{ seriesId: string; x: number; y: number; text: string }> | undefined
    expect(annotations).toHaveLength(1)
    expect(annotations?.[0]).toMatchObject({ seriesId: 'series-0', x: 1, y: 5, text: '峰值点' })
    expect(wrapper.emitted('annotation-create')).toHaveLength(1)
    expect(wrapper.attributes('data-interaction-mode')).toBe('annotation')
  })

  it('supports right-click creation anywhere in the plot without drawing an anchor or guide line', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { grid: { rowCount: 1, columnCount: 1 } },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    const overlayWidth = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: 290 }),
    })

    overlay.element.dispatchEvent(
      new MouseEvent('contextmenu', {
        clientX: overlayWidth / 2,
        clientY: 145,
        bubbles: true,
      }),
    )
    await flushPromises()
    expect(wrapper.find('.waveform-annotation-editor').exists()).toBe(true)
    expect(wrapper.get('.waveform-annotation-editor').attributes('aria-modal')).toBe('true')
    expect(wrapper.find('.waveform-annotation-editor__panel').exists()).toBe(true)
    await wrapper.get('textarea[aria-label="标注文本"]').setValue('右键标注')
    await wrapper.get('.waveform-annotation-editor button.is-primary').trigger('click')

    expect(wrapper.emitted('update:annotations')?.at(-1)?.[0]).toMatchObject([
      { seriesId: 'series-0', x: 0.5, y: 2.5 },
    ])
    await wrapper.setProps({
      annotations: [{ id: 'right-click', seriesId: 'series-0', x: 0.5, y: 2.5, text: '右键标注' }],
    })
    expect(wrapper.find('.waveform-annotation__vertical-line').exists()).toBe(false)
    expect(wrapper.find('.waveform-annotation__anchor').exists()).toBe(false)
    expect(wrapper.get('.waveform-annotation').attributes('data-placement')).toBe('top')
    expect(wrapper.get('.waveform-annotation__arrow').attributes('x1')).toBe(
      wrapper.get('.waveform-annotation__arrow').attributes('x2'),
    )
  })

  it('limits modal channel options to the graph frame under the pointer', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'channel-a',
            name: '通道 A',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
            },
          },
          {
            id: 'channel-b',
            name: '通道 B',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 10 },
                { x: 1, y: 11 },
              ],
            },
          },
        ],
      },
      { displayMode: 'separated' },
    )
    const overlays = wrapper.findAll('.waveform-chart__overlay--shared')
    expect(overlays.length).toBeGreaterThan(0)
    Object.defineProperty(overlays[0].element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 712, height: 290 }),
    })

    overlays[0].element.dispatchEvent(
      new MouseEvent('contextmenu', { clientX: 356, clientY: 30, bubbles: true }),
    )
    await flushPromises()
    expect(
      wrapper
        .find('select[aria-label="选择标注波形"]')
        .findAll('option')
        .map((item) => item.text()),
    ).toEqual(['通道 A'])

    await wrapper.get('button[aria-label="关闭标注编辑器"]').trigger('click')
    overlays[0].element.dispatchEvent(
      new MouseEvent('contextmenu', { clientX: 356, clientY: 230, bubbles: true }),
    )
    await flushPromises()
    expect(
      wrapper
        .find('select[aria-label="选择标注波形"]')
        .findAll('option')
        .map((item) => item.text()),
    ).toEqual(['通道 B'])
  })

  it('moves an annotation below the point when the top boundary is too close', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { annotations: [{ id: 'top-edge', seriesId: 'series-0', x: 0.5, y: 5, text: '顶部标注' }] },
    )

    expect(wrapper.get('.waveform-annotation').attributes('data-placement')).toBe('bottom')
    expect(wrapper.get('.waveform-annotation__arrow').attributes('x1')).toBe(
      wrapper.get('.waveform-annotation__arrow').attributes('x2'),
    )
  })

  it('edits and immediately deletes existing annotations without mutating props', async () => {
    const sourceAnnotation = {
      id: 'note',
      seriesId: 'series-0',
      x: 1,
      y: 5,
      text: '原文字',
    }
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { annotations: [sourceAnnotation] },
    )

    await wrapper.get('[data-annotation-id="note"]').trigger('contextmenu', {
      clientX: 200,
      clientY: 100,
    })
    await wrapper.get('.waveform-annotation-context-menu button').trigger('click')
    await flushPromises()
    await wrapper.get('textarea[aria-label="标注文本"]').setValue('新文字')
    await wrapper.get('.waveform-annotation-editor button.is-primary').trigger('click')

    const updated = wrapper.emitted('update:annotations')?.at(-1)?.[0] as
      Array<{ text: string }> | undefined
    expect(updated?.[0].text).toBe('新文字')
    expect(sourceAnnotation.text).toBe('原文字')
    expect(wrapper.emitted('annotation-update')).toHaveLength(1)

    await wrapper.get('[data-annotation-id="note"]').trigger('contextmenu', {
      clientX: 200,
      clientY: 100,
    })
    await wrapper.findAll('.waveform-annotation-context-menu button')[1].trigger('click')
    expect(wrapper.emitted('update:annotations')?.at(-1)?.[0]).toEqual([])
    expect(wrapper.emitted('annotation-delete')).toHaveLength(1)
  })

  it('controls visibility and interaction mode while filtering unknown series', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      {
        interactionMode: 'annotation',
        showAnnotationToolbar: true,
        annotations: [
          { id: 'valid', seriesId: 'series-0', x: 1, y: 5, text: '显示' },
          { id: 'unknown', seriesId: 'missing', x: 1, y: 5, text: '不显示' },
        ],
      },
    )

    expect(wrapper.attributes('data-interaction-mode')).toBe('annotation')
    expect(wrapper.findAll('.waveform-annotation')).toHaveLength(1)
    expect(wrapper.get('.waveform-chart__overlay').classes()).toContain('is-annotating')
    await wrapper.get('button[aria-label="隐藏标注"]').trigger('click')
    expect(wrapper.emitted('update:annotations-visible')?.at(-1)).toEqual([false])

    await wrapper.setProps({ annotationsVisible: false })
    expect(wrapper.find('.waveform-annotation').exists()).toBe(false)
  })

  it('reprojects annotations after zoom and keeps them in every display mode', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'a',
            name: 'A',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
                { x: 2, y: 0 },
              ],
            },
          },
        ],
      },
      { annotations: [{ id: 'note', seriesId: 'a', x: 1, y: 1, text: '峰值' }] },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 712, height: 290 }),
    })
    const initialX = wrapper.get('.waveform-annotation__arrow').attributes('x2')

    overlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -200,
        clientX: 600,
        clientY: 145,
        bubbles: true,
        cancelable: true,
      }),
    )
    await flushPromises()
    expect(wrapper.get('.waveform-annotation__arrow').attributes('x2')).not.toBe(initialX)

    for (const displayMode of ['separated', 'compact'] as const) {
      await wrapper.setProps({ displayMode })
      await flushPromises()
      expect(wrapper.find('[data-annotation-id="note"]').exists()).toBe(true)
    }
  })
})
