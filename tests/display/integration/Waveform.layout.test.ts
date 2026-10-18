// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Waveform } from '../../../src/display/Waveform'
import type {
  WaveformData,
  WaveformLayoutChange,
  WaveformOptions,
} from '../../../src/display/index'

const points = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
]

function createChart(data: WaveformData, options: WaveformOptions = {}) {
  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
  document.body.append(container)
  return {
    chart: new Waveform(container, data, { responsive: { enabled: false }, ...options }),
    container,
  }
}

function plotLeft(container: HTMLElement): number {
  return Number(
    container
      .querySelector('svg > g')
      ?.getAttribute('transform')
      ?.match(/translate\(([\d.]+)/)?.[1],
  )
}

async function flushLayoutChange() {
  await Promise.resolve()
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('Waveform horizontal padding coordination', () => {
  it.each(['left', 'right'] as const)(
    'measures rounded %s labels and preserves coordinated padding across notation updates',
    async (position) => {
      const onLayoutChange = vi.fn<(layout: WaveformLayoutChange) => void>()
      const { chart, container } = createChart(
        [
          { x: 0, y: 0 },
          { x: 1, y: 7.9999 },
        ],
        {
          padding: { left: 0, right: 0 },
          yAxis: { position, unit: 'V', tickCount: 2 },
          onLayoutChange,
        },
      )
      const labels = () =>
        Array.from(
          container.querySelectorAll('.waveform-axis-y .tick text'),
          (node) => node.textContent,
        )
      const frameWidth = () =>
        Number(container.querySelector('.waveform-frame-border')!.getAttribute('width'))
      expect(labels()).toEqual(['0', '7.9999'])
      await flushLayoutChange()
      const naturalPadding = { ...onLayoutChange.mock.lastCall![0].naturalPadding }
      const naturalWidth = frameWidth()
      // The header uses the same measured six-character labels as the rendered ticks.
      expect(
        Number(container.querySelector('.waveform-axis-y-header')!.getAttribute('x')),
      ).toBeCloseTo((position === 'left' ? -1 : 1) * (2 + 6 * 11 * 0.6))

      chart.updateOptions({ layout: { horizontalPadding: { left: 100, right: 100 } } })
      await flushLayoutChange()
      expect(plotLeft(container)).toBe(100)
      expect(frameWidth()).toBe(600)
      expect(onLayoutChange.mock.lastCall![0].naturalPadding).toEqual(naturalPadding)

      for (const [max, header] of [
        [7999.9, 'E+03'],
        [0.00079999, 'E-04'],
      ] as const) {
        chart.updateData([
          { x: 0, y: 0 },
          { x: 1, y: max },
        ])
        await flushLayoutChange()
        expect(labels()).toEqual(['0', '7.9999'])
        expect(container.querySelector('.waveform-axis-y-header')?.textContent).toBe(
          position === 'left' ? `V\u00a0\u00a0${header}` : `${header}\u00a0\u00a0V`,
        )
        expect(onLayoutChange.mock.lastCall![0].naturalPadding).toEqual(naturalPadding)
        expect(plotLeft(container)).toBe(100)
        expect(frameWidth()).toBe(600)
      }
      chart.updateOptions({ layout: { horizontalPadding: undefined } })
      expect(frameWidth()).toBe(naturalWidth)
      chart.updateOptions({ layout: { autoPadding: false }, padding: { left: 5, right: 7 } })
      expect(plotLeft(container)).toBe(5)
      expect(frameWidth()).toBe(788)
      chart.destroy()
    },
  )

  it('measures Y-axis labels with the rendered font family and weight after a font change', async () => {
    const original = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'getComputedTextLength')
    const measuredFonts: string[] = []
    Object.defineProperty(SVGElement.prototype, 'getComputedTextLength', {
      configurable: true,
      value(this: SVGElement) {
        if (this.getAttribute('visibility') === 'hidden') {
          measuredFonts.push(
            `${this.getAttribute('font-family')}/${this.getAttribute('font-weight')}`,
          )
        }
        const width = this.getAttribute('font-family') === 'Courier New' ? 20 : 10
        return (
          (this.textContent?.length ?? 0) *
          width *
          (this.getAttribute('font-weight') === '700' ? 2 : 1)
        )
      },
    })
    try {
      const onLayoutChange = vi.fn<(layout: WaveformLayoutChange) => void>()
      const { chart, container } = createChart(points, {
        padding: { left: 0 },
        yAxis: { fontFamily: 'Arial', fontWeight: 400, tickCount: 2, tickPadding: 5 },
        onLayoutChange,
      })
      await flushLayoutChange()
      const firstPadding = onLayoutChange.mock.lastCall![0].naturalPadding.left
      expect(
        container.querySelector('.waveform-axis-y .tick text')?.getAttribute('font-family'),
      ).toBe('Arial')
      expect(
        container.querySelector('.waveform-axis-y .tick text')?.getAttribute('font-weight'),
      ).toBe('400')

      chart.updateOptions({ yAxis: { fontFamily: 'Courier New', fontWeight: 700 } })
      await flushLayoutChange()
      expect(onLayoutChange.mock.lastCall![0].naturalPadding.left).toBeGreaterThan(firstPadding)
      expect(plotLeft(container)).toBe(onLayoutChange.mock.lastCall![0].naturalPadding.left)
      expect(
        container.querySelector('.waveform-axis-y .tick text')?.getAttribute('font-family'),
      ).toBe('Courier New')
      expect(
        container.querySelector('.waveform-axis-y .tick text')?.getAttribute('font-weight'),
      ).toBe('700')
      expect(measuredFonts).toContain('Arial/400')
      expect(measuredFonts).toContain('Courier New/700')
      chart.destroy()
    } finally {
      if (original) Object.defineProperty(SVGElement.prototype, 'getComputedTextLength', original)
      else
        delete (SVGElement.prototype as SVGElement & { getComputedTextLength?: () => number })
          .getComputedTextLength
    }
  })

  it('limits right-side reclamation to visible content and respects imposed minimums', async () => {
    const onLayoutChange = vi.fn<(layout: WaveformLayoutChange) => void>()
    const { chart, container } = createChart(points, {
      yAxis: { position: 'right', unit: 'a long unit', title: { visible: false } },
      onLayoutChange,
    })
    await flushLayoutChange()
    // 2px tick padding plus 19.8px labels, rounded up; no header-width reservation.
    expect(onLayoutChange).toHaveBeenLastCalledWith({ naturalPadding: { left: 0, right: 22 } })
    expect(Number(container.querySelector('.waveform-frame-border')!.getAttribute('width'))).toBe(
      778,
    )
    chart.updateOptions({ padding: { right: 60 }, layout: { horizontalPadding: { right: 80 } } })
    await flushLayoutChange()
    expect(onLayoutChange).toHaveBeenLastCalledWith({ naturalPadding: { left: 0, right: 60 } })
    expect(Number(container.querySelector('.waveform-frame-border')!.getAttribute('width'))).toBe(
      720,
    )
    chart.destroy()
  })

  it.each(['left', 'right'] as const)(
    'reclaims %s title space on initial render and runtime updates',
    async (position) => {
      const onLayoutChange = vi.fn<(layout: WaveformLayoutChange) => void>()
      const data = [
        { name: 'First', data: points },
        { name: 'Second', data: points },
      ]
      const options: WaveformOptions = {
        legend: { visible: false },
        yAxes: [{ id: 'value', position, title: { visible: true, text: 'Value' } }],
        onLayoutChange,
      }
      const { chart, container } = createChart(data, options)
      const frameWidth = () =>
        Number(container.querySelector('.waveform-frame-border')!.getAttribute('width'))
      const shownWidth = frameWidth()
      await flushLayoutChange()
      const shownPadding = onLayoutChange.mock.lastCall![0].naturalPadding[position]
      const hiddenAxes = [{ id: 'value', position, title: { visible: false, text: 'Value' } }]
      chart.updateOptions({ yAxes: hiddenAxes })
      await flushLayoutChange()
      expect(container.querySelector('.waveform-axis-y-title')).toBeNull()
      expect(frameWidth()).toBeGreaterThan(shownWidth)
      expect(onLayoutChange.mock.lastCall![0].naturalPadding[position]).toBeLessThan(shownPadding)
      const initiallyHidden = createChart(data, { ...options, yAxes: hiddenAxes })
      expect(plotLeft(container)).toBe(plotLeft(initiallyHidden.container))
      expect(frameWidth()).toBe(
        Number(
          initiallyHidden.container.querySelector('.waveform-frame-border')!.getAttribute('width'),
        ),
      )
      chart.updateOptions({ yAxes: options.yAxes })
      expect(frameWidth()).toBe(shownWidth)
      expect(container.querySelector('.waveform-axis-y-title')).not.toBeNull()
      chart.destroy()
      initiallyHidden.chart.destroy()
    },
  )

  it('preserves explicit padding minimums when titles are hidden and honors manual layout', () => {
    const { chart, container } = createChart(
      [
        { name: 'First', data: points },
        { name: 'Second', data: points },
      ],
      { legend: { visible: false }, padding: { left: 100, right: 110 } },
    )
    chart.updateOptions({ yAxis: { title: { visible: false } } })
    expect(plotLeft(container)).toBe(100)
    expect(Number(container.querySelector('.waveform-frame-border')!.getAttribute('width'))).toBe(
      590,
    )
    chart.updateOptions({ layout: { autoPadding: false }, padding: { left: 5, right: 7 } })
    expect(plotLeft(container)).toBe(5)
    expect(Number(container.querySelector('.waveform-frame-border')!.getAttribute('width'))).toBe(
      788,
    )
    chart.destroy()
  })

  it('applies horizontal padding after natural measurement without changing the reported values', async () => {
    const onLayoutChange = vi.fn<(layout: WaveformLayoutChange) => void>()
    const { container } = createChart(
      [
        { name: 'First', data: points },
        { name: 'Second', data: points },
      ],
      {
        legend: { visible: false },
        layout: { horizontalPadding: { left: 100, right: 120 } },
        onLayoutChange,
      },
    )

    await flushLayoutChange()

    expect(onLayoutChange).toHaveBeenCalledWith({ naturalPadding: { left: 51, right: 0 } })
    expect(plotLeft(container)).toBe(100)
    expect(Number(container.querySelector('.waveform-frame-border')?.getAttribute('width'))).toBe(
      580,
    )
  })

  it('ignores invalid minimums and lets runtime updates reduce or clear them', () => {
    const { chart, container } = createChart(
      [
        { name: 'First', data: points },
        { name: 'Second', data: points },
      ],
      { legend: { visible: false }, layout: { horizontalPadding: { left: 120 } } },
    )

    expect(plotLeft(container)).toBe(120)

    chart.updateOptions({ layout: { horizontalPadding: { left: 90, right: Number.NaN } } })
    expect(plotLeft(container)).toBe(90)

    chart.updateOptions({ layout: { horizontalPadding: undefined } })
    expect(plotLeft(container)).toBe(51)
  })

  it('reports initial, data, legend, and replacement-callback layout changes without reporting imposed minimums', async () => {
    const firstCallback = vi.fn<(layout: WaveformLayoutChange) => void>()
    const secondCallback = vi.fn<(layout: WaveformLayoutChange) => void>()
    const { chart, container } = createChart(
      [
        { id: 'left', name: 'Left', data: points },
        { id: 'right', name: 'Right', yAxis: 'right', data: points },
      ],
      {
        layout: { horizontalPadding: { left: 140 } },
        secondaryYAxis: { visible: true },
        onLayoutChange: firstCallback,
      },
    )

    await flushLayoutChange()
    expect(firstCallback).toHaveBeenLastCalledWith({ naturalPadding: { left: 51, right: 96 } })
    expect(plotLeft(container)).toBe(140)

    container
      .querySelector<SVGGElement>('.waveform-legend-item')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushLayoutChange()
    expect(firstCallback).toHaveBeenLastCalledWith({ naturalPadding: { left: 0, right: 96 } })

    chart.updateOptions({ onLayoutChange: secondCallback })
    await flushLayoutChange()
    expect(secondCallback).toHaveBeenCalledWith({ naturalPadding: { left: 0, right: 96 } })

    chart.updateData([])
    await flushLayoutChange()
    expect(secondCallback).toHaveBeenLastCalledWith({ naturalPadding: { left: 0, right: 0 } })
  })

  it('rechecks layout through ResizeObserver without repeating an unchanged natural padding', async () => {
    const callbacks: ResizeObserverCallback[] = []
    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        callbacks.push(callback)
      }

      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', TestResizeObserver)

    const onLayoutChange = vi.fn<(layout: WaveformLayoutChange) => void>()
    const { container } = createChart(
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      { responsive: { enabled: true }, onLayoutChange },
    )

    await flushLayoutChange()
    callbacks[0]!([], {} as ResizeObserver)
    await flushLayoutChange()

    expect(onLayoutChange).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
    expect(plotLeft(container)).toBe(27)
  })

  it('coalesces rapid natural padding changes to the latest rendered value', async () => {
    const onLayoutChange = vi.fn<(layout: WaveformLayoutChange) => void>()
    const { chart } = createChart([{ name: 'Only', data: points }], { onLayoutChange })

    await flushLayoutChange()
    chart.updateData([
      { name: 'First', data: points },
      { name: 'Second', data: points },
    ])
    chart.updateData([{ name: 'Only', data: points }])
    await flushLayoutChange()

    expect(onLayoutChange).toHaveBeenCalledTimes(1)
    expect(onLayoutChange).toHaveBeenLastCalledWith({ naturalPadding: { left: 27, right: 0 } })
  })

  it('does not notify after destruction when an initial callback is pending', async () => {
    const onLayoutChange = vi.fn<(layout: WaveformLayoutChange) => void>()
    const { chart } = createChart(
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      { onLayoutChange },
    )

    chart.destroy()
    await flushLayoutChange()

    expect(onLayoutChange).not.toHaveBeenCalled()
  })

  it('does not force a stable callback and isolates cached padding from callback mutation', async () => {
    const onLayoutChange = vi.fn((layout: WaveformLayoutChange) => {
      layout.naturalPadding.left = 999
    })
    const { chart } = createChart(
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      { onLayoutChange },
    )

    await flushLayoutChange()
    chart.updateOptions({ onLayoutChange })
    await flushLayoutChange()

    expect(onLayoutChange).toHaveBeenCalledTimes(1)
  })
})
