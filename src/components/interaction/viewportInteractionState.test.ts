import { describe, expect, it } from 'vitest'

import { ViewportInteractionStateMachine } from './viewportInteractionState'

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

describe('ViewportInteractionStateMachine', () => {
  it('accepts one gesture and rejects a conflicting start', () => {
    const machine = new ViewportInteractionStateMachine()

    expect(machine.begin(gesture)).toBe(true)
    expect(machine.begin({ ...gesture, pointerId: 8 })).toBe(false)
    expect(machine.state).toMatchObject({ kind: 'box', pointerId: 7 })
  })

  it('rejects moves and completion from a different pointer', () => {
    const machine = new ViewportInteractionStateMachine()
    machine.begin(gesture)

    expect(machine.move(8, { currentX: 30, currentY: 40 })).toBeNull()
    expect(machine.finish(8, { currentX: 30, currentY: 40 })).toBeNull()
    expect(machine.state?.currentX).toBe(10)
  })

  it('updates a valid pointer, completes it, and returns to idle', () => {
    const machine = new ViewportInteractionStateMachine()
    machine.begin({ ...gesture, kind: 'pan' })

    expect(machine.move(7, { currentX: 30, currentY: 40 })).toMatchObject({
      kind: 'pan',
      currentX: 30,
      currentY: 40,
    })
    expect(machine.finish(7, { currentX: 50, currentY: 60 })).toMatchObject({
      kind: 'pan',
      currentX: 50,
      currentY: 60,
    })
    expect(machine.state).toBeNull()
  })

  it('only cancels the owning pointer and supports explicit reset', () => {
    const machine = new ViewportInteractionStateMachine()
    machine.begin(gesture)

    expect(machine.cancel(8)).toBe(false)
    expect(machine.state).not.toBeNull()
    expect(machine.cancel(7)).toBe(true)
    expect(machine.state).toBeNull()

    machine.begin(gesture)
    machine.reset()
    expect(machine.state).toBeNull()
  })

  it('returns defensive copies from its state getter', () => {
    const machine = new ViewportInteractionStateMachine()
    machine.begin(gesture)
    const snapshot = machine.state!
    snapshot.currentX = 99
    snapshot.xDomain[0] = 50
    snapshot.yDomains.track![0] = 50

    expect(machine.state).toMatchObject({ currentX: 10, xDomain: [0, 100] })
    expect(machine.state?.yDomains.track).toEqual([-1, 1])
  })
})
