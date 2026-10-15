import { SelectView } from '../controls/SelectView'
import { PopupController } from '../controls/PopupController'
import type { WaveformAnnotation } from '../types/chart'
import { formatAnnotationTime, formatPlainNumber } from '../utils/formatters'
import { ModalMotion } from '../controls/ModalMotion'
import { ModalController } from '../controls/ModalController'
import { NumberInputView } from '../controls/NumberInputView'
import { svgNode } from '../rendering/SvgDom'
import { ANNOTATION_MAX_TEXT_LENGTH } from './markup'
import { AnnotationStyleEditor } from './AnnotationStyleEditor'
import type {
  AnnotationEditorDraft,
  AnnotationSeriesCandidate,
  AnnotationSeriesInfo,
} from './types'

export interface AnnotationEditorContext {
  draft: () => AnnotationEditorDraft | undefined
  candidates: () => AnnotationSeriesCandidate[]
  series: () => AnnotationSeriesInfo | undefined
  timeUnit: () => 's' | 'ms'
  time: (value: string) => string
  select: (id: string) => string
  confirm: (annotation: WaveformAnnotation) => boolean
  cancel: () => void
}

let sequence = 0

/** DOM editor owns local text/time/style fields; the controller owns the snapped draft. */
export class AnnotationEditor {
  readonly root: HTMLDialogElement
  private readonly modal: ModalController
  private readonly motion: ModalMotion
  private readonly time: NumberInputView
  private readonly xLabel: HTMLLabelElement
  private readonly textarea: HTMLTextAreaElement
  private readonly counter: HTMLElement
  private readonly errorNode: HTMLElement
  private readonly y: HTMLElement
  private readonly seriesName: HTMLElement
  private readonly seriesColor: HTMLElement
  private readonly seriesUnit: HTMLElement
  private readonly select: SelectView
  private readonly seriesRow: HTMLElement
  private readonly save: HTMLButtonElement
  private readonly buttons: HTMLButtonElement[] = []
  private readonly style: AnnotationStyleEditor
  private readonly errorId: string
  private unit: 's' | 'ms'
  private error = ''
  private validated = false
  private disposed = false

  constructor(
    document: Document,
    private readonly context: AnnotationEditorContext,
  ) {
    const draft = context.draft()
    if (!draft) throw new Error('Missing annotation draft')
    this.unit = context.timeUnit()
    const titleId = `waveform-native-annotation-editor-${++sequence}`
    this.errorId = `${titleId}-time-error`
    this.root = document.createElement('dialog')
    this.root.className = 'waveform-annotation-editor-root waveform-annotation-editor'
    this.root.setAttribute('role', 'dialog')
    this.root.setAttribute('aria-modal', 'true')
    this.root.setAttribute('aria-labelledby', titleId)
    this.root.tabIndex = -1
    const node = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
      const element = document.createElement(tag)
      element.className = className
      element.textContent = text
      return element
    }
    const modal = node('div', 'waveform-modal'),
      panel = node('div', 'waveform-modal__panel')
    const header = node('header', 'waveform-modal__header')
    const title = node('span', '', draft.mode === 'add' ? '添加标注' : '编辑标注')
    title.id = titleId
    header.append(title)
    const button = (text: string, className: string, action: () => void) => {
      const element = node('button', className, text)
      element.type = 'button'
      element.onclick = () => {
        if (!this.disposed && !this.motion.busy) action()
      }
      this.buttons.push(element)
      return element
    }
    const close = button('', 'waveform-modal__close', () => this.cancel())
    close.setAttribute('aria-label', '关闭')
    const icon = svgNode(document, 'svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true' })
    icon.append(svgNode(document, 'path', { d: 'm3 3 10 10M13 3 3 13' }))
    close.append(icon)
    const body = node('div', 'waveform-modal__body'),
      content = node('div', 'waveform-annotation-editor__content')
    const coordinates = node('div', 'waveform-annotation-editor__coordinates')
    coordinates.setAttribute('aria-label', '标注坐标')
    const x = node('label', 'waveform-annotation-editor__coordinate-input')
    this.xLabel = x
    this.time = new NumberInputView(
      document,
      '标注横轴时间',
      (value) => {
        this.validated = false
        this.time.update(value, false)
        this.refresh()
      },
      () => this.commitTime(),
    )
    this.time.update(formatAnnotationTime(draft.annotation.x, this.unit), false)
    x.append(node('b', '', 'X'), this.time.root)
    const y = node('span')
    this.y = node('code')
    y.append(node('b', '', 'Y'), this.y)
    this.errorNode = node('p', 'waveform-annotation-editor__coordinate-error')
    this.errorNode.id = this.errorId
    this.errorNode.setAttribute('role', 'alert')
    coordinates.append(x, y, this.errorNode)
    const hint = node(
      'p',
      'waveform-annotation-editor__coordinate-hint',
      '修改 X 轴后失焦时会自动吸附最近的采样点',
    )
    hint.setAttribute('role', 'note')
    this.seriesRow = node('div', 'waveform-annotation-editor__series')
    this.seriesRow.setAttribute('aria-label', '标注所属波形')
    this.seriesColor = node('i')
    this.seriesColor.setAttribute('aria-hidden', 'true')
    const label = node('span', 'waveform-annotation-editor__series-label')
    this.seriesName = node('b')
    label.append(node('small', '', '标注波形'), this.seriesName)
    this.select = new SelectView(document, '选择标注波形', (value) => {
      if (this.disposed) return
      this.error = context.select(value)
      this.validated = !!this.error
      this.refresh()
    })
    this.seriesUnit = node('code')
    this.seriesRow.append(this.seriesColor, label, this.select.root, this.seriesUnit)
    const field = node('label', 'waveform-annotation-editor__field')
    const textLabel = node('span', 'waveform-annotation-editor__label-row')
    this.counter = node('small')
    textLabel.append(node('b', '', '标注文本'), this.counter)
    this.textarea = node('textarea')
    this.textarea.value = draft.annotation.text
    this.textarea.rows = 4
    this.textarea.maxLength = ANNOTATION_MAX_TEXT_LENGTH
    this.textarea.placeholder = '输入这处波形的说明'
    this.textarea.setAttribute('aria-label', '标注文本')
    this.textarea.oninput = () => this.refresh()
    field.append(textLabel, this.textarea)
    content.append(coordinates, hint, this.seriesRow, field)
    this.style = new AnnotationStyleEditor(document, draft.annotation.style, () => this.refresh())
    content.append(this.style.root)
    body.append(content)
    const footer = node('footer', 'waveform-modal__footer')
    this.save = button('保存标注', 'waveform-modal__button waveform-modal__button--primary', () =>
      this.confirm(),
    )
    footer.append(
      button('取 消', 'waveform-modal__button', () => this.cancel()),
      this.save,
    )
    panel.append(header, close, body, footer)
    modal.append(panel)
    this.root.append(modal)
    this.root.addEventListener('keydown', this.keydown, true)
    this.motion = new ModalMotion(this.root)
    this.modal = new ModalController(this.root, {
      initialFocus: () => this.textarea,
      cancel: () => this.cancel(),
      dismissPopup: () => PopupController.dismissWithin(this.root),
    })
    this.refresh()
  }

  mount() {
    if (this.disposed) return
    this.root.ownerDocument.body.append(this.root)
    this.modal.open()
    this.motion.enter()
  }

  private commitTime() {
    if (this.disposed || !this.context.draft()) return false
    this.validated = true
    this.error = this.context.time(this.time.input.value)
    this.refresh()
    return !this.error
  }

  private cancel() {
    if (this.disposed || this.motion.busy) return
    this.select.close()
    PopupController.dismissWithin(this.root)
    this.motion.close(() => this.context.cancel())
  }

  private confirm() {
    if (this.disposed || this.motion.busy || !this.commitTime() || this.save.disabled) return
    this.select.close()
    PopupController.dismissWithin(this.root)
    this.motion.close(() => this.confirmNow())
  }

  private confirmNow() {
    // Data or units can change during the leave transition; validate the current draft again.
    if (this.disposed || !this.commitTime() || this.save.disabled) return
    const draft = this.context.draft()
    if (!draft) return
    this.context.confirm({
      ...draft.annotation,
      text: this.textarea.value.trim(),
      style: this.style.snapshot(),
    })
  }
  private readonly keydown = (event: KeyboardEvent) => {
    if (!event.isComposing && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      this.confirm()
    }
  }

  refresh() {
    if (this.disposed) return
    const draft = this.context.draft()
    if (!draft) return
    const unit = this.context.timeUnit()
    if (unit !== this.unit) {
      const value = this.time.input.value
      if (value.trim() && Number.isFinite(Number(value))) {
        const raw = Number(value) / (this.unit === 'ms' ? 1000 : 1)
        this.time.update(String(raw * (unit === 'ms' ? 1000 : 1)), false)
      }
      this.unit = unit
    }
    const error = this.validated ? this.error : ''
    this.errorNode.textContent = error
    this.errorNode.hidden = !error
    this.xLabel.setAttribute('aria-invalid', String(!!error))
    this.time.update(this.time.input.value, !!error, error ? this.errorId : undefined)
    this.counter.textContent = `${this.textarea.value.length}/${ANNOTATION_MAX_TEXT_LENGTH}`
    this.y.textContent = formatPlainNumber(draft.annotation.y)
    const candidates = this.context.candidates()
    const candidate = candidates.find((item) => item.seriesId === draft.annotation.seriesId)
    const series = candidate ? { id: candidate.seriesId, ...candidate } : this.context.series()
    this.seriesRow.hidden = !series
    this.seriesRow.style.display = series ? '' : 'none'
    this.seriesName.textContent = series?.name ?? ''
    this.seriesColor.style.backgroundColor = series?.color ?? ''
    this.seriesUnit.textContent = series?.unit ?? ''
    this.seriesUnit.hidden = candidates.length > 0
    this.select.update(
      candidates.map((item) => ({
        value: item.seriesId,
        label: `${item.name}${item.unit ? ` (${item.unit})` : ''}`,
      })),
      draft.annotation.seriesId,
    )
    this.select.root.hidden = !candidates.length
    if (!candidates.length || !series) this.select.close()
    const text = this.textarea.value,
      time = this.time.input.value
    this.textarea.setAttribute('aria-invalid', String(text.length > ANNOTATION_MAX_TEXT_LENGTH))
    this.save.disabled =
      !text.trim() ||
      text.length > ANNOTATION_MAX_TEXT_LENGTH ||
      !time.trim() ||
      !Number.isFinite(Number(time)) ||
      !this.style.valid ||
      !!error
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.motion.dispose()
    this.root.removeEventListener('keydown', this.keydown, true)
    this.textarea.oninput = null
    this.select.dispose()
    for (const button of this.buttons) button.onclick = null
    this.time.dispose()
    this.style.dispose()
    try {
      this.modal.dispose()
    } finally {
      this.root.remove()
    }
  }
}
