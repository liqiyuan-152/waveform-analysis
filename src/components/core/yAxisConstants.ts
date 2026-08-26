export const Y_AXIS_CHARACTER_WIDTH = 7
export const Y_AXIS_TICK_PADDING = 7
export const Y_AXIS_OUTER_PADDING = 4
export const Y_AXIS_LABEL_GAP = 0
export const Y_AXIS_LABEL_BAND_WIDTH = 12

export function resolveYAxisSides(axisCount: number): Array<'left' | 'right'> {
  if (axisCount >= 4) return ['left', 'left', 'right', 'right']
  if (axisCount === 3) return ['left', 'right', 'right']
  if (axisCount === 2) return ['left', 'right']
  return ['left']
}
