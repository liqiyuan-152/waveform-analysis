import type { ControlTheme } from 'waveform-analysis/input-number'

export interface ControlExample {
  setTheme(theme: ControlTheme): void
  dispose(): void
}
export type MountExample = (host: HTMLElement, report: (message: string) => void) => ControlExample

/** Own every native instance and DOM handler for one route. */
export function createExample(host: HTMLElement) {
  const controls: ControlExample[] = []
  const handlers: (() => void)[] = []
  const document = host.ownerDocument
  const section = (title: string, description: string) => {
    const root = document.createElement('section')
    root.className = 'control-example__card'
    const heading = document.createElement('h2')
    heading.textContent = title
    const text = document.createElement('p')
    text.textContent = description
    root.append(heading, text)
    host.append(root)
    return root
  }
  const own = <T extends ControlExample>(control: T): T => {
    controls.push(control)
    return control
  }
  const button = (parent: HTMLElement, label: string, action: () => void) => {
    const node = document.createElement('button')
    node.type = 'button'
    node.className = 'control-example__action'
    node.textContent = label
    node.onclick = action
    parent.append(node)
    handlers.push(() => {
      node.onclick = null
    })
    return node
  }
  return {
    document,
    section,
    own,
    button,
    setTheme(theme: ControlTheme) {
      controls.forEach((control) => control.setTheme(theme))
    },
    dispose() {
      handlers.splice(0).forEach((dispose) => dispose())
      controls
        .splice(0)
        .reverse()
        .forEach((control) => control.dispose())
      host.replaceChildren()
    },
  }
}
