import { describe, expect, it } from 'vitest'

import {
  reduceViewportInteraction,
  transitionViewportInteraction,
  type ViewportInteractionEvent,
} from './viewportInteractionState'

const gesture = {
  trackIndex: 2,
  independent: true,
  startX: 10,
  startY: 20,
  pointerId: 7,
  kind: 'box' as const,
  xDomain: [0, 100] as [number, number],
  yDomains: { track: [-1, 1] as [number, number] },
}

describe('viewport interaction reducer', () => {
  it('accepts one begin and rejects a conflicting begin', () => {
    const started = transitionViewportInteraction(null, { type: 'begin', gesture })
    const conflicting = transitionViewportInteraction(started.state, {
      type: 'begin',
      gesture: { ...gesture, pointerId: 8 },
    })

    expect(started.accepted).toBe(true)
    expect(started.state).toMatchObject({ kind: 'box', pointerId: 7 })
    expect(conflicting.accepted).toBe(false)
    expect(conflicting.state).toMatchObject({ kind: 'box', pointerId: 7 })
  })

  it('rejects move and finish from a different pointer without changing state', () => {
    const state = reduceViewportInteraction(null, { type: 'begin', gesture })
    const move = transitionViewportInteraction(state, {
      type: 'move',
      pointerId: 8,
      position: { currentX: 30, currentY: 40 },
    })
    const finish = transitionViewportInteraction(move.state, {
      type: 'finish',
      pointerId: 8,
      position: { currentX: 30, currentY: 40 },
    })

    expect(move.accepted).toBe(false)
    expect(finish.accepted).toBe(false)
    expect(finish.state).toMatchObject({ currentX: 10, currentY: 20 })
  })

  it('updates a valid pointer and returns the completed snapshot on finish', () => {
    const state = reduceViewportInteraction(null, {
      type: 'begin',
      gesture: { ...gesture, kind: 'pan' },
    })
    const moved = transitionViewportInteraction(state, {
      type: 'move',
      pointerId: 7,
      position: { currentX: 30, currentY: 40 },
    })
    const finished = transitionViewportInteraction(moved.state, {
      type: 'finish',
      pointerId: 7,
      position: { currentX: 50, currentY: 60 },
    })

    expect(moved.state).toMatchObject({ kind: 'pan', currentX: 30, currentY: 40 })
    expect(finished.completed).toMatchObject({ kind: 'pan', currentX: 50, currentY: 60 })
    expect(finished.state).toBeNull()
  })

  it('cancels only the owning pointer and supports cancel/reset events', () => {
    const state = reduceViewportInteraction(null, { type: 'begin', gesture })
    const rejectedCancel = transitionViewportInteraction(state, { type: 'cancel', pointerId: 8 })
    const cancelled = transitionViewportInteraction(rejectedCancel.state, {
      type: 'cancel',
      pointerId: 7,
    })
    const restarted = reduceViewportInteraction(null, { type: 'begin', gesture })
    const reset = transitionViewportInteraction(restarted, { type: 'reset' })

    expect(rejectedCancel.accepted).toBe(false)
    expect(rejectedCancel.state).not.toBeNull()
    expect(cancelled.accepted).toBe(true)
    expect(cancelled.state).toBeNull()
    expect(reset.accepted).toBe(true)
    expect(reset.state).toBeNull()
  })

  it('keeps events discriminated and does not mutate the begin input', () => {
    const event: ViewportInteractionEvent = { type: 'begin', gesture }
    const state = reduceViewportInteraction(null, event)

    expect(state).not.toBeNull()
    expect(state?.xDomain).toEqual([0, 100])
    expect(state?.yDomains.track).toEqual([-1, 1])
    expect(event.gesture.xDomain).toEqual([0, 100])
    expect(event.gesture.yDomains.track).toEqual([-1, 1])
  })
})
