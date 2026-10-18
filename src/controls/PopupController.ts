import { setControlTreeTheme, type ControlTheme, type ControlThemeOptions } from './theme'
let sequence = 0
const active = new WeakMap<Document, PopupController[]>()

/** A document-local popup, kept inside its dialog's top layer when applicable. */
export class PopupController {
  readonly panel: HTMLDivElement
  private observer?: ResizeObserver
  private visibility?: MutationObserver
  private disposed = false
  private opened = false

  constructor(
    protected readonly trigger: HTMLElement,
    className = '',
    protected readonly width = 240,
    protected readonly maxHeight = Number.POSITIVE_INFINITY,
    options: ControlThemeOptions = {},
  ) {
    this.panel = trigger.ownerDocument.createElement('div')
    this.panel.id = `waveform-popup-${++sequence}`
    this.panel.className = `waveform-control-theme waveform-popup ${className}`
    this.setTheme(options.theme)
    this.panel.hidden = true
    trigger.setAttribute('aria-controls', this.panel.id)
    trigger.setAttribute('aria-expanded', 'false')
    for (const name of ['pointerdown', 'click', 'dblclick', 'wheel', 'contextmenu', 'keydown'])
      this.panel.addEventListener(name, this.stop)
    this.panel.addEventListener('keydown', this.keydown)
    this.trigger.addEventListener('keydown', this.keydown)
    this.panel.addEventListener('pointerdown', this.focusButton)
  }

  static dismissWithin(root: HTMLElement) {
    const popup = active.get(root.ownerDocument)?.at(-1)
    if (!popup || !root.contains(popup.trigger)) return false
    popup.close(true)
    return true
  }

  get isOpen() {
    return this.opened
  }

  open() {
    if (this.disposed || this.opened || !this.trigger.isConnected) return
    const inherited = this.trigger.closest<HTMLElement>('[data-control-theme]')?.dataset
      .controlTheme as ControlTheme | undefined
    if (inherited) setControlTreeTheme(this.panel, inherited)
    const document = this.trigger.ownerDocument
    const stack = active.get(document) ?? []
    for (const popup of [...stack].reverse()) if (!popup.panel.contains(this.trigger)) popup.close()
    const host = this.getHost()
    host.append(this.panel)
    this.opened = true
    this.panel.hidden = false
    this.trigger.setAttribute('aria-expanded', 'true')
    active.set(document, [...(active.get(document) ?? []), this])
    document.addEventListener('pointerdown', this.outside, true)
    document.addEventListener('scroll', this.position, true)
    document.addEventListener('focusin', this.focusin)
    document.defaultView?.addEventListener('resize', this.position)
    const Observer = document.defaultView?.ResizeObserver
    if (Observer) {
      this.observer = new Observer(this.position)
      this.observer.observe(this.trigger)
      this.observer.observe(this.panel)
      this.observer.observe(host)
    }
    const Mutation = document.defaultView?.MutationObserver
    if (Mutation) {
      this.visibility = new Mutation(this.position)
      for (let node: HTMLElement | null = this.trigger; node; node = node.parentElement)
        this.visibility.observe(node, {
          attributes: true,
          attributeFilter: ['hidden', 'style', 'class'],
        })
    }
    document.defaultView?.visualViewport?.addEventListener('resize', this.position)
    document.defaultView?.visualViewport?.addEventListener('scroll', this.position)
    this.position()
  }

  close(focus = false) {
    if (!this.opened) return
    const document = this.trigger.ownerDocument
    const stack = active.get(document) ?? []
    const index = stack.indexOf(this)
    for (const popup of stack.slice(index + 1).reverse()) popup.close()
    this.opened = false
    this.panel.hidden = true
    this.panel.remove()
    this.trigger.setAttribute('aria-expanded', 'false')
    document.removeEventListener('pointerdown', this.outside, true)
    document.removeEventListener('scroll', this.position, true)
    document.removeEventListener('focusin', this.focusin)
    document.defaultView?.removeEventListener('resize', this.position)
    document.defaultView?.visualViewport?.removeEventListener('resize', this.position)
    document.defaultView?.visualViewport?.removeEventListener('scroll', this.position)
    this.visibility?.disconnect()
    this.visibility = undefined
    this.trigger.removeAttribute('aria-activedescendant')
    this.observer?.disconnect()
    this.observer = undefined
    active.set(
      document,
      (active.get(document) ?? []).filter((popup) => popup !== this),
    )
    if (focus && this.trigger.isConnected) this.trigger.focus({ preventScroll: true })
  }

  protected getHost(): Element {
    return (
      this.trigger.closest('.waveform-popup') ??
      this.trigger.closest('dialog') ??
      this.trigger.closest('.waveform-chart') ??
      this.trigger.parentElement!
    )
  }

  private readonly position = () => {
    if (!this.opened) return
    if (
      !this.trigger.isConnected ||
      this.trigger.closest('[hidden]') ||
      !this.trigger.getClientRects().length ||
      this.trigger.closest('.waveform-toolbar--collapsed')
    ) {
      this.close()
      return
    }
    const window = this.trigger.ownerDocument.defaultView!
    const viewport = window.visualViewport
    const left = viewport?.offsetLeft ?? 0,
      top = viewport?.offsetTop ?? 0
    const width = viewport?.width ?? window.innerWidth,
      height = viewport?.height ?? window.innerHeight
    const rect = this.trigger.getBoundingClientRect()
    if (rect.bottom < top || rect.top > top + height) {
      this.close()
      return
    }
    this.layout(rect, { left, top, width, height })
  }

  protected layout(
    rect: DOMRect,
    viewport: { left: number; top: number; width: number; height: number },
  ) {
    const { left, top, width, height } = viewport
    const panelWidth = Math.min(Math.max(this.width, rect.width), width - 16)
    this.panel.style.width = `${Math.max(0, panelWidth)}px`
    const gap = this.panel.classList.contains('waveform-color-popup') ? 12 : 4
    const below = top + height - rect.bottom - 12,
      above = rect.top - top - 12
    const flip = below < Math.min(this.maxHeight, this.panel.scrollHeight) && above > below
    this.panel.style.maxHeight = `${Math.max(0, Math.min(this.maxHeight, flip ? above : below))}px`
    this.panel.dataset.scroll = String(this.panel.scrollHeight > (flip ? above : below))
    const panelHeight = this.panel.getBoundingClientRect().height
    const panelLeft = Math.max(left + 8, Math.min(rect.left, left + width - panelWidth - 8))
    const panelTop = Math.max(top + 8, flip ? rect.top - panelHeight - gap : rect.bottom + gap)
    this.panel.style.left = `${panelLeft}px`
    this.panel.style.top = `${panelTop}px`
    this.panel.style.setProperty(
      '--waveform-popup-arrow-left',
      `${Math.max(10, Math.min(rect.left + rect.width / 2 - panelLeft - 6, panelWidth - 22))}px`,
    )
    this.panel.style.setProperty('--waveform-popup-arrow-top', `${flip ? panelHeight - 6 : -6}px`)
  }
  // WebKit does not focus buttons on pointer activation. Keep focus inside nested panels
  // before the preceding input blurs, otherwise the dialog receives focus and closes them.
  private readonly focusButton = (event: PointerEvent) => {
    if (event.button !== 0) return
    const button = (event.target as Element).closest<HTMLButtonElement>('button')
    if (button && !button.disabled) {
      event.preventDefault()
      button.focus({ preventScroll: true })
    }
  }
  private readonly focusin = (event: Event) => {
    if (!this.panel.contains(event.target as Node) && event.target !== this.trigger) this.close()
  }
  private readonly outside = (event: Event) => {
    const target = event.target as Node
    if (!this.panel.contains(target) && !this.trigger.contains(target)) this.close()
  }
  private readonly stop = (event: Event) => event.stopPropagation()
  private readonly keydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.opened) {
      event.preventDefault()
      this.close(true)
    }
  }

  setTheme(theme: ControlTheme = 'auto') {
    this.trigger.dataset.controlTheme = theme
    setControlTreeTheme(this.panel, theme)
  }

  dispose() {
    if (this.disposed) return
    this.close()
    this.disposed = true
    for (const name of ['pointerdown', 'click', 'dblclick', 'wheel', 'contextmenu', 'keydown'])
      this.panel.removeEventListener(name, this.stop)
    this.panel.removeEventListener('keydown', this.keydown)
    this.trigger.removeEventListener('keydown', this.keydown)
    this.panel.removeEventListener('pointerdown', this.focusButton)
    this.trigger.removeAttribute('aria-controls')
    this.panel.replaceChildren()
  }
}
