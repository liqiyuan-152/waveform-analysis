import { svgNode } from '../rendering/SvgDom'
import { PopupController } from './PopupController'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

/** Single-select combobox; DOM updates retain trigger focus and the current selection. */
export class SelectView {
  readonly root: HTMLDivElement
  readonly trigger: HTMLButtonElement
  private readonly caption: HTMLSpanElement
  private readonly popup: PopupController
  private options: readonly SelectOption[] = []
  private value = ''
  private index = -1
  private search = ''
  private lastTyped = 0
  private disposed = false
  private signature = ''

  constructor(
    document: Document,
    label: string,
    private readonly changed: (value: string) => void,
    variant: 'default' | 'compact' = 'default',
  ) {
    this.root = document.createElement('div')
    this.root.className = `waveform-control-theme waveform-select${variant === 'compact' ? ' waveform-select--compact' : ''}`
    this.trigger = document.createElement('button')
    this.trigger.type = 'button'
    this.trigger.className = 'waveform-select__trigger'
    this.trigger.setAttribute('role', 'combobox')
    this.trigger.setAttribute('aria-label', label)
    this.trigger.setAttribute('aria-haspopup', 'listbox')
    this.caption = document.createElement('span')
    const arrow = document.createElement('span')
    arrow.className = 'waveform-select__arrow'
    const icon = svgNode(document, 'svg', { viewBox: '0 0 12 12', focusable: 'false' })
    icon.append(svgNode(document, 'path', { d: 'm1 3 5 6 5-6' }))
    arrow.append(icon)
    arrow.setAttribute('aria-hidden', 'true')
    this.trigger.append(this.caption, arrow)
    this.root.append(this.trigger)
    this.popup = new PopupController(
      this.trigger,
      `waveform-select__popup${variant === 'compact' ? ' waveform-select__popup--compact' : ''}`,
      variant === 'compact' ? 68 : 0,
      264,
    )
    this.popup.panel.setAttribute('role', 'listbox')
    this.popup.panel.setAttribute('aria-label', label)
    this.trigger.onpointerdown = (event) => {
      if (event.button !== 0 || this.trigger.disabled) return
      event.preventDefault()
      this.trigger.focus({ preventScroll: true })
    }
    this.trigger.onclick = () => {
      if (this.disposed) return
      if (this.popup.isOpen) this.popup.close()
      else this.open()
    }
    this.trigger.addEventListener('keydown', this.keydown)
    this.trigger.addEventListener('blur', this.blur)
    for (const name of ['pointerdown', 'click', 'dblclick', 'wheel', 'contextmenu'])
      this.root.addEventListener(name, this.stop)
  }

  update(
    options: readonly SelectOption[],
    value: string,
    disabled = false,
    placeholder = '请选择',
  ) {
    if (this.disposed) return
    const signature = JSON.stringify([options, value])
    this.options = options
    this.value = value
    this.trigger.value = value
    this.trigger.disabled = disabled
    const selected = options.find((option) => option.value === value)
    this.caption.textContent = selected?.label ?? placeholder
    this.caption.title = selected?.label ?? placeholder
    this.trigger.title = this.caption.title
    this.trigger.classList.toggle('is-placeholder', !selected)
    if (disabled || !options.length) this.popup.close()
    if (signature !== this.signature) {
      this.signature = signature
      this.index = options.findIndex((option) => option.value === value && !option.disabled)
      this.render()
    }
  }

  close() {
    this.popup.close()
  }

  private open() {
    if (!this.options.length || this.disposed) return
    this.index = this.options.findIndex((option) => option.value === this.value && !option.disabled)
    if (this.index < 0) this.index = this.options.findIndex((option) => !option.disabled)
    this.render()
    this.search = ''
    this.popup.open()
    this.highlight()
  }

  private render() {
    this.popup.panel.replaceChildren(
      ...this.options.map((option, index) => {
        const node = this.root.ownerDocument.createElement('div')
        node.id = `${this.popup.panel.id}-${index}`
        node.className = 'waveform-select__option'
        node.setAttribute('role', 'option')
        node.setAttribute('aria-selected', String(option.value === this.value))
        node.setAttribute('aria-disabled', String(!!option.disabled))
        const label = this.root.ownerDocument.createElement('span')
        label.textContent = option.label
        node.title = option.label
        node.append(label)
        node.onpointerdown = (event) => event.preventDefault()
        node.onpointermove = () => {
          if (!option.disabled) {
            this.index = index
            this.highlight()
          }
        }
        node.onclick = () => this.choose(index)
        return node
      }),
    )
    this.highlight()
  }

  private highlight() {
    const nodes = this.popup.panel.children
    for (let i = 0; i < nodes.length; i++) nodes[i].classList.toggle('is-active', i === this.index)
    if (this.popup.isOpen && this.index >= 0) {
      this.trigger.setAttribute('aria-activedescendant', `${this.popup.panel.id}-${this.index}`)
      if (this.popup.isOpen)
        (nodes[this.index] as HTMLElement)?.scrollIntoView?.({ block: 'nearest' })
    } else this.trigger.removeAttribute('aria-activedescendant')
  }

  private choose(index: number) {
    const option = this.options[index]
    if (this.disposed || !option || option.disabled) return
    this.popup.close(true)
    if (option.value !== this.value) this.changed(option.value)
  }
  private readonly stop = (event: Event) => event.stopPropagation()
  private readonly blur = () => this.popup.close()
  private readonly keydown = (event: KeyboardEvent) => {
    if (this.disposed || this.trigger.disabled) return
    event.stopPropagation()
    if (event.isComposing) return
    if (event.key === 'Tab') {
      if (this.popup.isOpen) {
        event.preventDefault()
        event.stopPropagation()
        this.choose(this.index)
        this.popup.close(true)
      }
      return
    }
    if (event.key === 'Escape') {
      if (this.popup.isOpen) {
        event.preventDefault()
        event.stopPropagation()
        this.popup.close(true)
      }
      return
    }
    if (['Enter', ' '].includes(event.key)) {
      event.preventDefault()
      if (this.popup.isOpen) {
        this.choose(this.index)
        this.popup.close(true)
      } else this.open()
      return
    }
    const enabled = this.options
      .map((option, index) => (option.disabled ? -1 : index))
      .filter((i) => i >= 0)
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      if (!this.popup.isOpen) {
        this.open()
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') return
      }
      const current = enabled.indexOf(this.index)
      this.index =
        event.key === 'Home'
          ? (enabled[0] ?? -1)
          : event.key === 'End'
            ? (enabled.at(-1) ?? -1)
            : (enabled[
                (current + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length
              ] ?? -1)
      this.highlight()
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      if (!this.popup.isOpen) this.open()
      const now = Date.now()
      this.search = (now - this.lastTyped > 500 ? '' : this.search) + event.key.toLocaleLowerCase()
      this.lastTyped = now
      const matches = enabled.filter((i) =>
        this.options[i].label.toLocaleLowerCase().startsWith(this.search),
      )
      if (matches.length) this.index = matches[0]
      this.highlight()
    }
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.popup.dispose()
    this.trigger.onclick = this.trigger.onpointerdown = null
    this.trigger.removeEventListener('keydown', this.keydown)
    this.trigger.removeEventListener('blur', this.blur)
    for (const name of ['pointerdown', 'click', 'dblclick', 'wheel', 'contextmenu'])
      this.root.removeEventListener(name, this.stop)
    this.root.remove()
  }
}
