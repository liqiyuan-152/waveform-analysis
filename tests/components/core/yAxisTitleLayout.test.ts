import { scaleLinear } from 'd3'
import { describe, expect, it } from 'vitest'

import { alignLeftYAxisTitles } from '@/components/core/yAxisTitleLayout'
import type { DisplaySeries, WaveformYAxisLayout } from '@/components/core/types'

function axis(name = 'SX2_7_02', unit = 'V'): WaveformYAxisLayout {
  const series: DisplaySeries = {
    id: name,
    name,
    unit,
    color: '#1677ff',
    lineType: 'linear',
    lineStyle: 'solid',
    pointType: 'none',
    errorBar: { visible: false, width: 1, capWidth: 8 },
    points: [],
    xDomain: [0, 1],
    yDomain: [-0.0014, 1.2083],
    hasErrorPoints: false,
  }
  return {
    index: 0,
    side: 'left',
    x: 0,
    labelX: -100,
    scale: scaleLinear([-0.0014, 1.2083], [200, 0]),
    majorTicks: [],
    minorTicks: [],
    tickValues: [-0.0014, 0.3011, 0.6035, 0.9059],
    seriesList: [series],
  }
}

function track(yAxis = axis(), column = 0) {
  return { height: 200, column, yAxes: [yAxis] }
}

describe('channel name clearance', () => {
  it('excludes a compact-row top unit label outside the rotated short name', () => {
    const normal = track()
    const wideUnit = track(axis('SX2_7_02', 'VERY-LONG-UNIT'))
    alignLeftYAxisTitles([normal, wideUnit])
    expect(normal.yAxes[0].labelX).toBe(-59)
    expect(wideUnit.yAxes[0].labelX).toBe(-59)
  })

  it('includes the wide unit label when a long name actually reaches it', () => {
    const normal = track()
    const long = track(axis('SX2_7_02_LONG_CHANNEL_NAME', 'VERY-LONG-UNIT'))
    alignLeftYAxisTitles([normal, long])
    expect(long.yAxes[0].labelX).toBeLessThan(-100)
    expect(normal.yAxes[0].labelX).toBe(long.yAxes[0].labelX)
  })

  it('accounts for the tick glyph height even when its center is outside the name', () => {
    const nearby = track(axis('ABCD', 'WIDE-UNIT'))
    nearby.yAxes[0].scale.domain([0, 200])
    nearby.yAxes[0].tickValues = [0, 123]
    alignLeftYAxisTitles([nearby])
    expect(nearby.yAxes[0].labelX).toBeLessThan(-59)
  })

  it('handles bottom-aligned tick text and fallback names', () => {
    const short = track(axis(''))
    short.yAxes[0].scale.domain([0, 200])
    short.yAxes[0].tickValues = [79, 200]
    alignLeftYAxisTitles([short], 'ABCD')
    expect(short.yAxes[0].labelX).toBe(-31)
  })

  it('keeps each column and left-axis slot independent and preserves right-axis positions', () => {
    const first = track()
    const second = track(axis('LONG_CHANNEL_NAME', 'VERY-LONG-UNIT'))
    const otherColumn = track(axis(), 1)
    const extraLeft = axis('EXTRA_LONG_CHANNEL_NAME', 'LARGE-UNIT')
    extraLeft.x = -140
    const right = axis()
    right.side = 'right'
    right.labelX = 650
    first.yAxes.push(extraLeft, right)
    const extraSecond = axis()
    extraSecond.x = -140
    second.yAxes.push(extraSecond)
    alignLeftYAxisTitles([first, second, otherColumn])
    expect(first.yAxes[0].labelX).toBe(second.yAxes[0].labelX)
    expect(first.yAxes[0].labelX).toBeLessThan(otherColumn.yAxes[0].labelX)
    expect(extraLeft.labelX).toBe(extraSecond.labelX)
    expect(right.labelX).toBe(650)
  })
})
