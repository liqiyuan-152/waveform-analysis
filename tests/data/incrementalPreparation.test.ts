import { describe, expect, it } from 'vitest'
import { WaveformDataManager } from '@/data/WaveformDataManager'
import type { SingleWaveformData, WaveformSeries } from '@/types/data'

const points = (y: number): SingleWaveformData => ({
  kind: 'points',
  points: [
    { x: 0, y },
    { x: 1, y: 2 },
  ],
})
const series = (id: string, y = 1): WaveformSeries => ({ id, name: id, data: points(y) })
function update(manager: WaveformDataManager, series: WaveformSeries[]) {
  const candidate = manager.prepare({ kind: 'series', series }, true)
  manager.commit(candidate)
  return manager.series
}

describe('bounded preparation by normalized ID and immutable child reference', () => {
  it('reuses untouched series, refreshes same-ID replacements and keeps input immutable', () => {
    const manager = new WaveformDataManager()
    const a = series('a'),
      b = series('b')
    const original = structuredClone([a, b])
    const first = update(manager, [a, b])
    const second = update(manager, [series('a', 99), b])
    expect(second[0]?.source).not.toBe(first[0]?.source)
    expect(second[0]?.rawYMaximum).toBe(99)
    expect(second[1]).toBe(first[1])
    expect([a, b]).toEqual(original)
    const reordered = update(manager, [b, a])
    expect(reordered[0]).toBe(first[1])
    expect(reordered.map((item) => item.id)).toEqual(['b', 'a'])
    const removed = update(manager, [b])
    expect(removed).toEqual([first[1]])
    const readded = update(manager, [a, b])
    expect(readded[0]?.source).not.toBe(reordered[1]?.source)
    expect(readded[1]).toBe(first[1])
  })

  it('recomposes metadata and refreshes full error extrema when visibility changes', () => {
    const manager = new WaveformDataManager()
    const a = {
      ...series('a'),
      data: { kind: 'points' as const, points: [{ x: 0, y: 5, upperError: 20 }] },
    }
    const first = update(manager, [a])[0]!
    const next = update(manager, [
      { ...a, name: 'new', color: 'red', errorBar: { visible: true } },
    ])[0]!
    expect(next.source).toBe(first.source)
    expect(next.name).toBe('new')
    expect(next.rawYMaximum).toBe(25)
    const hidden = update(manager, [{ ...a, errorBar: { visible: false } }])[0]!
    expect(hidden.rawYMaximum).toBe(5)
    const metadata = update(manager, [{ ...a, trackId: 'group', lineStyle: 'dashed' }])[0]!
    expect(metadata.source).toBe(first.source)
    expect(metadata.trackId).toBe('group')
  })

  it('preserves duplicate-ID and empty-track rules and only retains current inputs', () => {
    const manager = new WaveformDataManager()
    const a = series('a', 10),
      b = series('a', 20)
    const first = update(manager, [a, b])
    const next = update(manager, [a, b])
    expect(next.map((item) => item.id)).toEqual(['a', 'a-1'])
    expect(next[0]).toBe(first[0])
    expect(next[1]).toBe(first[1])
    const empty: WaveformSeries = { ...a, data: { kind: 'points', points: [] } }
    const retained = update(manager, [empty])[0]!
    expect(retained.yDomain).toEqual(first[0]!.yDomain)
    const newTrack = update(manager, [{ ...empty, trackId: 'new' }])[0]!
    expect(newTrack.yDomain).not.toEqual(retained.yDomain)
    const candidate = manager.prepare({ kind: 'series', series: [] }, true)
    expect(candidate.inputs.size).toBe(0)
    manager.commit(candidate)
    expect(manager.series).toEqual([])
  })
})
