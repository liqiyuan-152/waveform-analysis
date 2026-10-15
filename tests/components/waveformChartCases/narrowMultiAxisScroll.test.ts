import { resizeChart } from '@tests/support/setup'
import { flushVueChartUpdates as flushPromises } from '@tests/support/waveformChart'
import { describe, expect, it } from 'vitest'

import type { WaveformData } from '@/types'
import { flushAnimationFrames, resizeObservers } from '@tests/support/setup'
import { mountSizedChart } from '@tests/support/waveformChart'

type Chart = Awaited<ReturnType<typeof mountSizedChart>>

function fourAxisTracks(count: number): WaveformData {
  return {
    kind: 'series',
    series: Array.from({ length: count * 4 }, (_, index) => ({
      id: `series-${index}`,
      trackId: `track-${Math.floor(index / 4)}`,
      name: `Channel ${index + 1}`,
      unit: ['V', 'A', 'T', 'Pa'][index % 4],
      data: {
        kind: 'points',
        points: Array.from({ length: 101 }, (_, x) => ({
          x,
          y: (x - 50) * [1, 1000, 0.000001, 1e100][index % 4]!,
        })),
      },
    })),
  }
}

function geometry(chart: Chart) {
  return {
    svgWidth: Number(chart.get('.waveform-chart__svg').attributes('width')),
    leftMargin: Number(chart.get('.waveform-chart').attributes('data-chart-left-margin')),
    tracks: chart.findAll('.waveform-chart__track').map((track) => ({
      left: Number(track.attributes('data-track-left')),
      width: Number(track.attributes('data-track-width')),
      axes: track.findAll('.waveform-track__axis--y').map((axis) => axis.attributes('transform')),
      titles: track
        .findAll('.waveform-chart__y-axis-label')
        .map((title) => title.attributes('transform')),
    })),
  }
}

function expectCompleteAxes(chart: Chart, columns: number) {
  const tracks = chart.findAll('.waveform-chart__track')
  expect(tracks).toHaveLength(columns)
  tracks.forEach((track) => {
    expect(Number(track.attributes('data-track-width'))).toBeGreaterThanOrEqual(120)
    expect(track.findAll('.waveform-track__axis--y')).toHaveLength(4)
    expect(track.findAll('.waveform-chart__y-axis-label')).toHaveLength(4)
    const labels = track.findAll('.waveform-track__axis--y').map((axis) => axis.text())
    expect(labels[0]).not.toMatch(/E[+-]\d+/)
    expect(labels[1]).toMatch(/E\+04/)
    expect(labels[2]).toMatch(/E-05/)
    expect(labels[3]).toMatch(/E\+101/)
  })
}

function overlayBounds(chart: Chart) {
  const overlay = chart.findAll('.waveform-chart__overlay')[0]!
  const width = Number(overlay.attributes('width'))
  const height = Number(overlay.attributes('height'))
  Object.defineProperty(overlay.element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ left: 0, top: 0, width, height }),
  })
  return { overlay, width, height }
}

async function pan(chart: Chart) {
  expect(chart.vm.setInteractionMode('pan').status).toBe('applied')
  await flushPromises()
  const { overlay } = overlayBounds(chart)
  const track = chart.get('.waveform-chart__track')
  const width = Number(track.attributes('data-track-width'))
  const height = Number(track.attributes('data-track-height'))
  for (const [type, ratio] of [
    ['pointerdown', 0.6],
    ['pointermove', 0.3],
    ['pointerup', 0.3],
  ] as const) {
    const event = new MouseEvent(type, {
      button: 0,
      clientX: width * ratio,
      clientY: height / 2,
      bubbles: true,
    })
    Object.defineProperty(event, 'pointerId', { value: 92 })
    overlay.element.dispatchEvent(event)
  }
  flushAnimationFrames()
  await flushPromises()
}

const cases = (['independent', 'separated', 'compact'] as const).flatMap((displayMode) =>
  (['default', 'edge-compact'] as const).flatMap((layoutPreset) =>
    [1, 2].map((columns) => ({ displayMode, layoutPreset, columns, width: columns * 320 })),
  ),
)

describe('horizontal scrolling for narrow multi-axis charts', () => {
  it.each(cases)(
    'retains all axes and useful plot widths in $displayMode/$layoutPreset at $width px',
    async ({ displayMode, layoutPreset, columns, width }) => {
      const chart = await mountSizedChart(fourAxisTracks(columns), {
        width,
        displayMode,
        layoutPreset,
        overlayMode: 'multi-axis',
        grid: { rowCount: 1, columnCount: columns },
        animationEnabled: false,
        pannable: true,
        xDomainStrategy: { type: 'data' },
        axes: { y: { nice: false } },
      })
      document.body.appendChild(chart.element)
      const containerObserver = resizeObservers.at(-1)!
      containerObserver.resize(width, 360)
      await flushPromises()
      try {
        expect(chart.get('.waveform-chart').classes()).toContain('waveform-chart--scrollable')
        expect(getComputedStyle(chart.get('.waveform-chart').element).overflowX).toBe('auto')
        const initial = geometry(chart)
        expect(initial.svgWidth).toBeGreaterThan(width)
        expectCompleteAxes(chart, columns)
        const initialViewport = chart.vm.getControlState().targets.map((target) => target.viewport)
        const initialPaths = chart
          .findAll('.waveform-chart__line')
          .map((line) => line.attributes('d'))

        expect(chart.vm.zoomIn().status).toBe('applied')
        await flushPromises()
        expect(geometry(chart)).toEqual(initial)
        expect(chart.vm.getControlState().targets.map((target) => target.viewport)).not.toEqual(
          initialViewport,
        )
        expect(
          chart.findAll('.waveform-chart__line').map((line) => line.attributes('d')),
        ).not.toEqual(initialPaths)
        const zoomed = chart.vm.getControlState().targets[0]!.viewport.xDomain
        await pan(chart)
        expect(chart.emitted('pan-end')).toHaveLength(1)
        expect(chart.vm.getControlState().targets[0]!.viewport.xDomain).not.toEqual(zoomed)
        expect(geometry(chart)).toEqual(initial)
        chart.vm.resetViewport()
        await flushPromises()
        expect(geometry(chart)).toEqual(initial)
        expect(chart.vm.getControlState().targets.map((target) => target.viewport)).toEqual(
          initialViewport,
        )

        await chart.setProps({ width: 1800 })
        containerObserver.resize(1800, 360)
        await flushPromises()
        expect(chart.get('.waveform-chart').classes()).not.toContain('waveform-chart--scrollable')
        expect(Number(chart.get('.waveform-chart__svg').attributes('width'))).toBe(1800)
        expectCompleteAxes(chart, columns)
      } finally {
        chart.element.remove()
        chart.unmount()
      }
    },
  )

  it('clears stale hover on scroll without changing viewport state or plot geometry', async () => {
    const chart = await mountSizedChart(fourAxisTracks(2), {
      width: 320,
      displayMode: 'independent',
      overlayMode: 'multi-axis',
      grid: { rowCount: 1, columnCount: 1 },
      toolbar: { display: 'always' },
      animationEnabled: false,
      axes: { y: { nice: false } },
    })
    document.body.appendChild(chart.element)
    resizeChart(320, 360)
    await flushPromises()
    try {
      const { overlay, width, height } = overlayBounds(chart)
      overlay.element.dispatchEvent(
        new MouseEvent('pointermove', {
          clientX: width / 2,
          clientY: height / 2,
          bubbles: true,
        }),
      )
      flushAnimationFrames()
      await flushPromises()
      expect(chart.find('.waveform-chart__tooltip').exists()).toBe(true)
      expect(chart.find('.waveform-chart__crosshair').exists()).toBe(true)
      const before = geometry(chart)
      const state = chart.vm.getControlState()
      chart.get('.waveform-chart').element.scrollLeft = 120
      await chart.get('.waveform-chart').trigger('scroll')
      await flushPromises()
      expect(chart.find('.waveform-chart__tooltip').exists()).toBe(false)
      expect(chart.find('.waveform-chart__crosshair').exists()).toBe(false)
      expect(chart.vm.getControlState()).toEqual(state)
      expect(geometry(chart)).toEqual(before)
      expect(chart.find('[role="toolbar"]').exists()).toBe(true)
      expect(chart.find('.waveform-chart__pagination').exists()).toBe(true)
      expect(
        (chart.get('.waveform-chart').element as HTMLElement).style.getPropertyValue(
          '--waveform-scroll-left',
        ),
      ).toBe('120px')
      for (const control of [
        chart.get('[role="toolbar"]'),
        chart.get('.waveform-chart__pagination'),
      ]) {
        expect(getComputedStyle(control.element).transform).toContain('--waveform-scroll-left')
      }
      overlay.element.dispatchEvent(
        new MouseEvent('pointermove', {
          clientX: width / 2,
          clientY: height / 2,
          bubbles: true,
        }),
      )
      flushAnimationFrames()
      await flushPromises()
      const tooltip = chart.get('.waveform-chart__tooltip')
      const tooltipLeft = Number.parseFloat((tooltip.element as HTMLElement).style.left)
      expect(tooltipLeft).toBeCloseTo(before.leftMargin + width / 2 - 120 + 12)
      expect(tooltipLeft).toBeLessThan(320)
      expect(getComputedStyle(tooltip.element).transform).toContain('--waveform-scroll-left')
      expect(chart.vm.getControlState()).toEqual(state)
    } finally {
      chart.element.remove()
      chart.unmount()
    }
  })
})
