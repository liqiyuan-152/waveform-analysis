export interface PaginationItem {
  key: string
  page: number
  kind: 'page' | 'jump-prev' | 'jump-next'
}

export function paginationItems(current: number, total: number): PaginationItem[] {
  const page = (value: number): PaginationItem => ({
    key: String(value),
    page: value,
    kind: 'page',
  })
  if (total <= 7) return Array.from({ length: Math.max(0, total) }, (_, i) => page(i + 1))
  let left = Math.max(1, current - 2)
  let right = Math.min(total, current + 2)
  if (current <= 3) right = 5
  if (total - current <= 2) left = total - 4
  const items = Array.from({ length: right - left + 1 }, (_, i) => page(left + i))
  if (current >= 5) {
    items.unshift({ key: 'jump-prev', page: Math.max(1, current - 5), kind: 'jump-prev' })
  }
  if (total - current >= 4) {
    items.push({ key: 'jump-next', page: Math.min(total, current + 5), kind: 'jump-next' })
  }
  if (left !== 1) items.unshift(page(1))
  if (right !== total) items.push(page(total))
  return items
}
