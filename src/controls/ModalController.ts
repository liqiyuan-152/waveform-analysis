export interface ModalOptions {
  initialFocus: () => HTMLElement | undefined
  cancel: () => void
  dismissPopup?: () => boolean
}

interface Session {
  dialog: HTMLDialogElement
  focus: () => void
  previousFocus: HTMLElement | null
}

const lockedProperties = ['overflow', 'overflow-x', 'overflow-y', 'padding-right']

function focusable(element: HTMLElement | null | undefined): element is HTMLElement {
  return (
    !!element?.isConnected && !element.matches(':disabled') && !element.closest('[hidden], [inert]')
  )
}

/** One stack per document coordinates native and Vue consumers without crossing window realms. */
class ModalStack {
  private readonly sessions: Session[] = []
  private savedStyles: Array<{ name: string; value: string; priority: string }> = []

  constructor(private readonly document: Document) {}

  add(session: Session) {
    if (!this.sessions.length) {
      const body = this.document.body,
        window = this.document.defaultView
      this.savedStyles = Array.from({ length: body.style.length }, (_, index) =>
        body.style.item(index),
      )
        .filter((name) => lockedProperties.includes(name))
        .map((name) => ({
          name,
          value: body.style.getPropertyValue(name),
          priority: body.style.getPropertyPriority(name),
        }))
      const scrollbar = (window?.innerWidth ?? 0) - this.document.documentElement.clientWidth
      if (scrollbar > 0 && this.document.documentElement.clientWidth > 0) {
        const padding = Number.parseFloat(window?.getComputedStyle(body).paddingRight ?? '') || 0
        body.style.setProperty('padding-right', `${padding + scrollbar}px`, 'important')
      }
      body.style.setProperty('overflow', 'hidden', 'important')
    }
    this.sessions.push(session)
  }

  isTop(session: Session) {
    return this.sessions.at(-1) === session
  }

  remove(session: Session) {
    const index = this.sessions.indexOf(session)
    if (index < 0) return false
    const top = this.isTop(session)
    this.sessions.splice(index, 1)
    for (const other of this.sessions)
      if (other.previousFocus && session.dialog.contains(other.previousFocus))
        other.previousFocus = session.previousFocus
    if (!this.sessions.length) {
      const style = this.document.body.style
      for (const name of lockedProperties) style.removeProperty(name)
      for (const { name, value, priority } of this.savedStyles)
        style.setProperty(name, value, priority)
      this.savedStyles = []
    }
    return top
  }

  restore(session: Session) {
    const active = this.sessions.at(-1)
    if (
      focusable(session.previousFocus) &&
      (!active || active.dialog.contains(session.previousFocus))
    )
      session.previousFocus.focus({ preventScroll: true })
    else active?.focus()
  }
}

const stacks = new WeakMap<Document, ModalStack>()

/** Owns dialog listeners and guarantees rollback if entering the top layer fails. */
export class ModalController {
  private readonly document: Document
  private readonly stack: ModalStack
  private session?: Session
  private disposed = false
  private dismissing = false
  private pointerOnBackdrop = false

  constructor(
    private readonly dialog: HTMLDialogElement,
    private readonly options: ModalOptions,
  ) {
    this.document = dialog.ownerDocument
    let stack = stacks.get(this.document)
    if (!stack) {
      stack = new ModalStack(this.document)
      stacks.set(this.document, stack)
    }
    this.stack = stack
  }

  open() {
    if (this.disposed || this.session) return
    const active = this.document.activeElement as HTMLElement | null
    this.session = {
      dialog: this.dialog,
      focus: () => {
        if (this.disposed) return
        const target = this.options.initialFocus()
        if (this.disposed) return
        ;(focusable(target) && this.dialog.contains(target) ? target : this.dialog).focus({
          preventScroll: true,
        })
      },
      previousFocus: active?.nodeType === 1 && typeof active.focus === 'function' ? active : null,
    }
    this.stack.add(this.session)
    this.document.addEventListener('keydown', this.keydown, true)
    this.document.addEventListener('focusin', this.focusin, true)
    this.dialog.addEventListener('cancel', this.nativeCancel)
    this.dialog.addEventListener('pointerdown', this.pointerdown)
    this.dialog.addEventListener('click', this.click)
    try {
      this.dialog.showModal()
      this.session?.focus()
    } catch (error) {
      this.dispose()
      throw error
    }
  }

  private top() {
    return !!this.session && this.stack.isTop(this.session)
  }
  private cancel() {
    if (this.disposed || this.dismissing) return
    this.dismissing = true
    this.options.cancel()
  }
  private dismissPopup() {
    if (!this.options.dismissPopup?.()) return false
    // Teleported popup fields can be removed without a focusin event on the dialog.
    this.session?.focus()
    return true
  }
  private readonly keydown = (event: KeyboardEvent) => {
    if (!this.top() || this.disposed) return
    const target = event.target as Element | null
    const targetDialog = target?.nodeType === 1 ? target.closest('dialog') : null
    if (targetDialog && targetDialog !== this.dialog) return
    if (event.key === 'Tab') {
      const controls = [
        ...this.dialog.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, a[href], [tabindex]',
        ),
      ].filter(
        (element) =>
          element.tabIndex >= 0 &&
          !element.matches(':disabled') &&
          element.getClientRects().length > 0,
      )
      const index = controls.indexOf(this.document.activeElement as HTMLElement)
      const next =
        index < 0
          ? event.shiftKey
            ? controls.length - 1
            : 0
          : (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length
      event.preventDefault()
      if (controls[next]) controls[next].focus()
      else this.session?.focus()
      return
    }
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    if (!this.dismissPopup()) this.cancel()
  }
  private readonly nativeCancel = (event: Event) => {
    event.preventDefault()
    if (this.top() && !this.dismissPopup()) this.cancel()
  }
  private readonly pointerdown = (event: PointerEvent) => {
    this.pointerOnBackdrop = event.target === this.dialog
  }
  private readonly click = (event: MouseEvent) => {
    if (this.top() && this.pointerOnBackdrop && event.target === this.dialog) this.cancel()
    this.pointerOnBackdrop = false
  }
  private readonly focusin = (event: FocusEvent) => {
    if (this.top() && !this.dialog.contains(event.target as Node)) this.session?.focus()
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.document.removeEventListener('keydown', this.keydown, true)
    this.document.removeEventListener('focusin', this.focusin, true)
    this.dialog.removeEventListener('cancel', this.nativeCancel)
    this.dialog.removeEventListener('pointerdown', this.pointerdown)
    this.dialog.removeEventListener('click', this.click)
    const session = this.session
    this.session = undefined
    if (!session) return
    const wasTop = this.stack.remove(session)
    try {
      if (this.dialog.open) this.dialog.close()
    } finally {
      if (wasTop) this.stack.restore(session)
    }
  }
}
