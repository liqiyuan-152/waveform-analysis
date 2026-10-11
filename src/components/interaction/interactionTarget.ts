export function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        'button, input, select, textarea, [contenteditable]:not([contenteditable="false"])',
      ),
    )
  )
}
