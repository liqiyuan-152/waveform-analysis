// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Waveform } from '../../../src/display/index'
import { SvgRenderer } from '../../../src/display/renderer/SvgRenderer'

const charts: Waveform[] = []
afterEach(() => {
  charts.splice(0).forEach((chart) => chart.destroy())
  vi.restoreAllMocks()
})
function create(options = {}) {
  const host = document.createElement('div')
  const chart = new Waveform(
    host,
    [
      { x: 0, y: 1 },
      { x: 1, y: 2 },
    ],
    options,
  )
  charts.push(chart)
  return { host, chart }
}

describe('atomic updates and persistent rendering', () => {
  it('draws a joint commit once, ignores empty updates and exports new target synchronously', () => {
    const { chart, host } = create()
    const draw = vi.spyOn(SvgRenderer.prototype, 'draw')
    chart.update({
      data: [{ x: 0, y: 7 }],
      options: { title: { visible: true, text: 'Joint' }, yAxis: { min: 0, max: 10 } },
    })
    expect(draw).toHaveBeenCalledTimes(1)
    expect(chart.toSVGString()).toContain('Joint')
    expect(host.querySelector('.waveform-axis-y-end-value')?.textContent).toBe('10')
    chart.update({})
    chart.update({ data: undefined, options: undefined })
    expect(draw).toHaveBeenCalledTimes(1)
    chart.update({ data: [] })
    expect(chart.toSVGString()).toContain('No waveform data')
  })

  it('retains root, plot, axis and series nodes through repeated updates with bounded node counts', () => {
    const { chart, host } = create({ yAxis: { min: 0, max: 3 } })
    const root = host.querySelector('svg'),
      plot = host.querySelector('svg > g')
    const axis = host.querySelector('.waveform-axis-y'),
      path = host.querySelector('g[clip-path] > path')
    const count = host.querySelectorAll('*').length
    for (let index = 0; index < 20; index++)
      chart.updateData([
        { x: 0, y: 1 },
        { x: 1, y: 2 + index / 100 },
      ])
    expect(host.querySelector('svg')).toBe(root)
    expect(host.querySelector('svg > g')).toBe(plot)
    expect(host.querySelector('.waveform-axis-y')).toBe(axis)
    expect(host.querySelector('g[clip-path] > path')).toBe(path)
    expect(host.querySelectorAll('*').length).toBe(count)
    chart.updateData([])
    chart.updateData([{ x: 0, y: 1 }])
    expect(host.querySelector('svg')).toBe(root)
    expect(host.querySelectorAll('clipPath')).toHaveLength(1)
  })

  it('applies existing responsive precedence, fixed width and zero-size fallbacks synchronously', () => {
    const { chart, host } = create({
      responsive: { enabled: true, aspectRatio: 2, minHeight: 0, maxHeight: 1000 },
      height: 100,
    })
    expect(host.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 800 400')
    Object.defineProperty(host, 'clientWidth', { value: 600, configurable: true })
    chart.resize()
    expect(host.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 600 300')
    chart.updateOptions({ width: 500 })
    expect(host.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 500 100')
    const fallback = create({ responsive: { enabled: false }, height: '100%' })
    expect(fallback.host.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 800 320')
    expect(() => fallback.chart.updateOptions({ height: 'auto' })).toThrow('height')
  })
})
