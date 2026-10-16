import { describe, expect, it } from 'vitest'
import { mergeWaveformWindow } from '@demo/demo/remoteWaveformLoader'
import type { WaveformData, WaveformSeries } from '@/types'

const channel = (id: string): WaveformSeries => ({
  id,
  name: id,
  trackId: `track-${id}`,
  unit: 'V',
  color: '#123456',
  data: { kind: 'points', points: [{ x: 10, y: 100 }] },
})
const record = { kind: 'series' as const, series: ['a', 'b'].map(channel) }

describe('window response series merge', () => {
  it.each([undefined, ['a', 'b']])(
    'fills omitted channels and appends new channels (%s)',
    (seriesIds) => {
      const response = { kind: 'series' as const, series: ['b', 'd', 'c'].map(channel) }
      const merged = mergeWaveformWindow(record, response, seriesIds)
      expect(merged).toEqual({
        kind: 'series',
        series: [{ ...record.series[0], data: { kind: 'points', points: [] } }, ...response.series],
      })
      expect(record.series[0].data).toEqual({ kind: 'points', points: [{ x: 10, y: 100 }] })
    },
  )

  it('clears only requested missing channels instead of displaying cached samples', () => {
    expect(mergeWaveformWindow(record, { kind: 'series', series: [] }, ['a'])).toEqual({
      kind: 'series',
      series: [{ ...record.series[0], data: { kind: 'points', points: [] } }, record.series[1]],
    })
  })

  it('clears all channel samples for an empty shared response', () => {
    expect(mergeWaveformWindow(record, { kind: 'series', series: [] })).toEqual({
      kind: 'series',
      series: record.series.map((series) => ({ ...series, data: { kind: 'points', points: [] } })),
    })
  })

  it('does not update known channels outside the independent request', () => {
    const response = { kind: 'series' as const, series: [channel('b'), channel('c')] }
    expect(mergeWaveformWindow(record, response, ['a'])).toEqual({
      kind: 'series',
      series: [
        { ...record.series[0], data: { kind: 'points', points: [] } },
        record.series[1],
        channel('c'),
      ],
    })
  })

  it('continues replacing single-waveform responses', () => {
    const response: WaveformData = { kind: 'points', points: [] }
    expect(mergeWaveformWindow(record.series[0].data, response)).toBe(response)
  })
})
