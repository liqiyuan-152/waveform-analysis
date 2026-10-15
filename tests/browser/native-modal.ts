import { AnnotationEditor } from '../../src/annotation/AnnotationEditor'
import type { AnnotationEditorDraft } from '../../src/annotation/types'
import '../../src/styles/native.css'

let editor: AnnotationEditor | undefined
let single = false
let validRange = true
const saved: unknown[] = []
let cancelled = 0
const draft: AnnotationEditorDraft = {
  mode: 'add',
  anchor: { x: 100, y: 100 },
  annotation: { id: 'note', seriesId: 'a', x: 1, y: 1, text: '原生标注内容' },
}
const open = () => {
  editor?.dispose()
  editor = new AnnotationEditor(document, {
    draft: () => draft,
    candidates: () =>
      (single ? ['a'] : ['a', 'b']).map((id) => ({
        seriesId: id,
        trackIndex: 0,
        point: { x: 1, y: 1 },
        screenX: 100,
        screenY: 100,
        distance: 0,
        name: `Channel ${id}`,
        color: '#1677ff',
        unit: 'V',
      })),
    series: () => ({ id: 'a', name: 'Channel a', color: '#1677ff', unit: 'V' }),
    timeUnit: () => 'ms',
    time: (value) => {
      if (
        !validRange ||
        !Number.isFinite(Number(value)) ||
        Number(value) < 0 ||
        Number(value) > 4000
      )
        return '时间超出当前波形范围'
      draft.annotation.x = Math.round(Number(value) / 1000)
      return ''
    },
    select: (id) => {
      draft.annotation.seriesId = id
      return ''
    },
    confirm: (annotation) => {
      saved.push(annotation)
      editor?.dispose()
      return true
    },
    cancel: () => {
      cancelled++
      editor?.dispose()
    },
  })
  editor.mount()
}
document.querySelector<HTMLButtonElement>('#open')!.onclick = open
Object.assign(window, {
  modalFixture: {
    saved,
    cancelled: () => cancelled,
    single: (value: boolean) => {
      single = value
      editor?.refresh()
    },
    invalidate: () => {
      validRange = false
    },
    dispose: () => editor?.dispose(),
  },
})
