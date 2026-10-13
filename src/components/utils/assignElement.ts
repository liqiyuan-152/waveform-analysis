import type { ComponentPublicInstance, Ref } from 'vue'
export function assignElement<T extends Element>(
  target: Ref<T | undefined>,
  element: Element | ComponentPublicInstance | null,
) {
  target.value = element instanceof Element ? (element as T) : undefined
}
