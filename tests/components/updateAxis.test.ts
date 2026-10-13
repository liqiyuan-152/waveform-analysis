import { axisBottom, axisLeft, axisRight, scaleLinear } from 'd3'
import { describe, expect, it } from 'vitest'
import { updateAxis, updateSvgAttribute } from '@/components/rendering/updateAxis'

describe('axis domain animation', () => {
  it('does not mutate native SVG attributes or text when a frame has identical output', () => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    const scale = scaleLinear().domain([0, 10]).range([0, 100])
    const ticks = [0, 5, 10]
    const axis = axisLeft(scale).tickValues(ticks).offset(0)
    const format = (value: number) => String(value)
    updateAxis(element, axis, scale, ticks, 'left', format)
    updateSvgAttribute(element, 'data-unit', 'V')
    const observer = new MutationObserver(() => {})
    observer.observe(element, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    })
    updateAxis(element, axis, scale, ticks, 'left', format)
    updateSvgAttribute(element, 'data-unit', 'V')
    updateSvgAttribute(element, 'display', null)
    expect(observer.takeRecords()).toEqual([])
    updateSvgAttribute(element, 'data-unit', null)
    expect(element.hasAttribute('data-unit')).toBe(false)
    expect(observer.takeRecords()).toHaveLength(1)
    observer.disconnect()
  })
  it.each(['bottom', 'left', 'right'] as const)(
    'moves %s ticks while retaining unchanged native text nodes',
    (orientation) => {
      const element = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      const scale = scaleLinear().domain([0, 10]).range([0, 100])
      const ticks = [0, 10]
      const generator = { bottom: axisBottom, left: axisLeft, right: axisRight }[orientation]
      const axis = generator(scale).tickValues(ticks).offset(0)
      const format = (value: number) => String(value)
      axis.tickFormat((value) => format(Number(value)))
      updateAxis(element, axis, scale, ticks, orientation, format)
      const tick = element.querySelectorAll('.tick')[1]!
      const text = tick.querySelector('text')!
      const nativeNode = text.firstChild
      scale.domain([0, 20])
      updateAxis(element, axis, scale, ticks, orientation, format)
      expect(text.firstChild).toBe(nativeNode)
      expect(tick.getAttribute('transform')).toBe(
        orientation === 'bottom' ? 'translate(50,0)' : 'translate(0,50)',
      )
      updateAxis(element, axis, scale, ticks, orientation, (value) => `${value} ms`)
      expect(text.textContent).toBe('10 ms')
      const nextTicks = [0, 5, 10]
      updateAxis(element, axis.tickValues(nextTicks), scale, nextTicks, orientation, format)
      expect(element.querySelectorAll('.tick')).toHaveLength(3)
      scale.range([0, 200])
      updateAxis(element, axis, scale, nextTicks, orientation, format)
      expect(element.querySelector('path')?.getAttribute('d')).toContain('200')
    },
  )
})
