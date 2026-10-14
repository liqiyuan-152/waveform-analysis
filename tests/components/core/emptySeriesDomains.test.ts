import { effectScope, nextTick, shallowRef } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { usePreparedWaveformSeries } from '@/components/core/useWaveformData'
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
  it('preserves only domains across repeated empty windows while replacing point sources', async () => {
    const scope = effectScope()
    try {
      const data = shallowRef(input())
      const before = vi.fn()
      const changed = vi.fn()
      const series = scope.run(() =>
        usePreparedWaveformSeries(
          () => data.value,
          before,
          changed,
          () => true,
        ),
      )!
      const original = series.value[0]
      for (let step = 0; step < 2; step++) {
        data.value = input(true)
        await nextTick()
        expect(series.value[0].xDomain).toEqual(original.xDomain)
        expect(series.value[0].yDomain).toEqual(original.yDomain)
        expect(series.value[0].points).toHaveLength(0)
        expect(series.value[0].source.length).toBe(0)
        expect(series.value[0].hasErrorPoints).toBe(false)
      }
      expect(before).toHaveBeenCalledTimes(2)
      expect(changed).toHaveBeenCalledTimes(2)
      expect(normalizeWaveformSeries(data.value)).toEqual([])
    } finally {
      scope.stop()
    }
  })

  it.each(['remove', 'move'] as const)(
    'does not carry domains across an explicit %s',
    async (action) => {
      const scope = effectScope()
      try {
        const data = shallowRef(input())
        const series = scope.run(() =>
          usePreparedWaveformSeries(
            () => data.value,
            () => {},
            () => {},
            () => true,
          ),
        )!
        if (action === 'remove') {
          data.value = { kind: 'series', series: [] }
          await nextTick()
          expect(series.value).toEqual([])
        }
        data.value = input(true, action === 'move' ? 'other-frame' : 'frame')
        await nextTick()
        expect(series.value[0].xDomain).toEqual([0, 1])
        expect(series.value[0].yDomain).toEqual([0, 1])
      } finally {
        scope.stop()
      }
    },
  )
})
