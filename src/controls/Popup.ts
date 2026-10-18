import { PopupController } from './PopupController'
import { placePopup, type PopupPlacement } from './popupPlacement'
import type { ControlThemeOptions } from './theme'

export type PopupTrigger = 'hover' | 'click' | 'focus'
export interface PopupOptions extends ControlThemeOptions {
  title?: string | HTMLElement
  content?: string | HTMLElement
  placement?: PopupPlacement
  trigger?: PopupTrigger | PopupTrigger[]
  arrow?: boolean
  autoAdjustOverflow?: boolean
  mouseEnterDelay?: number
  mouseLeaveDelay?: number
  width?: number
  maxHeight?: number
  className?: string
  onOpenChange?: (open: boolean) => void
}

/** Native Popover with Ant Design-style triggers, placement and presentation. */
export class Popup extends PopupController {
  readonly title: HTMLDivElement
  readonly content: HTMLDivElement
  private readonly options: PopupOptions
  private readonly cleanups: (() => void)[] = []
  private timer?: ReturnType<typeof setTimeout>
  private destroyed = false
  private restoringFocus = false

  constructor(trigger: HTMLElement, options?: PopupOptions)
  /** Compatibility signature: manual trigger, with the new popover presentation. */
  constructor(
    trigger: HTMLElement,
    className?: string,
    width?: number,
    maxHeight?: number,
    options?: PopupOptions,
  )
  constructor(
    trigger: HTMLElement,
    config: PopupOptions | string = {},
    width = 240,
    maxHeight = Infinity,
    legacy: PopupOptions = {},
  ) {
    const options =
      typeof config === 'string' ? { ...legacy, className: config, width, maxHeight } : config
    super(
      trigger,
      `waveform-popover ${options.className ?? ''}`,
      options.width ?? 240,
      options.maxHeight ?? Infinity,
      options,
    )
    this.options = options
    this.panel.dataset.arrow = String(options.arrow !== false)
    this.panel.setAttribute('role', 'dialog')
    this.title = trigger.ownerDocument.createElement('div')
    this.title.className = 'waveform-popover__title'
    this.title.id = `${this.panel.id}-title`
    this.content = trigger.ownerDocument.createElement('div')
    this.content.className = 'waveform-popover__content'
    this.panel.append(this.title, this.content)
    this.setTitle(options.title)
    this.setContent(options.content)
    const modes = options.trigger ?? (typeof config === 'string' ? [] : 'hover')
    const triggers = Array.isArray(modes) ? modes : [modes]
    if (triggers.includes('hover')) {
      for (const node of [trigger, this.panel]) {
        this.listen(node, 'mouseenter', () => this.schedule(true))
        this.listen(node, 'mouseleave', () => this.schedule(false))
      }
    }
    if (triggers.includes('click'))
      this.listen(trigger, 'click', () => (this.isOpen ? this.close() : this.open()))
    if (triggers.includes('focus'))
      this.listen(trigger, 'focusin', () => {
        if (!this.restoringFocus) this.open()
      })
  }

  setTitle(value?: string | HTMLElement) {
    this.title.replaceChildren(...(value == null ? [] : [value]))
    this.title.hidden = value == null || value === ''
    if (this.title.hidden) this.panel.removeAttribute('aria-labelledby')
    else this.panel.setAttribute('aria-labelledby', this.title.id)
  }

  setContent(value?: string | HTMLElement) {
    this.content.replaceChildren(...(value == null ? [] : [value]))
  }

  private listen(node: HTMLElement, name: string, callback: () => void) {
    node.addEventListener(name, callback)
    this.cleanups.push(() => node.removeEventListener(name, callback))
  }

  private schedule(open: boolean) {
    clearTimeout(this.timer)
    const delay = open ? this.options.mouseEnterDelay : this.options.mouseLeaveDelay
    this.timer = setTimeout(
      () => (open ? this.open() : this.close()),
      Math.max(0, delay ?? 0.1) * 1000,
    )
  }

  override open() {
    clearTimeout(this.timer)
    const previous = this.isOpen
    super.open()
    if (this.isOpen && !previous) this.options.onOpenChange?.(true)
  }

  override close(focus = false) {
    clearTimeout(this.timer)
    const previous = this.isOpen
    this.restoringFocus = focus
    super.close(focus)
    this.restoringFocus = false
    if (previous) this.options.onOpenChange?.(false)
  }

  protected override getHost(): Element {
    return (
      this.trigger.closest('.waveform-popup') ??
      this.trigger.closest('dialog') ??
      this.trigger.ownerDocument.body
    )
  }

  protected override layout(
    rect: DOMRect,
    viewport: { left: number; top: number; width: number; height: number },
  ) {
    this.panel.style.width = `${Math.max(0, Math.min(this.width, viewport.width - 16))}px`
    this.content.style.maxHeight = `${Math.max(0, Math.min(this.maxHeight, viewport.height - 80))}px`
    const size = this.panel.getBoundingClientRect()
    let result = placePopup(
      rect,
      size,
      viewport,
      this.options.placement ?? 'top',
      this.options.arrow === false ? 8 : 12,
      this.options.autoAdjustOverflow !== false,
    )
    if (this.options.autoAdjustOverflow !== false && ['top', 'bottom'].includes(result.side)) {
      const gap = this.options.arrow === false ? 8 : 12
      const available =
        result.side === 'top'
          ? rect.top - viewport.top - gap - 8
          : viewport.top + viewport.height - rect.bottom - gap - 8
      const chrome = size.height - this.content.getBoundingClientRect().height
      this.content.style.maxHeight = `${Math.max(0, Math.min(this.maxHeight, available - chrome))}px`
      result = placePopup(
        rect,
        this.panel.getBoundingClientRect(),
        viewport,
        result.placement as PopupPlacement,
        gap,
        true,
      )
    }
    this.panel.style.left = `${result.x}px`
    this.panel.style.top = `${result.y}px`
    this.panel.dataset.placement = result.placement
    this.panel.dataset.side = result.side
    this.panel.style.setProperty('--popover-arrow-x', `${result.arrowX}px`)
    this.panel.style.setProperty('--popover-arrow-y', `${result.arrowY}px`)
  }

  override dispose() {
    if (this.destroyed) return
    this.destroyed = true
    clearTimeout(this.timer)
    this.cleanups.splice(0).forEach((cleanup) => cleanup())
    super.dispose()
  }
}
