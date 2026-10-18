export const clampProgress = (value: number) => Math.max(0, Math.min(1, value))

export function interpolateNumber(from: number, to: number, progress: number): number {
  return progress === 0 ? from : progress === 1 ? to : from * (1 - progress) + to * progress
}

export function entryClip(width: number, progress: number, direction: string) {
  const visible = width * clampProgress(progress)
  return {
    x:
      direction === 'right-to-left'
        ? width - visible
        : direction === 'center-out'
          ? (width - visible) / 2
          : 0,
    width: visible,
  }
}

/** Opacity clamps the result, preserving easing overshoot for other properties. */
export function fadeOpacity(from: number, to: number, progress: number): number {
  return clampProgress(interpolateNumber(from, to, progress))
}
