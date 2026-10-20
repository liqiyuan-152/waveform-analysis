import { describe, expect, it } from 'vitest'
import { tooltipPlacement } from '@/view/tooltipPlacement'

describe('tooltip pointer avoidance', () => {
  it.each([
    [100, 100, 120, 120],
    [370, 100, 230, 120],
    [100, 270, 120, 190],
    [370, 270, 230, 190],
  ])('places a tooltip near (%s, %s) without covering the pointer', (x, y, left, top) => {
    const style = tooltipPlacement(
      { x, y },
      { width: 120, height: 60 },
      { width: 400, height: 300 },
    )
    expect(style.left).toBe(`${left}px`)
    expect(style.top).toBe(`${top}px`)
    expect(style.right).toBe('')
  })

  it('clamps oversized content to the padding when neither side fits', () => {
    const style = tooltipPlacement(
      { x: 90, y: 70 },
      { width: 184, height: 200 },
      { width: 200, height: 150 },
    )
    expect(style).toMatchObject({ left: '8px', top: '8px', maxWidth: '184px' })
  })
})
