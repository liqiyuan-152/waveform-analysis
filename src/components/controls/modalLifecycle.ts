interface ModalOptions {
  initialFocus: () => HTMLElement | undefined
  cancel: () => void
  dismissPopup?: () => boolean
}

interface ModalSession {
  dialog: HTMLDialogElement
  focus: () => void
  previousFocus: HTMLElement | null
}
const sessions: ModalSession[] = []
let savedOverflow = ''
let savedPaddingRight = ''

// Native dialog supplies the top layer and inert background. Explicit Tab boundaries
// keep keyboard focus consistent across browsers, including nested dialogs.
export function mountModal(dialog: HTMLDialogElement, options: ModalOptions): () => void {
  const document = dialog.ownerDocument
  const body = document.body
  const previousFocus =
    document.activeElement instanceof HTMLElement ? document.activeElement : null
  const focus = () => (options.initialFocus() ?? dialog).focus({ preventScroll: true })
  const session: ModalSession = { dialog, focus, previousFocus }
  if (sessions.length === 0) {
    savedOverflow = body.style.overflow
    savedPaddingRight = body.style.paddingRight
    const scrollbar = (document.defaultView?.innerWidth ?? 0) - document.documentElement.clientWidth
    if (scrollbar > 0 && document.documentElement.clientWidth > 0) {
      body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight) + scrollbar}px`
    }
    body.style.overflow = 'hidden'
  }
  sessions.push(session)
  dialog.showModal()
  focus()
  let dismissing = false
  const cancel = () => {
    if (dismissing) return
    dismissing = true
    options.cancel()
  }
  const keydown = (event: KeyboardEvent) => {
    if (sessions.at(-1) !== session) return
    const targetDialog = event.target instanceof Element ? event.target.closest('dialog') : null
    if (targetDialog && targetDialog !== dialog) return
    if (event.key === 'Tab') {
      const controls = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, a[href], [tabindex]',
        ),
      ).filter(
        (element) =>
          element.tabIndex >= 0 &&
          !element.matches(':disabled') &&
          element.getClientRects().length > 0,
      )
      const index = controls.indexOf(document.activeElement as HTMLElement)
      const next =
        index < 0
          ? event.shiftKey
            ? controls.length - 1
            : 0
          : (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length
      event.preventDefault()
      if (controls[next]) controls[next].focus()
      else focus()
      return
    }
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    if (!options.dismissPopup?.()) cancel()
  }
  const nativeCancel = (event: Event) => {
    event.preventDefault()
    if (!options.dismissPopup?.()) cancel()
  }
  let pointerOnBackdrop = false
  const pointerdown = (event: PointerEvent) => {
    pointerOnBackdrop = event.target === dialog
  }
  const click = (event: MouseEvent) => {
    if (pointerOnBackdrop && event.target === dialog) cancel()
    pointerOnBackdrop = false
  }
  const focusin = (event: FocusEvent) => {
    if (sessions.at(-1) === session && !dialog.contains(event.target as Node)) focus()
  }
  document.addEventListener('keydown', keydown, true)
  document.addEventListener('focusin', focusin, true)
  dialog.addEventListener('cancel', nativeCancel)
  dialog.addEventListener('pointerdown', pointerdown)
  dialog.addEventListener('click', click)

  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    document.removeEventListener('keydown', keydown, true)
    document.removeEventListener('focusin', focusin, true)
    dialog.removeEventListener('cancel', nativeCancel)
    dialog.removeEventListener('pointerdown', pointerdown)
    dialog.removeEventListener('click', click)
    const wasTop = sessions.at(-1) === session
    sessions.splice(sessions.indexOf(session), 1)
    // A later modal may have been opened from this one. Do not restore into a removed dialog.
    for (const other of sessions) {
      if (other.previousFocus && dialog.contains(other.previousFocus)) {
        other.previousFocus = session.previousFocus
      }
    }
    dialog.close()
    if (sessions.length === 0) {
      body.style.overflow = savedOverflow
      body.style.paddingRight = savedPaddingRight
    }
    if (wasTop) {
      const active = sessions.at(-1)
      if (active) active.focus()
      else if (session.previousFocus?.isConnected)
        session.previousFocus.focus({ preventScroll: true })
    }
  }
}
