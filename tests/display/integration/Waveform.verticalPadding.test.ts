// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Waveform } from '../../../src/display/Waveform'
import type { WaveformOptions } from '../../../src/display/types/options'

const points = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
]

function setup(options: WaveformOptions = {}) {
  const container = document.createElement('div')
  document.body.append(container)
  const chart = new Waveform(container, points, {
    width: 400,
    height: 200,
    responsive: { enabled: false },
    ...options,
  })
  const layout = () => {
    const plot = container.querySelector('svg > g')!
    const [left, top] = plot
      .getAttribute('transform')!
      .match(/-?[\d.]+/g)!
      .map(Number)
    const frame = container.querySelector('.waveform-frame-border')!
    const width = Number(frame.getAttribute('width'))
    const height = Number(frame.getAttribute('height'))
    return { left, top, right: 400 - left - width, bottom: 200 - top - height }
  }
  return { chart, container, layout }
}

afterEach(() => document.body.replaceChildren())

describe('Waveform vertical padding', () => {
  it('keeps the existing defaults distinct from automatic minimums', () => {
    const { chart, layout } = setup()
    expect(layout()).toMatchObject({ top: 42, bottom: 58 })
    chart.destroy()
  })

  it.each([true, false])('uses 30 as the bottom floor with X-axis visibility %s', (visible) => {
    const { chart, layout } = setup({
      padding: { top: 0, bottom: 9 },
      xAxis: { visible, fontSize: 48, tickPadding: 30 },
    })
    for (const bottom of [9, 0, 27, 29, 30, 42, 80]) {
      chart.updateOptions({ padding: { bottom } })
      expect(layout().bottom).toBe(Math.max(bottom, 30))
    }
    chart.updateData([
      { x: 0, y: 0 },
      { x: 10, y: 1000 },
    ])
    chart.updateOptions({ padding: { bottom: 9 } })
    expect(layout().bottom).toBe(30)
    chart.destroy()
  })

  it('preserves explicit top padding with a title, channel name, or top legend', () => {
    const { chart, container, layout } = setup({
      title: { visible: true, text: 'Title' },
      legend: { orientation: 'horizontal', position: 'top-left' },
      padding: { top: 0, bottom: 9 },
    })
    expect(container.querySelector('.waveform-channel-name')).not.toBeNull()
    expect(layout().top).toBe(0)
    chart.updateData([
      { name: 'First', data: points },
      { name: 'Second', data: points },
    ])
    expect(container.querySelector('.waveform-legend')).not.toBeNull()
    for (const top of [0, 9, 32, 80]) {
      chart.updateOptions({ padding: { top } })
      expect(layout().top).toBe(top)
      expect(layout().bottom).toBe(30)
    }
    chart.destroy()
  })

  it('retains content-based Y header clearance without imposing a title minimum', () => {
    const { chart, layout } = setup({
      padding: { top: 0, bottom: 9 },
      title: { visible: true, text: 'Title' },
      yAxis: { unit: 'V', fontSize: 20 },
    })
    expect(layout().top).toBe(28)
    chart.updateOptions({ padding: { top: 35 } })
    expect(layout().top).toBe(35)
    chart.updateOptions({ padding: { top: 0 }, yAxis: { unit: '' } })
    expect(layout().top).toBe(0)
    chart.destroy()
  })

  it('keeps manual vertical padding exact, including negative values', () => {
    const { chart, layout } = setup({
      layout: { autoPadding: false },
      padding: { top: 0, bottom: -30 },
      yAxis: { unit: 'V' },
    })
    expect(layout()).toMatchObject({ top: 0, bottom: -30 })
    chart.destroy()
  })

  it('does not change natural or imposed horizontal padding during vertical updates', async () => {
    const onLayoutChange = vi.fn()
    const { chart, layout } = setup({
      padding: { top: 32, bottom: 9 },
      layout: { horizontalPadding: { left: 100, right: 110 } },
      onLayoutChange,
    })
    await Promise.resolve()
    expect(onLayoutChange).toHaveBeenLastCalledWith({ naturalPadding: { left: 27, right: 0 } })
    for (const bottom of [0, 9, 27, 30, 80]) {
      chart.updateOptions({ padding: { top: 0, bottom } })
      await Promise.resolve()
      expect(layout()).toEqual({ left: 100, right: 110, top: 0, bottom: Math.max(bottom, 30) })
    }
    expect(onLayoutChange).toHaveBeenCalledTimes(1)
    chart.destroy()
  })
})
