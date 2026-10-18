export type ControlTheme = 'auto' | 'light' | 'dark'

export interface ControlThemeOptions {
  theme?: ControlTheme
}

/** CSS resolves auto without global listeners or browser access during module import. */
export function setControlTheme(root: HTMLElement, theme: ControlTheme = 'auto') {
  root.dataset.controlTheme = theme
}

/** Composite-owned controls share the same theme, including mounted popup panels. */
export function setControlTreeTheme(root: HTMLElement, theme: ControlTheme = 'auto') {
  setControlTheme(root, theme)
  root.querySelectorAll<HTMLElement>('[data-control-theme]').forEach((node) => {
    setControlTheme(node, theme)
  })
}
