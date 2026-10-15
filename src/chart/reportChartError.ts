/** Reports user callback/cleanup errors without corrupting the chart's control flow. */
export function reportChartError(error: unknown) {
  if (typeof globalThis.reportError === 'function') globalThis.reportError(error)
  else console.error(error)
}
