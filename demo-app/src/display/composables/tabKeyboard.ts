/** Keep arrow/Home/End navigation when using Antd's click/Enter tab headers. */
export function tabKeyboard(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (target.getAttribute('role') !== 'tab') return
  const tabs = Array.from(
    (event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="tab"]'),
  )
  const index = tabs.indexOf(target)
  const next =
    event.key === 'ArrowRight'
      ? (index + 1) % tabs.length
      : event.key === 'ArrowLeft'
        ? (index + tabs.length - 1) % tabs.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? tabs.length - 1
            : -1
  if (index < 0 || next < 0) return
  event.preventDefault()
  tabs[next].click()
  tabs[next].focus()
}
