import { ref } from 'vue'

import type { WaveformAnnotation } from '../../types'
import type {
  AnnotationContextMenuState,
  AnnotationEditorAnchor,
  AnnotationEditorDraft,
  AnnotationHit,
} from './types'

export function useWaveformAnnotationInteraction() {
  const editorDraft = ref<AnnotationEditorDraft | null>(null)
  const contextMenu = ref<AnnotationContextMenuState | null>(null)

  const openCreate = (
    hit: AnnotationHit,
    createId: () => string,
    anchor: AnnotationEditorAnchor,
  ) => {
    editorDraft.value = {
      mode: 'add',
      annotation: {
        id: createId(),
        seriesId: hit.seriesId,
        x: hit.xValue ?? hit.point.x,
        y: hit.point.y,
        text: '',
        createdAt: new Date().toISOString(),
      },
      anchor,
    }
    contextMenu.value = null
  }

  const openEdit = (annotation: WaveformAnnotation, anchor: AnnotationEditorAnchor) => {
    editorDraft.value = {
      mode: 'edit',
      annotation: { ...annotation },
      previous: { ...annotation },
      anchor,
    }
    contextMenu.value = null
  }

  const openContextMenu = (state: AnnotationContextMenuState) => {
    contextMenu.value = state
  }

  const closeEditor = () => {
    editorDraft.value = null
  }

  const closeContextMenu = () => {
    contextMenu.value = null
  }

  return {
    editorDraft,
    contextMenu,
    openCreate,
    openEdit,
    openContextMenu,
    closeEditor,
    closeContextMenu,
  }
}
