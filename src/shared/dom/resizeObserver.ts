/** Resolve observers in the host realm, including iframe documents. */
export function createResizeObserver(
  host: HTMLElement,
  callback: ResizeObserverCallback,
): ResizeObserver | undefined {
  const Observer = (host.ownerDocument.defaultView as (Window & typeof globalThis) | null)
    ?.ResizeObserver
  return Observer ? new Observer(callback) : undefined
}
