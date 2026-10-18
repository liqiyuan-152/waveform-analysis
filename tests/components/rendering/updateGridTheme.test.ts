import { expect, it } from 'vitest'
import { scaleLinear } from 'd3'
import { updateGrid } from '@/components/rendering/updateGrid'

it('lets explicit grid colors override theme CSS and removes the override when cleared', () => {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  const scale = scaleLinear().domain([0, 1]).range([0, 100])
  updateGrid(group, [0.5], scale, 'vertical', 100, '#123456')
  const line = group.querySelector('line')!
  expect(line.style.stroke).toBe('rgb(18, 52, 86)')
  updateGrid(group, [0.5], scale, 'vertical', 100, '#abcdef')
  expect(group.querySelector('line')).toBe(line)
  expect(line.style.stroke).toBe('rgb(171, 205, 239)')
  updateGrid(group, [0.5], scale, 'vertical', 100, undefined)
  expect(line.style.stroke).toBe('')
  expect(line.hasAttribute('stroke')).toBe(false)
})
