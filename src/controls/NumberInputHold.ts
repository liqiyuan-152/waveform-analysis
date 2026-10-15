/** A press repeats after 600ms, then every 200ms, with document-local cancellation. */
export class NumberInputHold {
  private timer?: number
  private observer?: MutationObserver
  private pointer?: number
  private disposed = false
  private suppressClick = false

  constructor(
    private readonly root: HTMLElement,
    private readonly input: HTMLInputElement,
    private readonly step: (direction: 1 | -1, shift: boolean) => void,
  ) {}

  bind(button: HTMLButtonElement, direction: 1 | -1) {
    button.onpointerdown = (event) => {
      if (event.button !== 0 || button.disabled || this.input.readOnly || this.disposed) return
      event.preventDefault()
      this.stop()
      this.suppressClick = true
      this.pointer = event.pointerId
      this.input.focus({ preventScroll: true })
      this.listen()
      this.step(direction, event.shiftKey)
      const repeat = () => {
        if (!this.visible() || this.input.disabled || this.input.readOnly || this.disposed) {
          this.stop()
          return
        }
        this.step(direction, event.shiftKey)
        if (this.pointer !== undefined) this.timer = this.window.setTimeout(repeat, 200)
      }
      if (this.pointer !== undefined) this.timer = this.window.setTimeout(repeat, 600)
    }
    button.onpointerleave = this.stop
    button.onmousedown = (event) => event.preventDefault()
    button.onclick = (event) => {
      const pointerClick = event.detail !== 0 || ('pointerType' in event && !!event.pointerType)
      const suppressed = this.suppressClick && pointerClick
      this.suppressClick = false
      if (!suppressed && !this.disposed) this.step(direction, event.shiftKey)
    }
  }

  private get window() {
    return this.root.ownerDocument.defaultView!
  }

  private visible() {
    if (!this.root.isConnected || this.root.closest('[hidden], [inert]')) return false
    for (let node: HTMLElement | null = this.root; node; node = node.parentElement) {
      if (node.tagName === 'DIALOG' && !node.hasAttribute('open')) return false
      const style = this.window.getComputedStyle(node)
      if (style.display === 'none' || style.visibility === 'hidden') return false
    }
    return true
  }

  private listen() {
    const document = this.root.ownerDocument
    document.addEventListener('pointerup', this.release, true)
    document.addEventListener('pointercancel', this.release, true)
    document.addEventListener('visibilitychange', this.stop)
    this.input.addEventListener('blur', this.stop)
    this.window.addEventListener('blur', this.stop)
    this.observer = new this.window.MutationObserver(() => {
      if (!this.visible()) this.stop()
    })
    this.observer.observe(document.documentElement, { childList: true, subtree: true })
    for (let node: HTMLElement | null = this.root; node; node = node.parentElement)
      this.observer.observe(node, {
        attributes: true,
        attributeFilter: ['hidden', 'inert', 'open', 'style', 'class'],
      })
  }

  private readonly release = (event: PointerEvent) => {
    if (event.pointerId === this.pointer) this.stop()
  }

  readonly stop = () => {
    this.window.clearTimeout(this.timer)
    this.timer = undefined
    this.pointer = undefined
    this.observer?.disconnect()
    this.observer = undefined
    const document = this.root.ownerDocument
    document.removeEventListener('pointerup', this.release, true)
    document.removeEventListener('pointercancel', this.release, true)
    document.removeEventListener('visibilitychange', this.stop)
    this.input.removeEventListener('blur', this.stop)
    this.window.removeEventListener('blur', this.stop)
  }

  dispose() {
    this.disposed = true
    this.stop()
  }
}
