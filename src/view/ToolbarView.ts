import { resolveToolbar, type ToolbarCommands } from '../components/controls/toolbarRegistry'
import type {
  WaveformControlState,
  WaveformToolbarItem,
  WaveformImageExportOptions,
} from '../types/controls'
import type { ResolvedWaveformChartProps } from '../types/options'
import type { ChartLayoutSnapshot } from '../layout/ChartLayoutEngine'
import { svgNode } from '../rendering/SvgDom'
import { ToolbarDownloadController } from '../controls/ToolbarDownloadController'

export interface ToolbarContext {
  commands: ToolbarCommands
  state: () => WaveformControlState
  cancel: () => void
  export: (options: WaveformImageExportOptions) => Promise<Blob>
}

/** Stable native controls use the same registry/capabilities as the Vue toolbar. */
export class ToolbarView {
  readonly root: HTMLDivElement
  private readonly toggle: HTMLButtonElement
  private readonly select: HTMLSelectElement
  private readonly scope: HTMLSpanElement
  private readonly menu: HTMLDivElement
  private readonly feedback: HTMLSpanElement
  private readonly buttons = new Map<WaveformToolbarItem, HTMLButtonElement>()
  private readonly groups: HTMLDivElement[] = []
  private readonly download: ToolbarDownloadController
  private selected = ''
  private expanded = false
  private menuOpen = false
  private disposed = false
  private options?: ResolvedWaveformChartProps
  private layout?: ChartLayoutSnapshot

  constructor(
    parent: HTMLElement,
    private readonly context: ToolbarContext,
  ) {
    const document = parent.ownerDocument
    this.root = document.createElement('div')
    this.root.setAttribute('role', 'toolbar')
    this.root.setAttribute('aria-label', '波形工具栏')
    this.toggle = document.createElement('button')
    this.toggle.type = 'button'
    this.toggle.className = 'waveform-toolbar__toggle'
    this.toggle.textContent = '工具'
    this.toggle.setAttribute('aria-label', '图表工具')
    this.toggle.onclick = () => {
      this.expanded = !this.expanded
      this.menuOpen = false
      this.refresh()
    }
    this.select = document.createElement('select')
    this.select.setAttribute('aria-label', '操作图框')
    this.select.onchange = () => {
      this.selected = this.select.value
      this.refresh()
    }
    this.scope = document.createElement('span')
    this.scope.className = 'waveform-toolbar__scope'
    this.scope.textContent = '共享范围'
    this.menu = document.createElement('div')
    this.menu.className = 'waveform-toolbar__menu'
    this.menu.setAttribute('role', 'group')
    this.menu.setAttribute('aria-label', '图片格式')
    for (const format of ['png', 'svg'] as const) {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = `下载 ${format.toUpperCase()}`
      button.onclick = () => {
        if (this.disposed) return
        this.menuOpen = false
        void this.download.download(format)
      }
      this.menu.append(button)
    }
    this.feedback = document.createElement('span')
    this.feedback.className = 'waveform-toolbar__feedback'
    this.feedback.setAttribute('role', 'status')
    this.root.append(this.toggle, this.select, this.scope, this.menu, this.feedback)
    this.download = new ToolbarDownloadController(document, context.export, () => this.refresh())
    for (const name of ['pointerdown', 'click', 'dblclick', 'wheel', 'contextmenu'])
      this.root.addEventListener(name, this.stop)
    this.root.addEventListener('keydown', this.keydown)
    document.addEventListener('pointerdown', this.outside, true)
    parent.append(this.root)
    this.root.hidden = true
  }

  private readonly stop = (event: Event) => event.stopPropagation()
  private readonly outside = (event: Event) => {
    if (this.menuOpen && !this.root.contains(event.target as Node)) {
      this.menuOpen = false
      this.refresh()
    }
  }
  private readonly keydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    event.preventDefault()
    const returnFocus = this.menuOpen ? this.buttons.get('export') : this.toggle
    this.menuOpen = false
    this.expanded = false
    this.context.cancel()
    this.refresh()
    if (!returnFocus?.hidden && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true })
  }

  render(layout: ChartLayoutSnapshot, options: ResolvedWaveformChartProps) {
    this.layout = layout
    this.options = options
    this.refresh()
  }

  refresh() {
    if (this.disposed || !this.options || !this.layout) return
    const config = resolveToolbar(this.options.toolbar)
    const state = this.context.state()
    if (!state.independent || !state.targets.some((target) => target.trackId === this.selected))
      this.selected = ''
    const compact = this.layout.width < 440
    this.root.hidden = !config.visible
    this.root.style.display = config.visible ? '' : 'none'
    this.root.className = `waveform-toolbar waveform-toolbar--${config.display} waveform-toolbar--${config.position}`
    this.root.classList.toggle('waveform-toolbar--collapsed', compact && !this.expanded)
    this.root.style.top = `${this.layout.titleHeight + 2}px`
    if (!config.visible) this.menuOpen = false
    this.toggle.hidden = !compact
    this.toggle.style.display = compact ? '' : 'none'
    this.toggle.setAttribute('aria-expanded', String(this.expanded))
    this.select.hidden = !state.independent
    this.select.style.display = state.independent ? '' : 'none'
    this.scope.hidden = state.independent
    this.scope.style.display = state.independent ? 'none' : ''
    const targets = [{ trackId: '', label: '当前页全部' }, ...state.targets]
    const signature = JSON.stringify(targets.map((target) => [target.trackId, target.label]))
    if (this.select.dataset.signature !== signature) {
      this.select.dataset.signature = signature
      this.select.replaceChildren(
        ...targets.map((target) => {
          const option = this.root.ownerDocument.createElement('option')
          option.value = target.trackId
          option.textContent = target.label
          return option
        }),
      )
    }
    this.select.value = this.selected
    const live = new Set(config.groups.flatMap((group) => group.map((item) => item.id)))
    for (const [id, button] of this.buttons)
      if (!live.has(id)) {
        button.onclick = null
        button.remove()
        this.buttons.delete(id)
        if (id === 'export') this.menuOpen = false
      }
    while (this.groups.length > config.groups.length) this.groups.pop()!.remove()
    config.groups.forEach((items, index) => {
      const group = this.groups[index] ?? this.root.ownerDocument.createElement('div')
      group.className = 'waveform-toolbar__group'
      group.dataset.group = items[0].group
      this.groups[index] = group
      const expected = this.root.children[index + 3]
      if (expected !== group) this.root.insertBefore(group, expected ?? this.menu)
      items.forEach((item, position) => {
        let button = this.buttons.get(item.id)
        if (!button) {
          button = this.root.ownerDocument.createElement('button')
          button.type = 'button'
          button.dataset.command = item.id
          button.title = item.label
          button.setAttribute('aria-label', item.label)
          const icon = svgNode(this.root.ownerDocument, 'svg', {
            viewBox: '0 0 24 24',
            'aria-hidden': 'true',
          })
          icon.append(svgNode(this.root.ownerDocument, 'path', { d: item.icon }))
          button.append(icon)
          button.onclick = () => {
            if (this.disposed || this.root.hidden || button!.disabled) return
            if (item.id === 'export') {
              this.menuOpen = !this.menuOpen
              this.refresh()
            } else item.run(this.context.commands, this.selected || undefined)
          }
          this.buttons.set(item.id, button)
        }
        if (item.group === 'mode') button.setAttribute('aria-pressed', String(item.active(state)))
        else button.removeAttribute('aria-pressed')
        if (item.id === 'export') button.setAttribute('aria-expanded', String(this.menuOpen))
        button.disabled =
          !item.enabled(state, this.selected || undefined) ||
          (item.id === 'export' && this.download.busy)
        if (group.children[position] !== button)
          group.insertBefore(button, group.children[position] ?? null)
      })
    })
    this.menu.hidden = !this.menuOpen
    this.menu.style.display = this.menuOpen ? '' : 'none'
    this.feedback.textContent = this.download.busy ? '正在导出…' : this.download.feedback
    this.feedback.hidden = !this.feedback.textContent
    this.feedback.style.display = this.feedback.textContent ? '' : 'none'
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.download.dispose()
    this.root.ownerDocument.removeEventListener('pointerdown', this.outside, true)
    for (const name of ['pointerdown', 'click', 'dblclick', 'wheel', 'contextmenu'])
      this.root.removeEventListener(name, this.stop)
    this.root.removeEventListener('keydown', this.keydown)
    this.toggle.onclick = null
    this.select.onchange = null
    for (const button of [...this.buttons.values(), ...this.menu.querySelectorAll('button')])
      button.onclick = null
    this.buttons.clear()
    this.groups.length = 0
    this.root.remove()
  }
}
