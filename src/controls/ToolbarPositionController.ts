import type { ChartLayoutSnapshot } from '../layout/ChartLayoutEngine'
import type { resolveToolbar } from '../components/controls/toolbarRegistry'

/** DOM measurement belongs to the native view lifecycle, including menu and pagination changes. */
export class ToolbarPositionController {
  private observer?: ResizeObserver
  private layout?: ChartLayoutSnapshot
  private config?: ReturnType<typeof resolveToolbar>

  constructor(
    private readonly root: HTMLElement,
    private readonly menu: HTMLElement,
  ) {}

  update(layout: ChartLayoutSnapshot, config: ReturnType<typeof resolveToolbar>) {
    this.layout = layout
    this.config = config
    this.observer?.disconnect()
    if (!config.visible) return
    const Observer = this.root.ownerDocument.defaultView?.ResizeObserver
    if (!this.observer && Observer) this.observer = new Observer(() => this.position())
    this.observer?.observe(this.root)
    this.observer?.observe(this.menu)
    const pagination = this.root.parentElement?.querySelector('.waveform-chart__pagination')
    if (pagination) this.observer?.observe(pagination)
    this.position()
  }

  private position() {
    if (!this.layout || !this.config) return
    const c = this.layout
    const options = this.config
    const pagination = this.root.parentElement?.querySelector<HTMLElement>(
      '.waveform-chart__pagination',
    )
    const top = c.titleHeight + 2
    const bottom = c.paginationVisible ? (pagination?.offsetHeight || 32) + 8 : 2
    const availableHeight = Math.max(0, c.height - top - bottom)
    const atBottom = options.position.startsWith('bottom')
    const atLeft = options.position.endsWith('left')
    const menuWidth = this.menu.hidden ? 0 : this.menu.offsetWidth
    const menuHeight = this.menu.hidden ? 0 : this.menu.offsetHeight
    const x = Math.max(
      0,
      2 +
        Math.min(
          atLeft ? options.offsetX : -options.offsetX,
          Math.max(0, c.width - Math.max(this.root.offsetWidth, menuWidth) - 4),
        ),
    )
    const y = Math.min(
      atBottom ? -options.offsetY : options.offsetY,
      Math.max(0, availableHeight - this.root.offsetHeight - menuHeight),
    )
    Object.assign(this.root.style, {
      left: atLeft ? `${x}px` : 'auto',
      right: atLeft ? 'auto' : `${x}px`,
      top: atBottom ? 'auto' : `${Math.max(0, top + y)}px`,
      bottom: atBottom ? `${Math.max(0, bottom + y)}px` : 'auto',
      maxHeight: `${availableHeight}px`,
    })
  }

  dispose() {
    this.observer?.disconnect()
  }
}
