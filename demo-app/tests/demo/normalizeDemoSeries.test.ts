import { describe, expect, it } from 'vitest'
import { normalizeDemoSeries } from '@demo/demo/normalizeDemoSeries'
import { selectWaveformWindow } from '@demo/demo/remoteWaveformLoader'

describe('public normalization in the mock remote loader', () => {
  it('keeps empty channel identities and duplicate ID allocation without leaking sentinel points', () => {
    const data = {
      kind: 'series' as const,
      series: [
        { id: ' channel ', name: 'empty', data: { kind: 'points' as const, points: [] } },
        {
          id: 'channel',
          name: 'signal',
          data: { kind: 'samples' as const, values: [2, 3], sampleRate: 2 },
        },
      ],
    }
    const series = normalizeDemoSeries(data)
    expect(series.map((item) => item.id)).toEqual(['channel', 'channel-1'])
    expect(series[0]!.points).toEqual([])
    expect(series[1]!.points).toEqual([
      { x: 0, y: 2 },
      { x: 0.5, y: 3 },
    ])
    const window = selectWaveformWindow(data, { start: 0.5, end: 0.5 })
    expect(window.kind).toBe('series')
    if (window.kind !== 'series') throw new Error('Expected series response')
    expect(window.series.map((item) => item.data)).toEqual([
      { kind: 'points', points: [] },
      { kind: 'points', points: [{ x: 0.5, y: 3 }] },
    ])
    expect(data.series[0]!.data).toEqual({ kind: 'points', points: [] })
  })
})
