export function tryReleasePointerCapture(
  target: SVGRectElement | null | undefined,
  pointerId: number,
): void {
  try {
    target?.releasePointerCapture?.(pointerId)
  } catch {
    // The target may already be detached or have released the pointer.
  }
}
