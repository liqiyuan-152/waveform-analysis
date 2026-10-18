export interface TickLabelCandidate {
  text: string
  start: number
  end: number
  priority: boolean
  fits?: boolean
}

/** Selects labels without removing any numeric tick or grid value. */
export function visibleTickLabels(
  candidates: TickLabelCandidate[],
  low: number,
  high: number,
): Set<number> {
  const selected = new Set<number>()
  const labels = new Set<string>()
  const boxes: Array<[number, number]> = []
  const order = candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort(
      (a, b) =>
        Number(b.candidate.priority) - Number(a.candidate.priority) ||
        a.candidate.start - b.candidate.start,
    )
  for (const { candidate, index } of order) {
    if (
      candidate.fits === false ||
      candidate.start < low ||
      candidate.end > high ||
      labels.has(candidate.text)
    )
      continue
    if (boxes.some(([start, end]) => candidate.start < end + 4 && candidate.end + 4 > start))
      continue
    selected.add(index)
    labels.add(candidate.text)
    boxes.push([candidate.start, candidate.end])
  }
  return selected
}

export function estimateLabelWidth(text: string, fontSize: number): number {
  return Math.max(...text.split('\n').map((line) => Array.from(line).length * fontSize))
}
