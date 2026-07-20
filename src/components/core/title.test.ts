import { describe, expect, it } from 'vitest'

import { calculateRotatedTitleLayout, TITLE_AREA_MAX_HEIGHT, TITLE_AREA_MIN_HEIGHT } from './title'

describe('calculateRotatedTitleLayout', () => {
  it('reserves the available width for an unrotated title that fits', () => {
    expect(
      calculateRotatedTitleLayout({
        naturalWidth: 200,
        naturalHeight: 20,
        availableWidth: 300,
        rotation: 0,
      }),
    ).toEqual({
      textWidth: 300,
      textHeight: 20,
      visualWidth: 300,
      visualHeight: 20,
      areaHeight: TITLE_AREA_MIN_HEIGHT,
      scale: 1,
      wrapped: false,
    })
  })

  it.each([45, 90, -90, 180])('keeps a %s degree title inside the maximum area', (rotation) => {
    const layout = calculateRotatedTitleLayout({
      naturalWidth: 400,
      naturalHeight: 20,
      availableWidth: 600,
      rotation,
    })

    expect(layout.areaHeight).toBeGreaterThanOrEqual(TITLE_AREA_MIN_HEIGHT)
    expect(layout.areaHeight).toBeLessThanOrEqual(TITLE_AREA_MAX_HEIGHT)
    expect(layout.visualHeight).toBeLessThanOrEqual(TITLE_AREA_MAX_HEIGHT)
    expect(layout.textWidth).toBe(400)
    expect(layout.scale).toBeLessThanOrEqual(1)
    expect(layout.wrapped).toBe(false)
  })

  it('wraps an unrotated title to the available width without scaling', () => {
    const layout = calculateRotatedTitleLayout({
      naturalWidth: 1_000,
      naturalHeight: 20,
      availableWidth: 120,
      rotation: 0,
    })

    expect(layout.textWidth).toBe(120)
    expect(layout.textHeight).toBe(180)
    expect(layout.visualWidth).toBe(120)
    expect(layout.visualHeight).toBe(180)
    expect(layout.areaHeight).toBe(198)
    expect(layout.scale).toBe(1)
    expect(layout.wrapped).toBe(true)
  })

  it('falls back safely for non-finite dimensions and rotation', () => {
    const layout = calculateRotatedTitleLayout({
      naturalWidth: Number.NaN,
      naturalHeight: Number.POSITIVE_INFINITY,
      availableWidth: Number.NaN,
      rotation: Number.NaN,
    })

    expect(layout).toEqual({
      textWidth: 1,
      textHeight: 1,
      visualWidth: 1,
      visualHeight: 1,
      areaHeight: TITLE_AREA_MIN_HEIGHT,
      scale: 1,
      wrapped: false,
    })
  })
})
