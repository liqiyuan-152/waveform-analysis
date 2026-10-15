import { describe, expect, it } from 'vitest'
import { scaleLinear } from 'd3'
import type { TrackLayout } from '@/components/core/types'
import { updateXAxisTickVisibility } from '@/components/rendering/xAxisTickVisibility'

function fixture(width: number, measured = false) {
  const ns = 'http://www.w3.org/2000/svg'
  const axis = document.createElementNS(ns, 'g')
  const endpoints = document.createElementNS(ns, 'g')
  endpoints.innerHTML = `<text x="0" text-anchor="start">123456</text><text x="${width}" text-anchor="end">123457</text>`
  for (const value of [0, 0.25, 0.5, 0.75, 1]) {
    const tick = document.createElementNS(ns, 'g') as SVGGElement & { __data__: number }
    tick.setAttribute('class', 'tick')
    tick.__data__ = value
    tick.innerHTML = '<text>123456</text>'
    axis.append(tick)
  }
  if (measured) {
    for (const text of [...axis.querySelectorAll('text'), ...endpoints.querySelectorAll('text')]) {
      text.getBBox = () =>
        ({
          x:
            Number(text.getAttribute('x')) -
            (text.getAttribute('text-anchor') === 'start'
              ? 0
              : text.getAttribute('text-anchor') === 'end'
                ? 60
                : 30),
          y: 0,
          width: 60,
          height: 10,
        }) as DOMRect
    }
  }
  const track = { xScale: scaleLinear([0, 1], [0, width]) } as TrackLayout
  const apply = () => updateXAxisTickVisibility(axis, endpoints, track, width)
  const visible = () =>
    [...endpoints.querySelectorAll('text'), ...axis.querySelectorAll('text')].filter(
      (text) => text.getAttribute('display') !== 'none',
    )
  return { axis, endpoints, track, apply, visible }
}

describe('X label visibility', () => {
  it.each([false, true])(
    'prioritizes endpoints and keeps ticks intact (measured: %s)',
    (measured) => {
      const f = fixture(200, measured)
      f.apply()
      expect(f.visible()).toHaveLength(3)
      expect(f.visible().slice(0, 2)).toEqual([...f.endpoints.children])
      expect(f.axis.querySelectorAll('.tick')).toHaveLength(5)
      expect(f.axis.querySelector('text')!.getAttribute('display')).toBe('none')
    },
  )

  it('keeps start when endpoints collide and hides over-wide labels', () => {
    const narrow = fixture(70)
    narrow.apply()
    expect(narrow.visible()).toEqual([narrow.endpoints.children[0]])
    const tiny = fixture(20)
    tiny.apply()
    expect(tiny.visible()).toHaveLength(0)
  })

  it('restores labels after resize and remeasures changed text', () => {
    const f = fixture(70)
    f.apply()
    f.track.xScale.range([0, 400])
    f.endpoints.children[1]!.setAttribute('x', '400')
    updateXAxisTickVisibility(f.axis, f.endpoints, f.track, 400)
    expect(f.visible()).toHaveLength(5)
    f.endpoints.children[0]!.textContent = 'custom label '.repeat(20)
    updateXAxisTickVisibility(f.axis, f.endpoints, f.track, 400)
    expect(f.endpoints.children[0]!.getAttribute('display')).toBe('none')
  })
})
