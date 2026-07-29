import { describe, expect, it } from 'vitest'

import type { DisplayTrack } from './types'
import { hasFixedYDomainForTrack, mergeYDomains, normalizeYDomain } from './yDomain'

const track: DisplayTrack = {
  id: 'shared-track',
  series: [],
  visibleSeries: [
    {
      id: 'channel-a',
      name: 'A',
      color: '#1677ff',
      lineType: 'linear',
      lineStyle: 'solid',
      pointType: 'none',
      errorBar: { visible: false, width: 1.5, capWidth: 8 },
      points: [],
      xDomain: [0, 1],
      yDomain: [0, 1],
      hasErrorPoints: false,
    },
  ],
  xDomain: [0, 1],
  yDomain: [0, 1],
}

describe('fixed Y domains', () => {
  it('normalizes valid reversed domains', () => {
    expect(normalizeYDomain([97, 3])).toEqual([3, 97])
    expect(normalizeYDomain([-10, 10])).toEqual([-10, 10])
  })

  it.each([undefined, [1, 1], [Number.NaN, 1], [0, Number.POSITIVE_INFINITY]])(
    'rejects an invalid domain: %j',
    (domain) => {
      expect(normalizeYDomain(domain as [number, number] | undefined)).toBeUndefined()
    },
  )

  it('detects valid track, series, and global configuration only', () => {
    expect(hasFixedYDomainForTrack(track, [-1, 1])).toBe(true)
    expect(hasFixedYDomainForTrack(track, undefined, { 'shared-track': [-2, 2] })).toBe(true)
    expect(hasFixedYDomainForTrack(track, undefined, { 'channel-a': [-3, 3] })).toBe(true)
    expect(hasFixedYDomainForTrack(track, [0, 0], { 'channel-a': [1, 1] })).toBe(false)
  })

  it('merges configured and automatic series domains without padding', () => {
    expect(
      mergeYDomains([
        [3, 97],
        [-20, 40],
      ]),
    ).toEqual([-20, 97])
  })
})
