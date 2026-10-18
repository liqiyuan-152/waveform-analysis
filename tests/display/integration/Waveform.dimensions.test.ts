// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Waveform } from '../../../src/display/index'

const charts: Waveform[] = []
afterEach(() => {
  charts.splice(0).forEach((chart) => chart.destroy())
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

function setup() {
  const host = document.createElement('div')
  let width = 800,
    height = 600
  Object.defineProperties(host, {
    clientWidth: { get: () => width },
    clientHeight: { get: () => height },
  })
  document.body.append(host)
  const chart = new Waveform(
    host,
    [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    { responsive: { enabled: false }, animationEnabled: false },
  )
  charts.push(chart)
  return {
    chart,
    host,
    viewBox: () => host.querySelector('svg')!.getAttribute('viewBox'),
    resize: (w: number, h: number) => {
      width = w
      height = h
    },
  }
}

describe('dimension controls and percentage container reference (OpenSpec 3.1 / 3.2)', () => {
  it('resolves numbers, px and percentages independently on both axes and restores the baseline', () => {
    const t = setup()
    expect(t.viewBox()).toBe('0 0 800 320')
    for (const [width, height, expected] of [
      [900, 480, '900 480'],
      ['640px', '240px', '640 240'],
      ['50%', '25%', '400 150'],
      ['100%', '100%', '800 600'],
      [0.5, 1.25, '0.5 1.25'],
      ['1e2', '.5px', '100 0.5'],
    ] as const) {
      t.chart.updateOptions({ width, height })
      expect(t.viewBox()).toBe(`0 0 ${expected}`)
      expect(t.host.querySelector('svg')?.getAttribute('width')).toBe(
        typeof width === 'string' && width.endsWith('%') ? width : expected.split(' ')[0],
      )
    }
    t.chart.updateOptions({ width: undefined, height: undefined })
    expect(t.viewBox()).toBe('0 0 800 320')
  })

  it.each(['width', 'height'] as const)(
    'rejects invalid %s atomically without changing data, SVG or options',
    (key) => {
      const t = setup()
      const options = t.chart.getOptions()
      const before = t.chart.toSVGString()
      for (const value of [
        0,
        -1,
        NaN,
        Infinity,
        '',
        '0%',
        '101%',
        '-2px',
        '12em',
        'calc(100% - 2px)',
        'invalid',
      ]) {
        expect(
          () => t.chart.update({ data: [{ x: 50, y: 60 }], options: { [key]: value } }),
          String(value),
        ).toThrow(key)
        expect(t.chart.getOptions()).toEqual(options)
        expect(t.chart.toSVGString()).toBe(before)
      }
      t.chart.updateOptions({ [key]: '50%' })
      expect(t.viewBox()).toBe(key === 'width' ? '0 0 400 320' : '0 0 800 300')
    },
  )

  it('uses width/aspectRatio with limits only for percentage width; fixed px and numbers use height', () => {
    const t = setup()
    t.chart.updateOptions({
      width: '50%',
      height: '25%',
      responsive: { enabled: true, aspectRatio: 2, minHeight: 100, maxHeight: 300 },
    })
    expect(t.viewBox()).toBe('0 0 400 200')
    for (const width of [400, '400px']) {
      t.chart.updateOptions({ width })
      expect(t.viewBox()).toBe('0 0 400 150')
    }
    t.chart.updateOptions({ width: '100%', responsive: { aspectRatio: 2 } })
    expect(t.viewBox()).toBe('0 0 800 300')
    t.chart.updateOptions({ responsive: { enabled: false } })
    expect(t.viewBox()).toBe('0 0 800 150')
  })

  it('rejects minHeight greater than maxHeight but accepts equal limits atomically', () => {
    const t = setup()
    const before = t.chart.toSVGString()
    expect(() => t.chart.updateOptions({ responsive: { minHeight: 601, maxHeight: 600 } })).toThrow(
      'minHeight',
    )
    expect(t.chart.toSVGString()).toBe(before)
    t.chart.updateOptions({ responsive: { minHeight: 300, maxHeight: 300 } })
    expect(t.chart.getOptions().responsive).toMatchObject({ minHeight: 300, maxHeight: 300 })
  })

  it('observes percentage container changes with responsive mode disabled and reconnects on dimension edits', () => {
    const callbacks: Array<() => void> = []
    const disconnect = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          callbacks.push(callback)
        }
        observe() {}
        disconnect = disconnect
      },
    )
    const t = setup()
    t.chart.updateOptions({ width: '50%', height: '50%' })
    t.resize(1000, 500)
    callbacks[callbacks.length - 1]()
    expect(t.viewBox()).toBe('0 0 500 250')
    t.chart.updateOptions({ width: 200, height: 100 })
    const count = callbacks.length
    expect(disconnect).toHaveBeenCalled()
    t.resize(1200, 700)
    t.chart.resize()
    expect(t.viewBox()).toBe('0 0 200 100')
    expect(callbacks).toHaveLength(count)
  })
})
