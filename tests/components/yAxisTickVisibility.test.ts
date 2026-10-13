import { afterEach, describe, expect, it, vi } from 'vitest'
import { updateMaximumTickVisibility } from '@/components/rendering/yAxisTickVisibility'

afterEach(() => vi.restoreAllMocks())

describe('axis collision discovery', () => {
  it('updates masking after tick insertion, movement, attribute changes and removal', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.innerHTML = `<g class="waveform-track" data-track-height="100">
      <g class="waveform-track__axis--y" data-y-axis-index="0">
        <g class="tick" data-minimum-tick="true" data-tick-value="20" data-tick-y="50">
          <line /><text>20</text>
        </g>
      </g>
    </g>`
    const axis = svg.querySelector('.waveform-track__axis--y')!
    const minimum = axis.querySelector('.tick')!
    const bounds = (top: number): DOMRect => ({
      x: 0,
      y: top,
      left: 0,
      right: 20,
      top,
      bottom: top + 12,
      width: 20,
      height: 12,
      toJSON: () => ({}),
    })
    vi.spyOn(minimum.querySelector('text')!, 'getBoundingClientRect').mockReturnValue(bounds(0))
    updateMaximumTickVisibility(svg)

    const ordinary = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    ordinary.setAttribute('class', 'tick')
    ordinary.setAttribute('data-tick-value', '40')
    ordinary.setAttribute('data-tick-y', '50')
    ordinary.innerHTML = '<line /><text>40</text>'
    axis.appendChild(ordinary)
    const text = ordinary.querySelector('text')!
    const line = ordinary.querySelector('line')!
    const rectangle = vi.spyOn(text, 'getBoundingClientRect').mockReturnValue(bounds(0))
    updateMaximumTickVisibility(svg)
    expect(text.getAttribute('display')).toBe('none')
    expect(line.getAttribute('display')).toBe('none')

    rectangle.mockReturnValue(bounds(50))
    ordinary.setAttribute('data-tick-y', '70')
    updateMaximumTickVisibility(svg)
    expect(text.getAttribute('display')).toBeNull()
    expect(line.getAttribute('display')).toBeNull()

    minimum.removeAttribute('data-minimum-tick')
    ordinary.setAttribute('data-maximum-tick', 'true')
    updateMaximumTickVisibility(svg)
    expect(ordinary.getAttribute('data-maximum-value')).toBe('40')
    ordinary.remove()
    updateMaximumTickVisibility(svg)
    expect(minimum.querySelector('text')!.getAttribute('display')).toBeNull()
  })
})
