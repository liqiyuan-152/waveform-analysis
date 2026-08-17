import { describe, expect, it } from 'vitest'

import { channelColors } from './constants'

describe('channelColors', () => {
  it('contains the referenced dark palette followed by twenty supplemental colors', () => {
    expect(channelColors).toHaveLength(30)
    expect(channelColors.slice(0, 10)).toEqual([
      '#0960bd',
      '#ff7f0e',
      '#2ca02c',
      '#d62728',
      '#9467bd',
      '#8c564b',
      '#e377c2',
      '#7f7f7f',
      '#bcbd22',
      '#17becf',
    ])
    expect(new Set(channelColors).size).toBe(channelColors.length)
  })

  it('wraps around after the thirtieth color for automatic series assignment', () => {
    expect(channelColors[0]).toBe('#0960bd')
    expect(channelColors[29]).toBe('#31572c')
    expect(channelColors[30 % channelColors.length]).toBe(channelColors[0])
    expect(channelColors[31 % channelColors.length]).toBe(channelColors[1])
  })
})
