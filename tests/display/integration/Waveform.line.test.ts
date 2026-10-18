// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { Waveform } from '../../../src/display/Waveform'
import type { WaveformData } from '../../../src/display/types/data'

const points = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
]

afterEach(() => {
  document.body.replaceChildren()
})

function render(data: WaveformData, lineWidth?: number) {
  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
  document.body.append(container)
  new Waveform(container, data, {
    responsive: { enabled: false },
    ...(lineWidth === undefined ? {} : { line: { width: lineWidth } }),
  })
  return Array.from(container.querySelectorAll('g[clip-path] > path'))
}

describe('Waveform line width', () => {
  it('uses 1.5px by default and supports a global override', () => {
    expect(render(points)[0].getAttribute('stroke-width')).toBe('1.5')
    expect(render(points, 3)[0].getAttribute('stroke-width')).toBe('3')
  })

  it('supports a per-series override', () => {
    const paths = render([
      { name: 'default', data: points },
      { name: 'custom', data: points, style: { lineWidth: 2.5 } },
    ])

    expect(paths.map((path) => path.getAttribute('stroke-width'))).toEqual(['1.5', '2.5'])
  })
})
