/** Keeps visual transitions separate from modal focus, validation and business state. */
export class ModalMotion {
  private animation?: Animation
  private timer?: number
  private disposed = false
  private closing = false
  private readonly panel: HTMLElement

  constructor(private readonly dialog: HTMLDialogElement) {
    this.panel = dialog.querySelector<HTMLElement>('.waveform-modal__panel')!
    dialog.addEventListener('click', this.settle, true)
    dialog.addEventListener('keydown', this.settle, true)
  }

  get busy() {
    return this.closing
  }

  private get window() {
    return this.dialog.ownerDocument.defaultView!
  }

  private enabled() {
    return (
      typeof this.panel.animate === 'function' &&
      !this.window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  }

  enter() {
    if (this.disposed || !this.enabled()) return
    this.dialog.dataset.motion = 'enter'
    this.animation = this.panel.animate(
      [
        { opacity: 0, transform: 'scale(0.2)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: 300, easing: 'cubic-bezier(0.08, 0.82, 0.17, 1)' },
    )
    this.animation.onfinish = this.settle
  }

  // Settle on click, after hit testing, so pointerdown cannot move a button out from
  // under pointerup. Popup click handlers then read the final viewport coordinates.
  private readonly settle = () => {
    if (this.closing) return
    this.animation?.cancel()
    this.animation = undefined
    delete this.dialog.dataset.motion
  }

  close(action: () => void) {
    if (this.disposed || this.closing) return
    this.settle()
    if (!this.enabled()) {
      action()
      return
    }
    this.closing = true
    this.panel.inert = true
    this.dialog.setAttribute('aria-busy', 'true')
    this.dialog.dataset.motion = 'leave'
    const finish = () => {
      if (this.disposed || !this.closing) return
      this.window.clearTimeout(this.timer)
      this.timer = undefined
      this.animation?.cancel()
      this.animation = undefined
      this.closing = false
      this.panel.inert = false
      delete this.dialog.dataset.motion
      this.dialog.removeAttribute('aria-busy')
      action()
    }
    this.animation = this.panel.animate(
      [
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(0.2)' },
      ],
      { duration: 300, easing: 'cubic-bezier(0.78, 0.14, 0.15, 0.86)', fill: 'forwards' },
    )
    this.animation.onfinish = finish
    // A background tab or cancelled browser animation must not strand the modal.
    this.timer = this.window.setTimeout(finish, 350)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.window.clearTimeout(this.timer)
    this.animation?.cancel()
    this.animation = undefined
    this.dialog.removeEventListener('click', this.settle, true)
    this.dialog.removeEventListener('keydown', this.settle, true)
    delete this.dialog.dataset.motion
    this.dialog.removeAttribute('aria-busy')
    this.panel.inert = false
  }
}
