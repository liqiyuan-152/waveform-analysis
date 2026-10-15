import { describe, expect, it } from 'vitest'
import { WaveformDataManager } from '@/data/WaveformDataManager'
import { normalizeWaveformSeries } from '@/core/data'
import type { WaveformData } from '@/types'

const input = (empty = false, trackId = 'frame'): WaveformData => ({
  kind: 'series',
  series: [
    {
      id: 'channel',
      trackId,
      name: 'Channel',
      data: {
        kind: 'points',
        points: empty
          ? []
          : [
              { x: 10, y: 100 },
              { x: 20, y: 200 },
            ],
      },
    },
  ],
})

describe('empty series coordinate domains', () => {
  it('retains domains but never sources across repeated empty windows', () => {
    const manager = new WaveformDataManager()
    manager.commit(manager.prepare(input(), true))
    const original = manager.series[0]
    for (let i = 0; i < 2; i++) {
      const data = input(true)
      manager.commit(manager.prepare(data, true))
      expect(manager.series[0].xDomain).toEqual(original.xDomain)
      expect(manager.series[0].yDomain).toEqual(original.yDomain)
      expect(manager.series[0].source.length).toBe(0)
      expect(manager.series[0].points).toHaveLength(0)
      expect(manager.series[0].hasErrorPoints).toBe(false)
      expect(normalizeWaveformSeries(data)).toEqual([])
    }
  })

  it.each(['remove', 'move'] as const)('does not retain domains after %s', (action) => {
    const manager = new WaveformDataManager()
    manager.commit(manager.prepare(input(), true))
    if (action === 'remove') {
      manager.commit(manager.prepare({ kind: 'series', series: [] }, true))
      expect(manager.series).toEqual([])
    }
    manager.commit(manager.prepare(input(true, action === 'move' ? 'other' : 'frame'), true))
    expect(manager.series[0].xDomain).toEqual([0, 1])
    expect(manager.series[0].yDomain).toEqual([0, 1])
  })
})
