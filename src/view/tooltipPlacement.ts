/** Container-based width cap avoids cursor-side shrink/flip feedback during measurement. */
export function tooltipPlacement(
  position: { x: number; y: number },
  size: { width: number; height: number },
  container: { width: number; height: number },
) {
  const gap = 20
  const padding = 8
  const right = position.x + gap
  const below = position.y + gap
  const x =
    right + size.width + 2 <= container.width - padding ? right : position.x - gap - size.width
  const y =
    below + size.height <= container.height - padding ? below : position.y - gap - size.height
  return {
    // Keep numeric left/top on both sides so flips can interpolate without auto values.
    left: `${Math.max(padding, Math.min(x, container.width - size.width - padding))}px`,
    right: '',
    maxWidth: `${Math.max(1, Math.min(560, container.width - padding * 2))}px`,
    visibility: size.width > 0 ? ('visible' as const) : ('hidden' as const),
    top: `${Math.max(padding, Math.min(y, container.height - size.height - padding))}px`,
  }
}
