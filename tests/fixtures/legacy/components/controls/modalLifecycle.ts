import { ModalController, type ModalOptions } from '@/controls/ModalController'

/** Transitional Vue adapter shares the document-scoped modal owner with native controls. */
export function mountModal(dialog: HTMLDialogElement, options: ModalOptions): () => void {
  const controller = new ModalController(dialog, options)
  controller.open()
  return () => controller.dispose()
}
