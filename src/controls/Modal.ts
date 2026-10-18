import { ModalController } from './ModalController'
import { ModalMotion } from './ModalMotion'
import { PopupController } from './PopupController'
import { setControlTheme, type ControlTheme, type ControlThemeOptions } from './theme'
import { svgNode } from '../shared/dom/svg'

export interface ModalOptions extends ControlThemeOptions {
  title?: string
  initialFocus?: () => HTMLElement | undefined
  cancel?: () => void
}

let sequence = 0

/** Reusable dialog shell. Consumer content remains mounted between open sessions. */
export class Modal {
  readonly root: HTMLDialogElement
  readonly body: HTMLDivElement
  readonly footer: HTMLElement
  private readonly title: HTMLElement
  private readonly closeButton: HTMLButtonElement
  private controller?: ModalController
  private motion?: ModalMotion
  private disposed = false

  constructor(
    document: Document,
    private readonly options: ModalOptions = {},
  ) {
    this.root = document.createElement('dialog')
    this.root.className = 'waveform-control-theme waveform-modal-root'
    this.root.tabIndex = -1
    this.root.setAttribute('role', 'dialog')
    this.root.setAttribute('aria-modal', 'true')
    const container = document.createElement('div')
    container.className = 'waveform-modal'
    const panel = document.createElement('div')
    panel.className = 'waveform-modal__panel'
    const header = document.createElement('header')
    header.className = 'waveform-modal__header'
    this.title = document.createElement('span')
    this.title.id = `waveform-modal-title-${++sequence}`
    this.root.setAttribute('aria-labelledby', this.title.id)
    header.append(this.title)
    this.closeButton = document.createElement('button')
    this.closeButton.type = 'button'
    this.closeButton.className = 'waveform-modal__close'
    this.closeButton.setAttribute('aria-label', '关闭')
    const icon = svgNode(document, 'svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true' })
    icon.append(svgNode(document, 'path', { d: 'm3 3 10 10M13 3 3 13' }))
    this.closeButton.append(icon)
    this.closeButton.onclick = () => this.cancel()
    this.body = document.createElement('div')
    this.body.className = 'waveform-modal__body'
    this.footer = document.createElement('footer')
    this.footer.className = 'waveform-modal__footer'
    panel.append(header, this.closeButton, this.body, this.footer)
    container.append(panel)
    this.root.append(container)
    this.setTitle(options.title ?? '')
    this.setTheme(options.theme)
  }

  get busy() {
    return this.motion?.busy ?? false
  }
  get isOpen() {
    return !!this.controller
  }

  setTitle(title: string) {
    this.title.textContent = title
  }
  setTheme(theme: ControlTheme = 'auto') {
    setControlTheme(this.root, theme)
  }

  private cancel() {
    if (this.disposed || this.busy) return
    if (this.options.cancel) this.options.cancel()
    else this.close()
  }

  open() {
    if (this.disposed || this.controller) return
    if (!this.root.isConnected) this.root.ownerDocument.body.append(this.root)
    this.controller = new ModalController(this.root, {
      initialFocus: this.options.initialFocus ?? (() => this.closeButton),
      cancel: () => this.cancel(),
      repeatCancel: true,
      dismissPopup: () => PopupController.dismissWithin(this.root),
    })
    this.motion = new ModalMotion(this.root)
    try {
      this.controller.open()
      this.motion.enter()
    } catch (error) {
      this.endSession()
      throw error
    }
  }

  /** Allows business validation after the leave transition, before closing the session. */
  transitionClose(action: () => void) {
    if (this.disposed || this.busy || !this.motion) return
    PopupController.dismissWithin(this.root)
    this.motion.close(action)
  }

  close() {
    this.transitionClose(() => this.endSession())
  }

  private endSession() {
    while (PopupController.dismissWithin(this.root)) {
      /* Close nested floating panels first. */
    }
    this.motion?.dispose()
    this.motion = undefined
    this.controller?.dispose()
    this.controller = undefined
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.endSession()
    this.closeButton.onclick = null
    this.root.remove()
  }
}
