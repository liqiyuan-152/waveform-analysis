// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { Waveform, type WaveformOptions } from '../../../src/display/index'

const charts: Waveform[] = []
afterEach(() => {
  charts.splice(0).forEach((chart) => chart.destroy())
})
function create(options: WaveformOptions) {
  const host = document.createElement('div')
  const chart = new Waveform(
    host,
    [
      { x: 0, y: 1.3 },
      { x: 14, y: 8.7 },
    ],
    {
      width: 800,
      height: 320,
      responsive: { enabled: false },
      ...options,
    },
  )
  charts.push(chart)
  return { host, chart }
}
const values = (host: HTMLElement, selector: string) =>
  Array.from(
    host.querySelectorAll(selector),
    (node) => (node as Element & { __data__: number }).__data__,
  )

describe('shared tick layouts', () => {
  it('shares nice X and Y main ticks with grids', () => {
    const { host } = create({
      xAxis: { tickStrategy: 'nice', tickCount: 5 },
      yAxis: { tickStrategy: 'nice', tickCount: 5 },
    })
    expect(values(host, '.waveform-grid-x .tick')).toEqual([0, 3, 6, 9, 12])
    expect(values(host, '.waveform-grid-y .tick')).toEqual([0, 2, 4, 6, 8, 10])
    expect(values(host, '.waveform-axis-y .tick')).toEqual(values(host, '.waveform-grid-y .tick'))
  })

  it('preserves fixed Y bounds and gives explicit X tickStep precedence', () => {
    const { host } = create({
      xAxis: { tickStrategy: 'nice', tickCount: 5, tickStep: 2, minInterval: 10 },
      yAxis: { tickStrategy: 'nice', tickCount: 5, min: 1.3, max: 8.7 },
    })
    expect(values(host, '.waveform-grid-y .tick')).toEqual([2, 4, 6, 8])
    expect(values(host, '.waveform-grid-x .tick')).toEqual([0, 2, 4, 6, 8, 10, 12, 14])
  })

  it('renders zero for reversed nice domains and preserves equal-bound fallback', () => {
    const { host, chart } = create({ yAxis: { tickStrategy: 'nice', min: 3, max: -3 } })
    expect(host.querySelector('.waveform-zero-line')).not.toBeNull()
    expect(values(host, '.waveform-grid-y .tick')).toEqual([3, 2, 1, 0, -1, -2, -3])
    chart.updateOptions({ yAxis: { min: 2, max: 2 } })
    expect(values(host, '.waveform-grid-y .tick')[0]).toBe(1)
    expect(values(host, '.waveform-grid-y .tick').slice(-1)).toEqual([3])
  })

  it('falls back for invalid strategy/count/minInterval inputs', () => {
    const { chart } = create({
      xAxis: { tickStrategy: 'invalid' as 'nice', tickCount: NaN, minInterval: -1 },
    })
    expect(chart.getOptions().xAxis).toMatchObject({
      tickStrategy: 'legacy',
      tickCount: 8,
      minInterval: 0,
    })
  })
})

it('hides colliding and duplicate nice labels without deleting grid values and recovers on resize', () => {
  const { chart, host } = create({
    width: 180,
    layout: { autoPadding: false },
    padding: { left: 40, right: 40 },
    xAxis: { tickStrategy: 'nice', tickCount: 10 },
    yAxis: { tickStrategy: 'nice', tickFormat: () => 'same' },
  })
  const shownX = () =>
    Array.from(
      host.querySelectorAll('.waveform-axis-x .tick text, .waveform-axis-x-endpoint'),
    ).filter((node) => node.getAttribute('visibility') !== 'hidden').length
  const narrow = shownX()
  const gridCount = host.querySelectorAll('.waveform-grid-x .tick').length
  const shownY = Array.from(
    host.querySelectorAll('.waveform-axis-y .tick text, .waveform-axis-y-boundary'),
  ).filter((node) => node.getAttribute('visibility') !== 'hidden')
  expect(shownY).toHaveLength(1)
  chart.updateOptions({ width: 1000 })
  expect(shownX()).toBeGreaterThan(narrow)
  expect(host.querySelectorAll('.waveform-grid-x .tick')).toHaveLength(gridCount)
  chart.updateOptions({ xAxis: { tickFormat: () => 'same' } })
  expect(shownX()).toBe(1)
})
