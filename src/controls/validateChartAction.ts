import type { WaveformChartAction } from '../types/native'
import { WaveformChartError } from '../chart/WaveformChartError'

const actionTypes = ['zoom-in', 'zoom-out', 'fit', 'reset', 'set-domain', 'set-mode']
const modes = ['zoom', 'pan', 'annotation', 'none']
function invalid(field: string): never {
  throw new WaveformChartError('invalid-option', `Invalid ${field}`, field)
}

/** Invalid action discriminants must fail before animation or viewport state changes. */
export function validateChartAction(value: unknown): asserts value is WaveformChartAction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('action')
  const action = value as Record<string, unknown>
  if (typeof action.type !== 'string' || !actionTypes.includes(action.type)) invalid('action.type')
  if (
    action.type === 'set-mode' &&
    (typeof action.mode !== 'string' || !modes.includes(action.mode))
  )
    invalid('action.mode')
}
