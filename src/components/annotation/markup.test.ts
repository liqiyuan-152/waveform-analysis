import { scaleLinear } from 'd3'
import { describe, expect, it } from 'vitest'

import type { WaveformAnnotation } from '../../types'
import {
  ANNOTATION_TEXT_HORIZONTAL_PADDING,
  ANNOTATION_TEXT_PADDING,
  ANNOTATION_TEXT_VERTICAL_PADDING,
  findAnnotationSeriesCandidates,
  findNearestPointByX,
  findNearestAnnotationPoint,
  interpolateAnnotationPoint,
  layoutAnnotations,
  resolveAnnotationStyle,
  wrapAnnotationText,
} from './markup'
import type { AnnotationTrackLayout } from './types'

const createTrack = (
  index: number,
  id: string,
  top: number,
  points: Array<{ x: number; y: number }>,
  height = 100,
): AnnotationTrackLayout => ({
  index,
  series: { id, points },
  top,
  height,
  xScale: scaleLinear([0, 2], [0, 200]),
  yScale: scaleLinear([0, 10], [height, 0]),
})

describe('waveform annotation markup', () => {
  it('interpolates a line value at the pointer X', () => {
    expect(
      interpolateAnnotationPoint(
        [
          { x: 0, y: 0 },
          { x: 2, y: 10 },
        ],
        1,
      ),
    ).toEqual({
      x: 1,
      y: 5,
    })
    expect(
      interpolateAnnotationPoint(
        [
          { x: 0, y: 0 },
          { x: 2, y: 10 },
        ],
        3,
      ),
    ).toBeNull()
  })

  it('snaps outside and between samples to the nearest complete-data point', () => {
    const points = [
      { x: 1, y: 10 },
      { x: 2, y: 20 },
      { x: 4, y: 40 },
    ]
    expect(findNearestPointByX(points, -10)).toEqual(points[0])
    expect(findNearestPointByX(points, 3.1)).toEqual(points[2])
    expect(findNearestPointByX(points, 10)).toEqual(points[2])
    expect(findNearestPointByX(points, 2)).toEqual(points[1])
    expect(findNearestPointByX([{ x: 2, y: 20 }], 2.1)).toEqual({ x: 2, y: 20 })
    expect(findNearestPointByX(points, Number.NaN)).toBeNull()
  })

  it('snaps annotations to nearest sample points while using interpolation for distance calculation', () => {
    const track = createTrack(0, 'series', 0, [
      { x: 0, y: 0 },
      { x: 2, y: 10 },
    ])
    const candidates = findAnnotationSeriesCandidates([track], 0.75, 75, 62.5)

    // Should snap to nearest actual sample point for the anchor
    expect(candidates[0].point).toEqual({ x: 0, y: 0 })
    expect(candidates[0].xValue).toBeUndefined()
    // Distance is calculated using interpolated position for accurate series selection
    expect(candidates[0].distance).toBe(0)
    expect(findNearestPointByX(track.series.points, 1.25)).toEqual({ x: 2, y: 10 })
  })

  it('interpolates start, middle, and end step lines at their visual transitions', () => {
    const points = [
      { x: 0, y: 2 },
      { x: 2, y: 10 },
    ]

    expect(interpolateAnnotationPoint(points, 0.5, 'step-start')).toEqual({ x: 0.5, y: 10 })
    expect(interpolateAnnotationPoint(points, 0.5, 'step-middle')).toEqual({ x: 0.5, y: 2 })
    expect(interpolateAnnotationPoint(points, 1, 'step-middle')).toEqual({ x: 1, y: 10 })
    expect(interpolateAnnotationPoint(points, 1.5, 'step-middle')).toEqual({ x: 1.5, y: 10 })
    expect(interpolateAnnotationPoint(points, 1, 'step-end')).toEqual({ x: 1, y: 2 })
    expect(interpolateAnnotationPoint(points, 1, 'step-after')).toEqual({ x: 1, y: 2 })
    expect(interpolateAnnotationPoint(points, 2, 'step-start')).toEqual({ x: 2, y: 10 })
    expect(interpolateAnnotationPoint(points, 2, 'step-after')).toEqual({ x: 2, y: 10 })
    expect(interpolateAnnotationPoint(points, 1, 'none')).toBeNull()
    expect(interpolateAnnotationPoint(points, 2, 'none')).toEqual({ x: 2, y: 10 })
  })

  it('uses the nearest screen-space sample for point-only series', () => {
    const pointOnly = createTrack(0, 'points', 0, [
      { x: 0, y: 2 },
      { x: 2, y: 10 },
    ])
    pointOnly.series.lineType = 'none'

    expect(findAnnotationSeriesCandidates([pointOnly], 1, 5, 80)).toMatchObject([
      { point: { x: 0, y: 2 }, screenX: 0, screenY: 80, distance: 5 },
    ])
  })

  it('sorts line candidates by screen distance and keeps series metadata', () => {
    const first = createTrack(0, 'first', 0, [
      { x: 0, y: 0 },
      { x: 2, y: 10 },
    ])
    first.series.name = '第一通道'
    first.series.color = '#f00'
    first.series.unit = 'V'
    const second = createTrack(1, 'second', 0, [
      { x: 0, y: 4 },
      { x: 2, y: 8 },
    ])
    const candidates = findAnnotationSeriesCandidates([first, second], 1, 100, 50)

    expect(candidates[0]).toMatchObject({
      seriesId: 'first',
      name: '第一通道',
      color: '#f00',
      unit: 'V',
      point: { x: 2, y: 10 }, // Snaps to nearest sample point
      distance: 0,
    })
    expect(candidates[1].point).toEqual({ x: 2, y: 8 }) // Snaps to nearest sample point
  })

  it('uses equal horizontal and vertical annotation padding', () => {
    expect(ANNOTATION_TEXT_HORIZONTAL_PADDING).toBe(ANNOTATION_TEXT_PADDING)
    expect(ANNOTATION_TEXT_VERTICAL_PADDING).toBe(ANNOTATION_TEXT_PADDING)
  })

  it('finds the closest visible sample across candidate tracks', () => {
    const hit = findNearestAnnotationPoint(
      [
        createTrack(0, 'a', 0, [
          { x: 0, y: 1 },
          { x: 1, y: 2 },
        ]),
        createTrack(1, 'b', 100, [
          { x: 0, y: 1 },
          { x: 1, y: 8 },
        ]),
      ],
      100,
      120,
      12,
    )

    expect(hit).toMatchObject({ seriesId: 'b', trackIndex: 1 })
    expect(hit?.point).toEqual({ x: 1, y: 8 })
  })

  it('returns no hit outside the configured screen radius', () => {
    const hit = findNearestAnnotationPoint([createTrack(0, 'a', 0, [{ x: 1, y: 2 }])], 160, 10, 12)

    expect(hit).toBeNull()
  })

  it('wraps labels by Unicode characters and resolves style defaults', () => {
    expect(wrapAnnotationText('1234567890中文')).toEqual(['1234567890', '中文'])
    expect(resolveAnnotationStyle({ textColor: '#ffffff' })).toEqual({
      borderColor: '#1677ff',
      textColor: '#ffffff',
      backgroundColor: 'rgba(255, 255, 255, 0.92)',
    })
  })

  it('filters invalid entries and keeps coincident labels on the default layout', () => {
    const track = createTrack(
      0,
      'a',
      0,
      [
        { x: 0, y: 1 },
        { x: 1, y: 2 },
      ],
      300,
    )
    const annotations: WaveformAnnotation[] = [
      { id: 'first', seriesId: 'a', x: 1, y: 2, text: '第一个标注' },
      { id: 'second', seriesId: 'a', x: 1, y: 2, text: '第二个标注' },
      { id: 'unknown', seriesId: 'missing', x: 1, y: 2, text: '不显示' },
      { id: 'invalid', seriesId: 'a', x: Number.NaN, y: 2, text: '不显示' },
    ]

    const rendered = layoutAnnotations(annotations, [track], 300, 300)

    expect(rendered.map((item) => item.annotation.id)).toEqual(['first', 'second'])
    expect(rendered[0].box.lineEndX).toBe(rendered[0].anchorX)
    expect(rendered[0].box.lineEndY).not.toBe(rendered[0].anchorY)
    expect(rendered[0].placement).toBe('top')
    expect(rendered[0].box).toMatchObject({
      x: rendered[1].box.x,
      y: rendered[1].box.y,
    })
    rendered.forEach((item) => {
      expect(item.box.x).toBeGreaterThanOrEqual(0)
      expect(item.box.y).toBeGreaterThanOrEqual(0)
      expect(item.box.x + item.box.width).toBeLessThanOrEqual(300)
      expect(item.box.y + item.box.height).toBeLessThanOrEqual(300)
    })
  })

  it('uses the default placement and clamps labels to the plot boundary', () => {
    const track = createTrack(
      0,
      'a',
      0,
      [
        { x: 0, y: 0 },
        { x: 1, y: 5 },
      ],
      200,
    )

    const centered = layoutAnnotations(
      [{ id: 'centered', seriesId: 'a', x: 1, y: 5, text: '居中' }],
      [track],
      200,
      200,
    )[0]
    expect(centered.placement).toBe('top')
    expect(centered.box.x + centered.box.width / 2).toBe(centered.anchorX)
    expect(centered.box.lineEndX).toBe(centered.anchorX)
    expect(centered.box.lineEndY).toBe(centered.box.y + centered.box.height)

    const nearTop = layoutAnnotations(
      [{ id: 'top-edge', seriesId: 'a', x: 1, y: 9.5, text: '顶部' }],
      [track],
      200,
      200,
    )[0]
    // Smart placement chooses 'bottom' when near top boundary
    expect(nearTop.placement).toBe('bottom')
    expect(nearTop.box.lineEndX).toBe(nearTop.anchorX)
    expect(nearTop.box.y).toBeGreaterThanOrEqual(0)
    expect(nearTop.box.lineEndY).toBeLessThanOrEqual(nearTop.box.y + nearTop.box.height)
  })

  it('intelligently chooses placement to avoid boundaries', () => {
    const track = createTrack(
      0,
      'a',
      0,
      [
        { x: 0, y: 0 },
        { x: 1, y: 5 },
      ],
      200,
    )

    const nearTop = layoutAnnotations(
      [{ id: 'top-space', seriesId: 'a', x: 1, y: 7.5, text: '顶部空间不足' }],
      [track],
      200,
      200,
    )[0]
    // Smart placement chooses 'bottom' when top space is insufficient
    expect(nearTop.placement).toBe('bottom')
    expect(nearTop.box.y).toBeGreaterThanOrEqual(0)
    expect(nearTop.box.y + nearTop.box.height).toBeLessThanOrEqual(200)

    const nearBottom = layoutAnnotations(
      [{ id: 'bottom-space', seriesId: 'a', x: 1, y: 0.5, text: '底部空间不足' }],
      [track],
      200,
      200,
    )[0]
    // Smart placement chooses 'top' when bottom space is insufficient
    expect(nearBottom.placement).toBe('top')
    expect(nearBottom.box.y).toBeGreaterThanOrEqual(0)
    expect(nearBottom.box.y + nearBottom.box.height).toBeLessThanOrEqual(200)
  })

  it('keeps a clipped fallback when the plot is smaller than the annotation box', () => {
    const track = createTrack(0, 'a', 0, [{ x: 1, y: 5 }])
    const rendered = layoutAnnotations(
      [{ id: 'tiny-plot', seriesId: 'a', x: 1, y: 5, text: '无法完整放置' }],
      [track],
      40,
      20,
    )[0]

    expect(rendered).toBeDefined()
    expect(rendered.box.x).toBeGreaterThanOrEqual(0)
    expect(rendered.box.y).toBeGreaterThanOrEqual(0)
  })

  it('applies a persisted label offset without moving the data anchor', () => {
    const track = createTrack(
      0,
      'a',
      0,
      [
        { x: 0, y: 0 },
        { x: 1, y: 5 },
      ],
      300,
    )
    const baseline = layoutAnnotations(
      [{ id: 'baseline', seriesId: 'a', x: 1, y: 5, text: '偏移' }],
      [track],
      300,
      300,
    )[0]
    const rendered = layoutAnnotations(
      [
        {
          id: 'offset',
          seriesId: 'a',
          x: 1,
          y: 5,
          text: '偏移',
          labelOffsetX: 24,
          labelOffsetY: 18,
        },
      ],
      [track],
      300,
      300,
    )[0]

    expect(rendered.anchorX).toBe(100)
    expect(rendered.anchorY).toBe(150)
    expect(rendered.box.x).toBe(baseline.box.x + 24)
    expect(rendered.box.y).toBe(baseline.box.y + 18)
    expect(rendered.box.lineEndX).not.toBe(rendered.anchorX)
  })

  it('uses later directional candidates when vertical candidates collide', () => {
    const track = createTrack(
      0,
      'a',
      0,
      [
        { x: 0, y: 0 },
        { x: 1, y: 5 },
      ],
      200,
    )
    const rendered = layoutAnnotations(
      [
        { id: 'one', seriesId: 'a', x: 1, y: 5, text: '同一位置一' },
        { id: 'two', seriesId: 'a', x: 1, y: 5, text: '同一位置二' },
      ],
      [track],
      200,
      200,
    )

    expect(rendered[0].placement).toBe('top')
    expect(rendered[1].placement).toBe('top')
    expect(rendered[1].box).toMatchObject({ x: rendered[0].box.x, y: rendered[0].box.y })
  })
})
