/** Keep compact chart height stable regardless of pagination width or page count. */
export function resolveCompactPaginationBand(visible: boolean): 0 | 16 {
  return visible ? 16 : 0
}
