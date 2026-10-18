// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { Waveform } from '../../../src/display/index'

const charts: Waveform[] = []
afterEach(() => {
  charts.forEach((chart) => chart.destroy())
  charts.length = 0
  document.body.replaceChildren()
})

describe('public update compatibility', () => {
  it('merges nested fields, replaces axis arrays, clears padding and exports synchronously', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const chart = new Waveform(
      host,
      [
        {
          id: 'a',
          data: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        },
        {
          id: 'b',
          data: [
            { x: 0, y: 1 },
            { x: 1, y: 2 },
          ],
        },
      ],
      {
        width: 800,
        height: 320,
        responsive: { enabled: false },
        layout: { autoPadding: false, horizontalPadding: { left: 120 } },
        padding: { left: 20, right: 20 },
        title: { visible: true, text: 'Before', color: '#123456' },
        yAxes: [
          { id: 'a', position: 'left' },
          { id: 'b', position: 'right' },
        ],
      },
    )
    charts.push(chart)
    host.querySelector<SVGGElement>('.waveform-legend-item')!.dispatchEvent(new MouseEvent('click'))
    chart.updateOptions({
      title: { text: 'After' },
      yAxes: [{ id: 'replacement', position: 'right' }],
      layout: { horizontalPadding: undefined },
    })
    const source = chart.toSVGString()
    expect(source).toContain('After')
    expect(source).not.toContain('Before')
    expect(source).toContain('#123456')
    expect(host.querySelector('svg > g')?.getAttribute('transform')).toMatch(/^translate\(20,/)
    expect(host.querySelectorAll('.waveform-axis-y')).toHaveLength(1)
    expect(host.querySelector('.waveform-axis-y')?.getAttribute('data-axis-id')).toBe('replacement')
    expect(host.querySelector('.waveform-legend-item')?.getAttribute('aria-pressed')).toBe('false')
    chart.updateData([])
    expect(chart.toSVGString()).toContain('No waveform data')
    expect(host.querySelector('.waveform-legend')).toBeNull()
  })
})
