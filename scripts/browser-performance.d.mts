export function evaluateHoverTiming(
  sample: { samples: number[] },
  budget: { medianMs: number; p95Ms: number },
): string | undefined
