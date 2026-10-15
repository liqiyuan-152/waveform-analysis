import { describe, expect, it, vi } from 'vitest'
import { ChartModel } from '@/model/ChartModel'
import { ChartLayoutEngine } from '@/layout/ChartLayoutEngine'
import type { WaveformData } from '@/types/data'

const data: WaveformData = {
  kind: 'series',
  series: [
    {
      id: 'a',
      trackId: 'track',
      name: 'A',
      data: {
        kind: 'points',
        points: [
          { x: 0.123, y: -2 },
          { x: 2.456, y: 3 },
        ],
      },
    },
    {
      id: 'b',
      trackId: 'track',
      name: 'B',
      data: {
        kind: 'points',
        points: [
          { x: 0, y: -100 },
          { x: 3, y: 100 },
        ],
      },
    },
    {
      id: 'c',
      name: 'C',
      data: {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 3, y: 1 },
        ],
      },
    },
  ],
}

describe('native chart layout', () => {
  it('prepares sampling domains without materializing points or SVG paths', () => {
    const model = new ChartModel({ data, rendering: { sampling: { mode: 'raw' } } })
    const engine = new ChartLayoutEngine(model)
    const reads = model.data.series.map((series) => vi.spyOn(series.source, 'pointsInRange'))
    const sampling = engine.calculate(800, 400, 0, undefined, false)
    expect(sampling.geometryReady).toBe(false)
    expect(sampling.trackLayouts.length).toBeGreaterThan(0)
    expect(sampling.trackLayouts[0]!.seriesPaths[0]!.path).toBeNull()
    expect(sampling.trackLayouts[0]!.seriesPaths[0]!.lineRenderPoints).toEqual([])
    reads.forEach((read) => expect(read).not.toHaveBeenCalled())
    const rendered = engine.calculate(800, 400)
    expect(rendered.geometryReady).toBe(true)
    expect(rendered.trackLayouts[0]!.seriesPaths[0]!.path).toBeTruthy()
    expect(rendered.trackLayouts.map((track) => track.xScale.domain())).toEqual(
      sampling.trackLayouts.map((track) => track.xScale.domain()),
    )
    expect(rendered.trackLayouts.map((track) => [track.width, track.height])).toEqual(
      sampling.trackLayouts.map((track) => [track.width, track.height]),
    )
    expect(
      rendered.trackLayouts.map((track) => track.seriesPaths.map((path) => path.yScale.domain())),
    ).toEqual(
      sampling.trackLayouts.map((track) => track.seriesPaths.map((path) => path.yScale.domain())),
    )
  })

  it('handles empty, invalid and zero-size data without non-finite geometry', () => {
    const empty = new ChartLayoutEngine(new ChartModel())
    expect(empty.calculate(800, 400).trackLayouts[0].series?.source?.length).toBe(0)
    const invalid = new ChartLayoutEngine(
      new ChartModel({ data: { kind: 'points', points: [{ x: NaN, y: 1 }] } }),
    )
    expect(invalid.calculate(800, 400).trackLayouts[0].series?.source?.length).toBe(0)
    const layout = new ChartLayoutEngine(new ChartModel({ data }))
    expect(layout.calculate(0, 0).trackLayouts).toEqual([])
    expect(
      layout
        .calculate(360, 400)
        .trackLayouts.every((track) => Number.isFinite(track.width) && track.width > 0),
    ).toBe(true)
  })

  it('groups stable tracks and preserves ordered empty slots with pagination', () => {
    const model = new ChartModel({
      data,
      grid: { trackOrder: ['c', 'missing', 'track'], rowCount: 1, columnCount: 1 },
    })
    const engine = new ChartLayoutEngine(model)
    const first = engine.calculate(800, 400)
    expect(first.tracks.map((track) => track.id)).toEqual(['c', 'missing', 'track'])
    expect(first.pageCount).toBe(3)
    model.presentation.setPage(3, 3)
    expect(
      engine.calculate(800, 400).trackLayouts[0]?.seriesList.map((series) => series.id),
    ).toEqual(['a', 'b'])
    model.setOption({ grid: { rowCount: 1, columnCount: 1, hideEmptyTracks: true } })
    const next = engine.calculate(800, 400)
    expect(next.pageCount).toBe(2)
    expect(model.presentation.page).toBe(2)
  })

  it('retains full-data domains and Y limits while separating multi-axis geometry', () => {
    const model = new ChartModel({
      data,
      overlayMode: 'multi-axis',
      yDomains: { a: [-4, 4], b: [-200, 200] },
    })
    const layout = new ChartLayoutEngine(model).calculate(800, 400)
    const track = layout.trackLayouts[0]!
    expect(track.yAxes).toHaveLength(2)
    expect(track.seriesPaths.map((path) => path.yScale.domain())).toEqual([
      [-4, 4],
      [-200, 200],
    ])
    expect(track.xScale.domain()).toEqual([0, 3])
  })

  it('changes displayed labels without changing raw X or an existing viewport', () => {
    const model = new ChartModel({ data, integerZoom: true })
    const engine = new ChartLayoutEngine(model)
    model.viewport.set('track', { xDomain: [0.125, 0.875], yDomains: {} })
    const before = engine.calculate(800, 400).trackLayouts[0]!
    model.setOption({ timeUnit: 's' })
    const after = engine.calculate(800, 400).trackLayouts[0]!
    expect(after.xScale.domain()).toEqual(before.xScale.domain())
    expect(before.endpointLabels.start).toBe('125')
    expect(after.endpointLabels.start).toBe('0.125')
    expect(model.query.nearestPoint('a', 0.123)?.x).toBe(0.123)
  })
})
