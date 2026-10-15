/** Owns menu focus, navigation and callbacks; detached controls cannot retain actions. */
export class AnnotationContextMenu {
  private node?: HTMLDivElement
  private previousFocus?: HTMLElement
  private disposed = false

  constructor(
    private readonly root: HTMLElement,
    private readonly closed: () => void = () => {},
  ) {}

  open(x: number, y: number, edit: () => void, remove: () => void) {
    this.close()
    if (this.disposed) return
    const document = this.root.ownerDocument
    const active = document.activeElement as HTMLElement | null
    this.previousFocus = active && typeof active.focus === 'function' ? active : undefined
    const node = document.createElement('div')
    node.className = 'waveform-annotation-context-menu'
    node.setAttribute('role', 'menu')
    node.setAttribute('aria-label', '标注操作')
    node.style.left = `${x}px`
    node.style.top = `${y}px`
    for (const [text, action] of [
      ['编辑标注', edit],
      ['删除标注', remove],
      ['取消', () => this.close()],
    ] as const) {
      const button = document.createElement('button')
      button.type = 'button'
      button.setAttribute('role', 'menuitem')
      button.textContent = text
      button.tabIndex = node.children.length ? -1 : 0
      button.onclick = () => {
        if (this.disposed || this.node !== node) return
        this.close()
        if (!this.disposed) action()
      }
      node.append(button)
    }
    this.node = node
    node.onkeydown = this.keydown
    this.root.append(node)
    document.addEventListener('pointerdown', this.outside, true)
    document.addEventListener('click', this.outside, true)
    node.querySelector('button')?.focus({ preventScroll: true })
  }

  private readonly outside = (event: Event) => {
    if (this.node && !this.node.contains(event.target as Node)) this.close()
  }

  private readonly keydown = (event: KeyboardEvent) => {
    if (!this.node) return
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      this.close()
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    const buttons = [...this.node.querySelectorAll('button')]
    const index = buttons.indexOf(this.root.ownerDocument.activeElement as HTMLButtonElement)
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
    for (const [position, button] of buttons.entries()) button.tabIndex = position === next ? 0 : -1
    buttons[next]?.focus({ preventScroll: true })
  }

  close() {
    const node = this.node
    if (!node) return
    this.node = undefined
    const document = this.root.ownerDocument
    const restore = node.contains(document.activeElement),
      previous = this.previousFocus
    this.previousFocus = undefined
    node.onkeydown = null
    for (const button of node.querySelectorAll('button')) button.onclick = null
    document.removeEventListener('pointerdown', this.outside, true)
    document.removeEventListener('click', this.outside, true)
    node.remove()
    this.closed()
    if (restore && previous?.isConnected && !previous.matches(':disabled, [inert]'))
      previous.focus({ preventScroll: true })
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.close()
  }
}
