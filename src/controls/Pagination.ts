import { paginationItems } from '../components/controls/pagination'
import { setControlTheme, type ControlTheme, type ControlThemeOptions } from './theme'

export interface PaginationState {
  page: number
  pageCount: number
  visible?: boolean
  disabled?: boolean
}
import { setSvgAttributes, svgNode } from '../shared/dom/svg'

/** Stable buttons preserve keyboard focus while the visible page window changes. */
export class Pagination {
  readonly root: HTMLElement
  private readonly buttons = new Map<string, HTMLButtonElement>()
  private disposed = false
  private page = 1
  private count = 1

  constructor(
    parent: HTMLElement,
    private readonly change: (page: number) => void,
    options: ControlThemeOptions = {},
  ) {
    this.root = parent.ownerDocument.createElement('nav')
    this.root.className = 'waveform-control-theme waveform-pagination'
    this.root.setAttribute('aria-label', '分页')
    this.setTheme(options.theme)
    parent.append(this.root)
  }

  update(layout: PaginationState) {
    if (this.disposed) return
    this.count = Number.isFinite(layout.pageCount) ? Math.max(1, Math.floor(layout.pageCount)) : 1
    this.page = Number.isFinite(layout.page)
      ? Math.max(1, Math.min(this.count, Math.floor(layout.page)))
      : 1
    this.root.hidden = layout.visible === false
    this.root.style.display = layout.visible === false ? 'none' : ''
    if (layout.visible === false) return
    const pages = paginationItems(this.page, this.count)
    const items = [
      { key: 'prev', page: this.page - 1, kind: 'prev' },
      ...pages,
      { key: 'next', page: this.page + 1, kind: 'next' },
    ]
    const active = new Set(items.map((item) => item.key))
    for (const [key, button] of this.buttons)
      if (!active.has(key)) {
        button.onclick = null
        button.remove()
        this.buttons.delete(key)
      }
    let previous: HTMLButtonElement | undefined
    items.forEach((item, index) => {
      let button = this.buttons.get(item.key)
      if (!button) {
        button = this.root.ownerDocument.createElement('button')
        button.type = 'button'
        this.buttons.set(item.key, button)
      }
      const jump = item.kind === 'jump-prev' || item.kind === 'jump-next'
      button.className = jump ? 'waveform-pagination__jump' : ''
      button.classList.toggle(
        'waveform-pagination__window-edge',
        item.kind === 'page' &&
          (items[index - 1]?.kind === 'jump-prev' || items[index + 1]?.kind === 'jump-next'),
      )
      button.setAttribute(
        'aria-label',
        item.kind === 'prev'
          ? '上一页'
          : item.kind === 'next'
            ? '下一页'
            : item.kind === 'page'
              ? `第 ${item.page} 页`
              : item.kind === 'jump-prev'
                ? '向前 5 页'
                : '向后 5 页',
      )
      if (item.kind === 'page' && item.page === this.page)
        button.setAttribute('aria-current', 'page')
      else button.removeAttribute('aria-current')
      button.disabled = !!layout.disabled || item.page < 1 || item.page > this.count
      button.onclick = (event) => {
        event.stopPropagation()
        if (!button.disabled && item.page !== this.page) this.change(item.page)
      }
      if (item.kind === 'page') button.textContent = String(item.page)
      else if (!button.firstChild) {
        if (jump) {
          const dots = this.root.ownerDocument.createElement('span')
          dots.className = 'waveform-pagination__dots'
          dots.setAttribute('aria-hidden', 'true')
          dots.textContent = '•••'
          button.append(dots)
        }
        const icon = svgNode(this.root.ownerDocument, 'svg', {
          viewBox: '0 0 16 16',
          'aria-hidden': 'true',
        })
        setSvgAttributes(icon, { class: item.kind === 'jump-prev' ? 'is-prev' : '' })
        icon.append(
          svgNode(this.root.ownerDocument, 'path', {
            d: jump
              ? 'm3 3 5 5-5 5m5-10 5 5-5 5'
              : item.kind === 'prev'
                ? 'm10 3-5 5 5 5'
                : 'm6 3 5 5-5 5',
          }),
        )
        button.append(icon)
      }
      const next = previous ? previous.nextSibling : this.root.firstChild
      if (next !== button) this.root.insertBefore(button, next)
      previous = button
    })
  }

  setTheme(theme: ControlTheme = 'auto') {
    setControlTheme(this.root, theme)
  }

  dispose() {
    this.disposed = true
    for (const button of this.buttons.values()) button.onclick = null
    this.buttons.clear()
    this.root.remove()
  }
}
