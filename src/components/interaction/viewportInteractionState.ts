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

function cloneState(state: ViewportSelectionState | null): ViewportSelectionState | null {
  if (!state) return null
  return {
    ...state,
    xDomain: [...state.xDomain],
    yDomains: Object.fromEntries(
      Object.entries(state.yDomains).map(([key, domain]) => [key, [...domain] as [number, number]]),
    ),
  }
}

/** Owns the legal lifecycle of one active viewport pointer gesture. */
export class ViewportInteractionStateMachine {
  private current: ViewportSelectionState | null = null

  get state(): ViewportSelectionState | null {
    return cloneState(this.current)
  }

  begin(input: ViewportGestureStart): boolean {
    if (this.current) return false
    this.current = {
      ...input,
      currentX: input.startX,
      currentY: input.startY,
      xDomain: [...input.xDomain],
      yDomains: Object.fromEntries(
        Object.entries(input.yDomains).map(([key, domain]) => [
          key,
          [...domain] as [number, number],
        ]),
      ),
    }
    return true
  }

  move(pointerId: number, position: ViewportGesturePosition): ViewportSelectionState | null {
    if (!this.current || this.current.pointerId !== pointerId) return null
    this.current = { ...this.current, ...position }
    return this.state
  }

  finish(pointerId: number, position: ViewportGesturePosition): ViewportSelectionState | null {
    if (!this.current || this.current.pointerId !== pointerId) return null
    this.current = { ...this.current, ...position }
    const completed = this.state
    this.current = null
    return completed
  }

  cancel(pointerId?: number): boolean {
    if (!this.current || (pointerId !== undefined && this.current.pointerId !== pointerId)) {
      return false
    }
    this.current = null
    return true
  }

  reset(): void {
    this.current = null
  }
}
