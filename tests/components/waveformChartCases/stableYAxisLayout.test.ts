import { resizeChart } from '@tests/support/setup'
import { flushVueChartUpdates as flushPromises } from '@tests/support/waveformChart'
import { describe, expect, it } from 'vitest'

import type { WaveformData } from '@/types'
import { measureYAxisTextWidth } from '@/components/core/yAxisTextWidth'
import { flushAnimationFrames } from '@tests/support/setup'
import { mountSizedChart } from '@tests/support/waveformChart'

type Chart = Awaited<ReturnType<typeof mountSizedChart>>

function changingRangeData(multipleAxes = false): WaveformData {
  return {
    kind: 'series',
    series: Array.from({ length: multipleAxes ? 6 : 1 }, (_, index) => ({
      id: `channel-${index}`,
      trackId: `frame-${Math.floor(index / 3)}`,
      name: `Channel ${index + 1}`,
      unit: index % 3 === 1 ? 'millivolts' : 'V',
      data: {
        kind: 'points',
        points: Array.from({ length: 101 }, (_, x) => ({
          x,
          y:
            (x === 0 ? -20000 : x === 100 ? 20000 : Math.sin(x / 7) * 100) *
            [1, 0.00001, 1e100][index % 3]!,
        })),
      },
    })),
  }
}

function geometry(chart: Chart) {
  const tracks = chart.findAll('.waveform-chart__track').map((track) => ({
    left: Number(track.attributes('data-track-left')),
    width: Number(track.attributes('data-track-width')),
    transform: track.attributes('transform'),
    frame: track.get('.waveform-chart__plot-frame').attributes(),
    axes: track.findAll('.waveform-track__axis--y').map((axis) => axis.attributes('transform')),
    titles: track
      .findAll('.waveform-chart__y-axis-label')
      .map((title) => title.attributes('transform')),
  }))
  const marginLeft = Number(chart.get('.waveform-chart').attributes('data-chart-left-margin'))
  const svgWidth = Number(chart.get('.waveform-chart__svg').attributes('width'))
  expect(Number.isFinite(marginLeft)).toBe(true)
  expect(Number.isFinite(svgWidth)).toBe(true)
  expect(tracks.every((track) => Number.isFinite(track.left) && track.width > 0)).toBe(true)
  return {
    marginLeft,
    marginRight:
      svgWidth - marginLeft - Math.max(...tracks.map((track) => track.left + track.width)),
    tracks,
    columnGaps: tracks
      .slice(1)
      .map((track, index) => track.left - tracks[index]!.left - tracks[index]!.width),
  }
}

const ticks = (chart: Chart) => chart.findAll('.waveform-track__axis--y').map((axis) => axis.text())
const paths = (chart: Chart) =>
  chart.findAll('.waveform-chart__line').map((line) => line.attributes('d'))
const xLabels = (chart: Chart) =>
  chart.findAll('.waveform-chart__axis-endpoints').map((endpoints) => endpoints.text())

function expectTitleClearance(chart: Chart) {
  for (const track of chart.findAll('.waveform-chart__track')) {
    const axes = track.findAll('.waveform-track__axis--y')
    for (const axis of axes) {
      const index = axis.attributes('data-y-axis-index')
      const titleBand = track.find(
        axes.length > 1
          ? `[data-y-axis-title-index="${index}"] .waveform-chart__y-axis-label-bg`
          : '.waveform-chart__y-axis-label-bg',
      )
      if (!titleBand.exists()) continue
      const axisX = Number(axis.attributes('transform')?.match(/translate\(([-\d.e+]+)/)?.[1])
      const titleLeft = Number(titleBand.attributes('x'))
      const titleRight = titleLeft + Number(titleBand.attributes('width'))
      for (const label of axis.findAll('.tick text')) {
        if (label.attributes('display') === 'none') continue
        // Only the exponent may share the name band; visible units still need clearance.
        const textWidth = measureYAxisTextWidth(
          label.text().replace(/^E[+-]\d+\s*|\s*E[+-]\d+$/g, ''),
        )
        const anchorX = axisX + Number(label.attributes('x'))
        const gap =
          axis.attributes('data-y-axis-side') === 'right'
            ? titleLeft - anchorX - textWidth
            : anchorX - textWidth - titleRight
        expect(gap).toBeGreaterThanOrEqual(2)
        const fullWidth = measureYAxisTextWidth(label.text())
        const absoluteAnchor =
          Number(chart.get('.waveform-chart').attributes('data-chart-left-margin')) +
          Number(track.attributes('data-track-left')) +
          anchorX
        const svgWidth = Number(chart.get('.waveform-chart__svg').attributes('width'))
        expect(
          axis.attributes('data-y-axis-side') === 'right'
            ? svgWidth - absoluteAnchor - fullWidth
            : absoluteAnchor - fullWidth,
        ).toBeGreaterThanOrEqual(0)
      }
    }
  }
}

async function dragPan(chart: Chart) {
  expect(chart.vm.setInteractionMode('pan').status).toBe('applied')
  await flushPromises()
  const overlay = chart.findAll('.waveform-chart__overlay')[0]!
  const width = Number(overlay.attributes('width'))
  const height = Number(overlay.attributes('height'))
  Object.defineProperty(overlay.element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ left: 0, top: 0, width, height }),
  })
  const track = chart.get('.waveform-chart__track')
  const trackWidth = Number(track.attributes('data-track-width'))
  const trackHeight = Number(track.attributes('data-track-height'))
  const startX = trackWidth * 0.5
  const startY = trackHeight * 0.5
  for (const [type, x, y] of [
    ['pointerdown', startX, startY],
    ['pointermove', startX - trackWidth * 0.15, startY + trackHeight * 0.1],
    ['pointerup', startX - trackWidth * 0.15, startY + trackHeight * 0.1],
  ] as const) {
    const event = new MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true })
    Object.defineProperty(event, 'pointerId', { value: 91 })
    overlay.element.dispatchEvent(event)
  }
  flushAnimationFrames()
  await flushPromises()
}

const configurations = (['independent', 'separated', 'compact'] as const).flatMap((displayMode) =>
  (['default', 'edge-compact'] as const).flatMap((layoutPreset) =>
    [320, 800, 1600].map((width) => ({ displayMode, layoutPreset, width })),
  ),
)

describe('stable Y axis space during viewport changes', () => {
  it.each(configurations)(
    'keeps frames, slots and titles stationary in $displayMode/$layoutPreset at $width px',
    async ({ displayMode, layoutPreset, width }) => {
      const multipleAxes = width === 1600
      const chart = await mountSizedChart(changingRangeData(multipleAxes), {
        width,
        displayMode,
        layoutPreset,
        overlayMode: multipleAxes ? 'multi-axis' : 'single-axis',
        grid: { rowCount: 1, columnCount: multipleAxes ? 2 : 1 },
        animationEnabled: false,
        xDomainStrategy: { type: 'data' },
        pannable: true,
        axes: { y: { nice: false, upperPaddingEnabled: true, lowerPaddingEnabled: true } },
      })
      resizeChart(width, 360)
      await flushPromises()
      try {
        const originalGeometry = geometry(chart)
        const originalTicks = ticks(chart)
        const originalXLabels = xLabels(chart)
        const originalPaths = paths(chart)
        expect(originalGeometry.tracks).toHaveLength(multipleAxes ? 2 : 1)
        expect(originalGeometry.tracks[0]!.titles.length).toBeGreaterThan(0)
        expect(originalTicks[0]).toMatch(/E\+04/)
        expect(originalPaths.length).toBeGreaterThan(0)
        expectTitleClearance(chart)

        for (let step = 0; step < 3; step++) {
          expect(chart.vm.zoomIn().status).toBe('applied')
          await flushPromises()
          expect(geometry(chart)).toEqual(originalGeometry)
          expect(xLabels(chart)).not.toEqual(originalXLabels)
          expect(paths(chart)).not.toEqual(originalPaths)
        }
        const beforePan = chart.vm.getControlState().targets[0]!.viewport.xDomain
        const pathsBeforePan = paths(chart)
        await dragPan(chart)
        expect(chart.emitted('pan-end')).toHaveLength(1)
        expect(chart.vm.getControlState().targets[0]!.viewport.xDomain).not.toEqual(beforePan)
        expect(paths(chart)).not.toEqual(pathsBeforePan)
        expect(ticks(chart)).not.toEqual(originalTicks)
        expect(geometry(chart)).toEqual(originalGeometry)
        expectTitleClearance(chart)

        expect(chart.vm.zoomOut().status).toBe('applied')
        await flushPromises()
        expect(geometry(chart)).toEqual(originalGeometry)
        chart.vm.resetViewport()
        await flushPromises()
        expect(geometry(chart)).toEqual(originalGeometry)
        expect(ticks(chart)).toEqual(originalTicks)
        expect(paths(chart)).toEqual(originalPaths)
      } finally {
        chart.unmount()
      }
    },
  )

  it.each(configurations.filter(({ width }) => width === 800))(
    'keeps titles and frames fixed across plain/scientific domains in $displayMode/$layoutPreset',
    async ({ displayMode, layoutPreset }) => {
      const chart = await mountSizedChart(changingRangeData(), {
        displayMode,
        layoutPreset,
        yDomain: [-900, 900],
        grid: { rowCount: 1 },
        animationEnabled: false,
        axes: { y: { nice: false } },
      })
      try {
        const initial = geometry(chart)
        expect(ticks(chart)[0]).not.toMatch(/E[+-]\d+/)
        for (const domain of [
          [-10000, 10000],
          [-0.0001, 0.0001],
          [-1e100, 1e100],
          [-900, 900],
        ] as [number, number][]) {
          await chart.setProps({ yDomain: domain })
          await flushPromises()
          expect(geometry(chart)).toEqual(initial)
          expectTitleClearance(chart)
          if (domain[1] === 900) expect(ticks(chart)[0]).not.toMatch(/E[+-]\d+/)
          else expect(ticks(chart)[0]).toMatch(/E[+-]\d+/)
        }
      } finally {
        chart.unmount()
      }
    },
  )

  it.each(['default', 'edge-compact'] as const)(
    'keeps mantissas clear of titles when the highest compact tick is hidden (%s)',
    async (layoutPreset) => {
      const chart = await mountSizedChart(
        {
          kind: 'series',
          series: ['upper', 'lower'].map((id) => ({
            id,
            name: `Channel ${id}`,
            data: { kind: 'samples', values: [0, 30000], sampleRate: 1 },
          })),
        },
        {
          width: 320,
          height: 260,
          layoutPreset,
          displayMode: 'compact',
          grid: { rowCount: 2 },
          yDomain: [0, 30000],
          animationEnabled: false,
          axes: { y: { maximumTickVisible: false, minimumTickVisible: false } },
        },
      )
      resizeChart(320, 260)
      await flushPromises()
      try {
        for (const track of chart.findAll('.waveform-chart__track')) {
          const labels = track.findAll('.waveform-track__axis--y .tick text')
          expect(labels.at(-1)!.attributes('display')).toBe('none')
          const visible = labels.filter((label) => label.attributes('display') !== 'none')
          expect(visible.at(-1)!.text()).toMatch(/^E\+04 /)
        }
        expectTitleClearance(chart)
        const original = geometry(chart)
        chart.vm.zoomIn()
        await flushPromises()
        expect(geometry(chart)).toEqual(original)
        chart.vm.resetViewport()
        await flushPromises()
        expect(geometry(chart)).toEqual(original)
      } finally {
        chart.unmount()
      }
    },
  )
})
