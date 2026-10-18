export function resolveTarget(
  target: string | HTMLElement,
  required = true,
): HTMLElement | undefined {
  let candidate: unknown = target
  if (typeof target === 'string') {
    if (!target.trim()) throw new Error('Waveform target must be a non-empty CSS selector')
    try {
      candidate = document.querySelector(target)
    } catch {
      throw new Error(`Invalid Waveform selector: ${target}`)
    }
    if (candidate === null && !required) return undefined
  }
  const element = candidate as HTMLElement | null | undefined
  const realm = element?.ownerDocument?.defaultView as
    (Window & typeof globalThis) | null | undefined
  if (!realm || !(element instanceof realm.HTMLElement))
    throw new Error('Waveform container must be an HTMLElement')
  return element
}
