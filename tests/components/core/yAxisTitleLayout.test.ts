import { scaleLinear } from 'd3'
import { describe, expect, it } from 'vitest'

import { alignLeftYAxisTitles } from '@/components/core/yAxisTitleLayout'
import { formatYAxisTickLayoutLabel } from '@/components/core/layout'
import { measureYAxisTextWidth } from '@/components/core/yAxisTextWidth'
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

function expectTickClearance(yAxis: WaveformYAxisLayout, unit = yAxis.seriesList[0]?.unit) {
  const titleRight = yAxis.labelX + 10
  yAxis.tickValues.forEach((value) => {
    const label = formatYAxisTickLayoutLabel(
      value,
      yAxis.scale.domain() as [number, number],
      yAxis.tickValues,
      unit,
    )
    expect(yAxis.x - 7 - measureYAxisTextWidth(label) - titleRight).toBeGreaterThanOrEqual(2)
  })
}

describe('channel name clearance', () => {
  it('clears the scientific mantissa beside a full-height channel name', () => {
    const long = track(axis('A_VERY_LONG_CHANNEL_NAME_THAT_REACHES_THE_TOP', 'V'))
    const yAxis = long.yAxes[0]
    yAxis.scale.domain([0, 30000])
    yAxis.tickValues = [0, 7500, 15000, 22500, 30000]
    yAxis.labelX = -73
    alignLeftYAxisTitles([long], undefined, { compact: true })
    expectTickClearance(yAxis)
  })

  it('measures only rendered units when positioning a compact name', () => {
    const hiddenUnit = track(axis('A_LONG_CHANNEL_NAME', 'VERY-LONG-HIDDEN-UNIT'))
    const noUnit = track(axis('A_LONG_CHANNEL_NAME', ''))
    alignLeftYAxisTitles([hiddenUnit], undefined, { compact: true, showUnits: false })
    alignLeftYAxisTitles([noUnit], undefined, { compact: true, showUnits: false })
    expect(hiddenUnit.yAxes[0].labelX).toBe(noUnit.yAxes[0].labelX)
  })

  it('reserves the widest top unit label even outside the rotated short name', () => {
    const normal = track()
    const wideUnit = track(axis('SX2_7_02', 'VERY-LONG-UNIT'))
    alignLeftYAxisTitles([normal, wideUnit])
    expect(normal.yAxes[0].labelX).toBeLessThan(-100)
    expect(wideUnit.yAxes[0].labelX).toBe(normal.yAxes[0].labelX)
  })

  it('does not depend on the channel name length', () => {
    const normal = track()
    const long = track(axis('SX2_7_02_LONG_CHANNEL_NAME', 'VERY-LONG-UNIT'))
    alignLeftYAxisTitles([normal, long])
    expect(long.yAxes[0].labelX).toBeLessThan(-100)
    expect(normal.yAxes[0].labelX).toBe(long.yAxes[0].labelX)
  })

  it('reserves complete tick labels outside the name height', () => {
    const nearby = track(axis('ABCD', 'WIDE-UNIT'))
    nearby.yAxes[0].scale.domain([0, 200])
    nearby.yAxes[0].tickValues = [0, 123]
    alignLeftYAxisTitles([nearby])
    expectTickClearance(nearby.yAxes[0])
  })

  it('includes endpoint labels with fallback names', () => {
    const short = track(axis(''))
    short.yAxes[0].scale.domain([0, 200])
    short.yAxes[0].tickValues = [79, 200]
    alignLeftYAxisTitles([short], 'ABCD')
    expectTickClearance(short.yAxes[0])
  })

  it('keeps the longest extrema clearance when the frame height changes', () => {
    const tall = track(axis('SX2_7_01', ''))
    tall.height = 1000
    tall.yAxes[0].scale.domain([-0.2, 0.8]).range([1000, 0])
    tall.yAxes[0].tickValues = [-0.2, 0, 0.2, 0.4, 0.6, 0.7384, 0.8]
    const short = track(axis('SX2_7_01', ''))
    short.yAxes[0].scale.domain([-0.2, 0.8])
    short.yAxes[0].tickValues = [...tall.yAxes[0].tickValues]
    alignLeftYAxisTitles([tall])
    alignLeftYAxisTitles([short])
    expectTickClearance(tall.yAxes[0])
    expect(short.yAxes[0].labelX).toBe(tall.yAxes[0].labelX)
  })

  it.each([30000, 0.0003, 1e120, 1e-120])(
    'keeps title positions stable while excluding the exponent for range maximum %s',
    (maximum) => {
      const decimal = track(axis('SHORT', ''))
      const scientific = track(axis('SHORT', ''))
      decimal.yAxes[0].scale.domain([0, 3])
      decimal.yAxes[0].tickValues = [0, 0.75, 1.5, 2.25, 3]
      scientific.yAxes[0].scale.domain([0, maximum])
      scientific.yAxes[0].tickValues = [0, maximum / 4, maximum / 2, maximum * 0.75, maximum]
      alignLeftYAxisTitles([decimal])
      alignLeftYAxisTitles([scientific])
      expect(scientific.yAxes[0].labelX).toBe(decimal.yAxes[0].labelX)
      expectTickClearance(decimal.yAxes[0])
      expectTickClearance(scientific.yAxes[0])
    },
  )

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
