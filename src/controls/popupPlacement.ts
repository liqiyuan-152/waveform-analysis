export type PopupPlacement =
  | 'top'
  | 'topLeft'
  | 'topRight'
  | 'bottom'
  | 'bottomLeft'
  | 'bottomRight'
  | 'left'
  | 'leftTop'
  | 'leftBottom'
  | 'right'
  | 'rightTop'
  | 'rightBottom'

export function placePopup(
  rect: DOMRect,
  size: { width: number; height: number },
  viewport: { left: number; top: number; width: number; height: number },
  placement: PopupPlacement,
  gap: number,
  adjust: boolean,
) {
  let side = placement.match(/^(top|bottom|left|right)/)![0]
  const edge = placement.slice(side.length)
  const vertical = side === 'top' || side === 'bottom'
  const space: Record<string, number> = {
    top: rect.top - viewport.top - 8,
    bottom: viewport.top + viewport.height - rect.bottom - 8,
    left: rect.left - viewport.left - 8,
    right: viewport.left + viewport.width - rect.right - 8,
  }
  const opposite: Record<string, string> = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
  }
  const needed = (vertical ? size.height : size.width) + gap
  if (adjust && space[side]! < needed && space[opposite[side]!]! > space[side]!)
    side = opposite[side]!
  let x = rect.left + (rect.width - size.width) / 2
  let y = rect.top + (rect.height - size.height) / 2
  if (vertical) {
    y = side === 'top' ? rect.top - size.height - gap : rect.bottom + gap
    if (edge === 'Left') x = rect.left
    if (edge === 'Right') x = rect.right - size.width
  } else {
    x = side === 'left' ? rect.left - size.width - gap : rect.right + gap
    if (edge === 'Top') y = rect.top
    if (edge === 'Bottom') y = rect.bottom - size.height
  }
  // Like Popover, centered placements shift; edge-aligned placements only flip.
  if (adjust && !edge) {
    if (vertical)
      x = Math.max(viewport.left + 8, Math.min(x, viewport.left + viewport.width - size.width - 8))
    else
      y = Math.max(viewport.top + 8, Math.min(y, viewport.top + viewport.height - size.height - 8))
  }
  return {
    x,
    y,
    side,
    placement: side + edge,
    arrowX: Math.max(12, Math.min(rect.left + rect.width / 2 - x, size.width - 12)),
    arrowY: Math.max(12, Math.min(rect.top + rect.height / 2 - y, size.height - 12)),
  }
}
