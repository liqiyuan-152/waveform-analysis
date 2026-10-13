import { scaleLinear } from 'd3'
import { describe, expect, it } from 'vitest'
import { updateGrid } from '@/components/rendering/updateGrid'

describe('grid line projection', () => {
  it.each(['vertical', 'horizontal'] as const)(
    'retains keyed %s nodes and projects current scale',
    (direction) => {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      const scale = scaleLinear().domain([0, 10]).range([0, 100])
      updateGrid(group, [0, 5, 10], scale, direction, 200, 'red')
      const middle = group.children[1]!
      const observer = new MutationObserver(() => {})
      observer.observe(group, { subtree: true, childList: true, attributes: true })
      updateGrid(group, [0, 5, 10], scale, direction, 200, 'red')
      expect(observer.takeRecords()).toEqual([])
      middle.setAttribute('display', 'none')
      scale.domain([0, 20])
      updateGrid(group, [10, 5], scale, direction, 300, undefined)
      expect(group.children).toHaveLength(2)
      expect(group.children[1]).toBe(middle)
      expect(middle.getAttribute('display')).toBe('none')
      expect(middle.getAttribute(direction === 'vertical' ? 'x1' : 'y1')).toBe('25')
      expect(middle.getAttribute(direction === 'vertical' ? 'y2' : 'x2')).toBe('300')
      expect(middle.getAttribute('stroke')).toBeNull()
      expect(middle.getAttribute('data-grid-direction')).toBe(direction)
      updateGrid(group, [], scale, direction, 300, 'blue')
      expect(group.children).toHaveLength(0)
      observer.disconnect()
    },
  )
})
