import { scaleLinear } from 'd3'
import { describe, expect, it } from 'vitest'

import type { WaveformAnnotation } from '../../types'
import {
  ANNOTATION_TEXT_HORIZONTAL_PADDING,
  ANNOTATION_TEXT_PADDING,
  ANNOTATION_TEXT_VERTICAL_PADDING,
  findAnnotationSeriesCandidates,
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
    expect(interpolateAnnotationPoint([{ x: 0, y: 0 }, { x: 2, y: 10 }], 1)).toEqual({
      x: 1,
      y: 5,
    })
    expect(interpolateAnnotationPoint([{ x: 0, y: 0 }, { x: 2, y: 10 }], 3)).toBeNull()
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
      point: { x: 1, y: 5 },
      distance: 0,
    })
    expect(candidates[1].point).toEqual({ x: 1, y: 6 })
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

  it('filters invalid entries and separates nearby annotation boxes', () => {
    const track = createTrack(0, 'a', 0, [
      { x: 0, y: 1 },
      { x: 1, y: 2 },
    ], 300)
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
    expect(rendered[0].box).not.toMatchObject({
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

  it('prefers centered vertical placements and moves below a top boundary', () => {
    const track = createTrack(0, 'a', 0, [
      { x: 0, y: 0 },
      { x: 1, y: 5 },
    ], 200)

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
    expect(nearTop.placement).toBe('bottom')
    expect(nearTop.box.lineEndX).toBe(nearTop.anchorX)
    expect(nearTop.box.lineEndY).toBe(nearTop.box.y)
    expect(nearTop.box.height).toBe(30)
    expect(nearTop.box.lineEndY - nearTop.anchorY).toBe(32)
  })

  it('reverses direction when the preferred placement is clipped by a boundary', () => {
    const track = createTrack(0, 'a', 0, [
      { x: 0, y: 0 },
      { x: 1, y: 5 },
    ], 200)

    const nearTop = layoutAnnotations(
      [{ id: 'top-space', seriesId: 'a', x: 1, y: 7.5, text: '顶部空间不足' }],
      [track],
      200,
      200,
    )[0]
    expect(nearTop.placement).toBe('bottom')
    expect(nearTop.box.y).toBeGreaterThanOrEqual(0)
    expect(nearTop.box.y + nearTop.box.height).toBeLessThanOrEqual(200)

    const nearBottom = layoutAnnotations(
      [{ id: 'bottom-space', seriesId: 'a', x: 1, y: 0.5, text: '底部空间不足' }],
      [track],
      200,
      200,
    )[0]
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

  it('uses later directional candidates when vertical candidates collide', () => {
    const track = createTrack(0, 'a', 0, [
      { x: 0, y: 0 },
      { x: 1, y: 5 },
    ], 200)
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
    expect(rendered[1].placement).not.toBe('top')
    expect(rendered[1].box).not.toMatchObject({ x: rendered[0].box.x, y: rendered[0].box.y })
  })

})
