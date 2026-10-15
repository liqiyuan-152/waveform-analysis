/** Container-based width cap avoids cursor-side shrink/flip feedback during measurement. */
export function tooltipPlacement(
  position: { x: number; y: number },
  size: { width: number; height: number },
  container: { width: number; height: number },
) {
  const gap = 12
  const padding = 8
  const right = position.x + gap
  const left = position.x - gap - size.width
  return {
    left:
      right + size.width <= container.width - padding
        ? `${right}px`
        : left >= padding
          ? ''
          : `${padding}px`,
    right:
      right + size.width > container.width - padding && left >= padding
        ? `${container.width - position.x + gap}px`
        : '',
    maxWidth: `${Math.max(1, Math.min(560, container.width - padding * 2))}px`,
    visibility: size.width > 0 ? ('visible' as const) : ('hidden' as const),
    top: `${Math.max(padding, Math.min(position.y - 18, container.height - size.height - padding))}px`,
  }
}
