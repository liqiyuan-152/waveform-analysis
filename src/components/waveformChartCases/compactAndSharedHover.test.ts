import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { flushAnimationFrames } from '../../test/setup'

import { gridSeries, mountSizedChart } from '../../test/waveformChart'

describe('WaveformChart', () => {
  it('shows Y-axis end values only on the top row in compact mode', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            name: 'top-left',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0.11 },
                { x: 1, y: 0.89 },
              ],
            },
          },
          {
            name: 'top-right',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 1.11 },
                { x: 1, y: 1.89 },
              ],
            },
          },
          {
            name: 'bottom-left',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 2 },
                { x: 1, y: 3 },
              ],
            },
          },
          {
            name: 'bottom-right',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 4 },
                { x: 1, y: 5 },
              ],
            },
          },
        ],
      },
      { displayMode: 'compact', grid: { rowCount: 2, columnCount: 2 } },
    )

    const tracks = wrapper.findAll('.waveform-chart__track')
    const endTicks = tracks.map((track) =>
      track.findAll('.waveform-chart__axis--y .tick').filter((tick) => {
        const match = tick.attributes('transform')?.match(/translate\(0,\s*([\d.]+)\)/)
        return match ? Math.abs(Number(match[1])) <= 1 : false
      }),
    )

    expect(endTicks[0]).toHaveLength(1)
    expect(Number(endTicks[0][0].text())).toBe(0.9)
    expect(endTicks[1]).toHaveLength(1)
    expect(Number(endTicks[1][0].text())).toBe(1.9)
    expect(endTicks[2]).toHaveLength(0)
    expect(endTicks[3]).toHaveLength(0)
  })

  it('prefixes one shared exponent to the largest visible tick on every compact Y axis', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            name: 'large',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 2540 },
              ],
            },
          },
          {
            name: 'tiny',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 0.0002 },
              ],
            },
          },
        ],
      },
      { displayMode: 'compact' },
    )

    const axes = wrapper.findAll('.waveform-chart__axis--y')
    expect(axes).toHaveLength(2)
    axes.forEach((axis, index) => {
      const labels = axis.findAll('.tick text').map((tick) => tick.text())
      const exponentLabels = labels.filter((label) => label.startsWith('E'))
      expect(exponentLabels).toHaveLength(1)
      expect(exponentLabels[0]).toMatch(index === 0 ? /^E\+03 / : /^E-04 /)
    })
    expect(wrapper.find('.waveform-chart__axis-exponent--y').exists()).toBe(false)
  })

  it('prefers a trimmed series name and falls back to yLabel for unnamed data', async () => {
    const namedChart = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            name: '  BT2_2M  ',
            unit: 'T',
            data: { kind: 'points', points: [{ x: 0, y: 1 }] },
          },
        ],
      },
      { yLabel: 'T' },
    )
    const unnamedChart = await mountSizedChart(
      { kind: 'points', points: [{ x: 0, y: 1 }] },
      { yLabel: '自定义幅值' },
    )

    expect(namedChart.get('.waveform-chart__y-axis-label').text()).toBe('BT2_2M')
    expect(unnamedChart.get('.waveform-chart__y-axis-label').text()).toBe('自定义幅值')
  })

  it('synchronizes every channel tooltip in separated mode and preserves the legacy event', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            name: 'BT2_2M',
            unit: 'T',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 1 },
                { x: 1, y: 2 },
              ],
            },
          },
          {
            name: 'BT1_2M',
            unit: 'T',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 3 },
                { x: 1, y: 4 },
              ],
            },
          },
        ],
      },
      { displayMode: 'separated' },
    )
    const overlay = wrapper.get('.waveform-chart__overlay--shared')
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 712, height: 290 }),
    })

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 700, clientY: 120, bubbles: true }),
    )
    flushAnimationFrames()
    await flushPromises()

    const tooltip = wrapper.get('.waveform-chart__tooltip')
    expect(tooltip.text()).toContain('BT2_2M:')
    expect(tooltip.text()).toContain('2 T')
    expect(tooltip.text()).toContain('BT1_2M:')
    expect(tooltip.text()).toContain('4 T')
    const crosshairLines = wrapper.findAll('.waveform-chart__crosshair line')
    expect(crosshairLines).toHaveLength(2)
    crosshairLines.forEach((line) => {
      expect(line.attributes('x1')).toBe(line.attributes('x2'))
      expect(line.attributes('y1')).toBe('0')
    })
    expect(wrapper.find('.waveform-chart__crosshair circle').exists()).toBe(false)
    expect(wrapper.emitted('point-hover')?.at(-1)).toEqual([{ x: 1, y: 2 }])
  })

  it('keeps synchronized hover feedback in compact mode', async () => {
    const wrapper = await mountSizedChart(gridSeries(2), { displayMode: 'compact' })
    const overlay = wrapper.get('.waveform-chart__overlay--shared')
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 712, height: 290 }),
    })

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 700, clientY: 120, bubbles: true }),
    )
    flushAnimationFrames()
    await flushPromises()

    expect(wrapper.findAll('.waveform-chart__crosshair line')).toHaveLength(2)
    expect(wrapper.findAll('.waveform-chart__tooltip-series')).toHaveLength(2)
    expect(wrapper.emitted('point-hover')?.at(-1)).toEqual([{ x: 1, y: 1 }])
  })

  it('keeps separated tracks apart while sharing one x-axis and one interaction layer', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            name: 'A',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 2, y: 1 },
              ],
            },
          },
          {
            name: 'B',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 10 },
                { x: 2, y: 20 },
              ],
            },
          },
        ],
      },
      { displayMode: 'separated' },
    )
    const tracks = wrapper.findAll('.waveform-chart__track')
    const firstTop = Number(tracks[0].attributes('data-track-top'))
    const firstHeight = Number(tracks[0].attributes('data-track-height'))
    const secondTop = Number(tracks[1].attributes('data-track-top'))

    expect(wrapper.findAll('.waveform-chart__svg')).toHaveLength(1)
    expect(wrapper.findAll('.waveform-chart__axis--x')).toHaveLength(1)
    expect(wrapper.findAll('.waveform-chart__axis--y')).toHaveLength(2)
    expect(wrapper.findAll('.waveform-chart__y-axis-label').map((label) => label.text())).toEqual([
      'A',
      'B',
    ])
    expect(wrapper.findAll('.waveform-chart__overlay--shared')).toHaveLength(1)
    expect(secondTop).toBeGreaterThan(firstTop + firstHeight)
  })

  it('joins compact tracks without a gap and keeps only the bottom x-axis', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            name: 'A',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: -1 },
                { x: 1, y: 1 },
              ],
            },
          },
          {
            name: 'B',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 100 },
                { x: 1, y: 200 },
              ],
            },
          },
        ],
      },
      { displayMode: 'compact' },
    )
    const tracks = wrapper.findAll('.waveform-chart__track')
    const firstTop = Number(tracks[0].attributes('data-track-top'))
    const firstHeight = Number(tracks[0].attributes('data-track-height'))
    const secondTop = Number(tracks[1].attributes('data-track-top'))

    expect(wrapper.attributes('data-display-mode')).toBe('compact')
    expect(wrapper.findAll('.waveform-chart__axis--x')).toHaveLength(1)
    expect(wrapper.findAll('.waveform-chart__y-axis-label').map((label) => label.text())).toEqual([
      'A',
      'B',
    ])
    expect(secondTop).toBeCloseTo(firstTop + firstHeight, 6)
    expect(wrapper.findAll('.waveform-chart__axis--y')[0].text()).not.toBe(
      wrapper.findAll('.waveform-chart__axis--y')[1].text(),
    )
  })
})
