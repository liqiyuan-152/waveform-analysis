// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { Waveform } from '../../../src/display/Waveform'
import type { WaveformOptions } from '../../../src/display/types/options'

const points = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
]

afterEach(() => {
  document.body.replaceChildren()
})

function createChart(options: WaveformOptions = {}) {
  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
  document.body.append(container)
  const chart = new Waveform(
    container,
    [
      { name: 'Left', data: points },
      { name: 'Right', yAxis: 'right', data: points },
    ],
    {
      responsive: { enabled: false },
      ...options,
    },
  )
  return { chart, container, svg: container.querySelector('svg')! }
}

describe('Waveform typography', () => {
  it('keeps metadata outside the frame after switching to a single value axis', () => {
    const { chart, container } = createChart({
      legend: { visible: false },
      secondaryYAxis: { visible: true },
      shot: { visible: true, text: '#10001', fontSize: 14 },
      xAxis: { title: { visible: true, text: 'Time', fontSize: 14 } },
    })
    chart.updateOptions({ yAxes: [{ id: 'left', position: 'left', title: { visible: false } }] })
    expect(container.querySelector('.waveform-axis-y--right')).toBeNull()
    const plotLeft = Number(
      container
        .querySelector('svg > g')!
        .getAttribute('transform')!
        .match(/translate\(([\d.]+)/)![1],
    )
    const plotRight =
      plotLeft + Number(container.querySelector('.waveform-frame-border')!.getAttribute('width'))
    for (const selector of ['.waveform-shot', '.waveform-axis-x-title']) {
      const text = container.querySelector(selector)!
      expect(Number(text.getAttribute('x')) - 7).toBeGreaterThanOrEqual(plotRight + 4)
      expect(Number(text.getAttribute('x')) + 7).toBeLessThanOrEqual(800)
    }
    chart.destroy()
  })

  it('keeps the metadata lane clear of right ticks when the right title is hidden at runtime', () => {
    const { chart, container } = createChart({
      legend: { visible: false },
      secondaryYAxis: { visible: true, title: { visible: true, text: 'Right' } },
      shot: { visible: true, text: '#10001', fontSize: 14 },
      xAxis: { title: { visible: true, text: 'Time', fontSize: 14 } },
    })
    chart.updateOptions({ secondaryYAxis: { title: { visible: false } } })
    const plotLeft = Number(
      container
        .querySelector('svg > g')!
        .getAttribute('transform')!
        .match(/translate\(([\d.]+)/)![1],
    )
    const plotRight =
      plotLeft + Number(container.querySelector('.waveform-frame-border')!.getAttribute('width'))
    const tickRight = plotRight + 2 + 3 * 11 * 0.6
    for (const selector of ['.waveform-shot', '.waveform-axis-x-title']) {
      const text = container.querySelector(selector)!
      expect(Number(text.getAttribute('x')) - 7).toBeGreaterThanOrEqual(tickRight + 4)
    }
    chart.destroy()
  })

  it('applies independent font sizes to axes, axis titles, legend, and chart title', () => {
    const { svg } = createChart({
      xAxis: {
        fontSize: 13,
        showEndValues: true,
        title: { visible: true, text: 'Time', fontSize: 17 },
      },
      yAxis: { fontSize: 14, title: { visible: true, text: 'Left axis', fontSize: 18 } },
      secondaryYAxis: {
        visible: true,
        fontSize: 15,
        title: { visible: true, text: 'Right axis', fontSize: 19 },
      },
      legend: { fontSize: 16 },
      title: { visible: true, text: 'Waveform title', fontSize: 20 },
    })

    expect(svg.querySelector('.waveform-axis-x .tick text')?.getAttribute('font-size')).toBe('13')
    expect(svg.querySelector('.waveform-axis-x-endpoints')?.getAttribute('font-size')).toBe('13')
    expect(svg.querySelector('.waveform-axis-y--left .tick text')?.getAttribute('font-size')).toBe(
      '14',
    )
    expect(svg.querySelector('.waveform-axis-y--right .tick text')?.getAttribute('font-size')).toBe(
      '15',
    )
    expect(svg.querySelector('.waveform-legend text')?.getAttribute('font-size')).toBe('16')

    const rootTexts = Array.from(svg.querySelectorAll(':scope > text'))
    expect(rootTexts.find((node) => node.textContent === 'Time')?.getAttribute('font-size')).toBe(
      '17',
    )
    expect(
      rootTexts.find((node) => node.textContent === 'Left axis')?.getAttribute('font-size'),
    ).toBe('18')
    expect(
      rootTexts.find((node) => node.textContent === 'Right axis')?.getAttribute('font-size'),
    ).toBe('19')
    expect(
      rootTexts.find((node) => node.textContent === 'Waveform title')?.getAttribute('font-size'),
    ).toBe('20')
  })

  it('does not render a shot by default', () => {
    const { svg } = createChart()

    expect(svg.querySelector('.waveform-shot')).toBeNull()
  })

  it('renders the shot and x-axis title in one right-side vertical lane', () => {
    const { svg } = createChart({
      layout: { autoPadding: false },
      padding: { top: 40, right: 70 },
      xAxis: { title: { visible: true, text: 'Time', unit: 'ms' } },
      shot: { visible: true, text: '10001', color: '#123456', fontSize: 21, fontWeight: 700 },
    })
    const shot = svg.querySelector('.waveform-shot')!
    const xAxisTitle = svg.querySelector('.waveform-axis-x-title')!

    expect(shot.textContent).toBe('10001')
    expect(xAxisTitle.textContent).toBe('Time (ms)')
    expect(shot.tagName.toLowerCase()).toBe('text')
    expect(shot.getAttribute('x')).toBe(xAxisTitle.getAttribute('x'))
    expect(shot.getAttribute('transform')).toMatch(/^rotate\(-90 /)
    expect(xAxisTitle.getAttribute('transform')).toMatch(/^rotate\(-90 /)
    expect(shot.getAttribute('text-anchor')).toBe('end')
    expect(xAxisTitle.getAttribute('text-anchor')).toBe('start')
    expect(shot.getAttribute('dominant-baseline')).toBe('middle')
    expect(xAxisTitle.getAttribute('dominant-baseline')).toBe('middle')
    expect(Number(shot.getAttribute('y'))).toBeLessThan(Number(xAxisTitle.getAttribute('y')))
    expect(shot.getAttribute('fill')).toBe('#123456')
    expect(shot.getAttribute('font-size')).toBe('21')
    expect(shot.getAttribute('font-weight')).toBe('700')
    expect(new XMLSerializer().serializeToString(svg)).toContain('class="waveform-shot"')
  })

  it('preserves shot settings when updateOptions changes only its font size', () => {
    const { chart, container } = createChart({
      shot: { visible: true, text: '10001', color: '#123456', fontSize: 11 },
    })

    chart.updateOptions({ shot: { fontSize: 24 } })
    const updatedShot = container.querySelector('.waveform-shot')!

    expect(updatedShot.textContent).toBe('10001')
    expect(updatedShot.getAttribute('fill')).toBe('#123456')
    expect(updatedShot.getAttribute('font-size')).toBe('24')
    expect(updatedShot.getAttribute('transform')).toMatch(/^rotate\(-90 /)
    expect(updatedShot.getAttribute('text-anchor')).toBe('end')
  })

  it('reserves right-side space without increasing bottom padding', () => {
    const sharedOptions: WaveformOptions = {
      padding: { right: 0, bottom: 0 },
      legend: { visible: false },
      secondaryYAxis: { visible: true },
    }
    const withoutMetadata = createChart(sharedOptions).svg
    const withMetadata = createChart({
      ...sharedOptions,
      xAxis: { title: { visible: true, text: 'Time', fontSize: 20, offset: 8 } },
      shot: { visible: true, text: '10001', fontSize: 21 },
    }).svg
    const plainFrame = withoutMetadata.querySelector('.waveform-frame-border')!
    const metadataFrame = withMetadata.querySelector('.waveform-frame-border')!

    expect(
      Number(plainFrame.getAttribute('width')) - Number(metadataFrame.getAttribute('width')),
    ).toBe(29)
    expect(metadataFrame.getAttribute('height')).toBe(plainFrame.getAttribute('height'))
  })

  it.each([false, true])(
    'fits full-width metadata with native measurement=%s and restores short text',
    (native) => {
      if (native)
        Object.defineProperty(SVGElement.prototype, 'getComputedTextLength', {
          configurable: true,
          value(this: SVGElement) {
            return (
              Array.from(this.textContent ?? '').length * Number(this.getAttribute('font-size'))
            )
          },
        })
      try {
        const { container, chart } = createChart({
          height: 300,
          animationEnabled: false,
          xAxis: { title: { visible: true, text: '横轴中文'.repeat(60), fontSize: 24 } },
          shot: { visible: true, text: '炮号中文'.repeat(60), fontSize: 24 },
        })
        const verify = () => {
          const svg = container.querySelector('svg')!
          const height = Number(svg.querySelector('.waveform-frame-border')!.getAttribute('height'))
          for (const selector of ['.waveform-shot', '.waveform-axis-x-title']) {
            const label = svg.querySelector(selector)!
            const length =
              Array.from(label.textContent!).length * Number(label.getAttribute('font-size'))
            expect(length).toBeLessThanOrEqual(Math.max(0, (height - 16) / 2))
          }
          expect(svg.querySelectorAll('[visibility="hidden"][aria-hidden="true"]')).toHaveLength(0)
        }
        verify()
        chart.updateOptions({ height: 180 })
        verify()
        chart.updateOptions({ height: 1 })
        expect(container.querySelector('.waveform-shot')!.getAttribute('font-size')).toBe('0')
        expect(container.querySelector('.waveform-axis-x-title')!.getAttribute('font-size')).toBe(
          '0',
        )
        chart.updateOptions({ height: 300 })
        chart.updateOptions({ shot: { text: '号' }, xAxis: { title: { text: '轴' } } })
        expect(container.querySelector('.waveform-shot')!.getAttribute('font-size')).toBe('24')
        expect(container.querySelector('.waveform-axis-x-title')!.getAttribute('font-size')).toBe(
          '24',
        )
        chart.destroy()
      } finally {
        if (native) Reflect.deleteProperty(SVGElement.prototype, 'getComputedTextLength')
      }
    },
  )

  it('shrinks long metadata labels to keep the upper and lower lanes separate', () => {
    const { svg } = createChart({
      height: 120,
      layout: { autoPadding: false },
      padding: { top: 10, right: 80, bottom: 10, left: 20 },
      xAxis: {
        title: { visible: true, text: 'Very long time axis', unit: 'milliseconds', fontSize: 24 },
      },
      shot: { visible: true, text: 'SHOT-123456789', fontSize: 24 },
    })
    const title = svg.querySelector('.waveform-axis-x-title')!
    const shot = svg.querySelector('.waveform-shot')!
    const availableLength = 42

    expect(Number(title.getAttribute('font-size'))).toBeLessThan(24)
    expect(Number(shot.getAttribute('font-size'))).toBeLessThan(24)
    for (const label of [title, shot]) {
      const units = Array.from(label.textContent!).reduce(
        (sum, char) => sum + (/\s/.test(char) ? 0.33 : 0.6),
        0,
      )
      expect(units * Number(label.getAttribute('font-size'))).toBeLessThanOrEqual(availableLength)
    }
  })
})
