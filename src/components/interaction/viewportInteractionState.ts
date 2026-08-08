import type { ViewportSelectionState } from '../core/waveformChartTypes'

export interface ViewportGestureStart {
  trackIndex: number
  independent: boolean
  startX: number
  startY: number
  pointerId: number
  kind: 'box' | 'pan'
  xDomain: [number, number]
  yDomains: Record<string, [number, number]>
}

export interface ViewportGesturePosition {
  currentX: number
  currentY: number
}

export type ViewportInteractionEvent =
  | { type: 'begin'; gesture: ViewportGestureStart }
  | { type: 'move'; pointerId: number; position: ViewportGesturePosition }
  | { type: 'finish'; pointerId: number; position: ViewportGesturePosition }
  | { type: 'cancel'; pointerId?: number }
  | { type: 'reset' }

export interface ViewportInteractionTransition {
  state: ViewportSelectionState | null
  accepted: boolean
  completed: ViewportSelectionState | null
}

function createSelectionState(input: ViewportGestureStart): ViewportSelectionState {
  return {
    ...input,
    currentX: input.startX,
    currentY: input.startY,
    xDomain: [...input.xDomain],
    yDomains: Object.fromEntries(
      Object.entries(input.yDomains).map(([key, domain]) => [key, [...domain] as [number, number]]),
    ),
  }
}

function withPosition(
  state: ViewportSelectionState,
  position: ViewportGesturePosition,
): ViewportSelectionState {
  return { ...state, ...position }
}

function rejectedTransition(state: ViewportSelectionState | null): ViewportInteractionTransition {
  return { state, accepted: false, completed: null }
}

export function transitionViewportInteraction(
  state: ViewportSelectionState | null,
  event: ViewportInteractionEvent,
): ViewportInteractionTransition {
  switch (event.type) {
    case 'begin':
      return state
        ? rejectedTransition(state)
        : { state: createSelectionState(event.gesture), accepted: true, completed: null }
    case 'move':
      if (!state || state.pointerId !== event.pointerId) return rejectedTransition(state)
      return { state: withPosition(state, event.position), accepted: true, completed: null }
    case 'finish':
      if (!state || state.pointerId !== event.pointerId) return rejectedTransition(state)
      return {
        state: null,
        accepted: true,
        completed: withPosition(state, event.position),
      }
    case 'cancel':
      if (!state || (event.pointerId !== undefined && state.pointerId !== event.pointerId)) {
        return rejectedTransition(state)
      }
      return { state: null, accepted: true, completed: null }
    case 'reset':
      return { state: null, accepted: true, completed: null }
  }
}

export function reduceViewportInteraction(
  state: ViewportSelectionState | null,
  event: ViewportInteractionEvent,
): ViewportSelectionState | null {
  return transitionViewportInteraction(state, event).state
}
