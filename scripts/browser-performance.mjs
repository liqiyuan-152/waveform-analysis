/** Absolute tolerances absorb timer quantization/runner noise; baselines are never rewritten here. */
export function evaluateHoverTiming(sample, budget) {
  if (!budget || !Number.isFinite(budget.medianMs) || !Number.isFinite(budget.p95Ms))
    throw new Error('Missing or invalid locked hover budget')
  if (
    sample.samples.length !== 20 ||
    sample.samples.some((value) => !Number.isFinite(value) || value < 0)
  )
    throw new Error('Missing or invalid hover measurements')
  const sorted = [...sample.samples].sort((a, b) => a - b)
  const medianMs = sorted[10]
  const p95Ms = sorted[18]
  return medianMs > budget.medianMs || p95Ms > budget.p95Ms
    ? `Hover timing exceeded budget: median=${medianMs}/${budget.medianMs}, p95=${p95Ms}/${budget.p95Ms}`
    : undefined
}
