/** Conservative Ant pagination sizing, including first/last pages and both ellipses. */
export function resolveCompactPaginationBand(
  visible: boolean,
  width: number,
  pageCount: number,
  timeLabelCenter: number,
  timeLabel: string,
): 0 | 16 | 40 {
  if (!visible) return 0
  if (width <= 520) return 40
  const controls = Math.min(pageCount, 9) + 2
  const paginationWidth = controls * 32 + controls * 8
  // A full 18px em per character also accommodates wide glyphs and Chinese labels.
  const labelRight = timeLabelCenter + (Array.from(timeLabel).length * 18) / 2
  const availableWidth = width - 10 - labelRight - 8
  return availableWidth >= paginationWidth ? 16 : 40
}
