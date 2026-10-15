import { setSvgAttributes, svgNode } from '../rendering/SvgDom'
import { ANNOTATION_TEXT_FONT, ANNOTATION_TEXT_LINE_HEIGHT } from './markup'
import type { RenderedAnnotation } from './types'

interface Binding {
  root: SVGGElement
  marker: SVGPathElement
  arrow: SVGLineElement
  label: SVGGElement
  box: SVGRectElement
  text: SVGTextElement
  release: () => void
}

export interface AnnotationViewHandlers {
  down: (id: string, node: SVGGElement, event: PointerEvent) => void
  menu: (id: string, event: MouseEvent) => void
}

let instanceSequence = 0

/** Stable annotation nodes with instance-scoped marker references and text-only labels. */
export class AnnotationView {
  readonly root: SVGGElement
  private readonly bindings = new Map<string, Binding>()
  private readonly instanceId = ++instanceSequence
  private sequence = 0

  constructor(
    svg: SVGSVGElement,
    private readonly handlers: AnnotationViewHandlers,
  ) {
    this.root = svgNode(svg.ownerDocument, 'g', { class: 'waveform-annotation-layer' })
    svg.insertBefore(this.root, svg.querySelector('.waveform-chart__legends'))
  }

  private bind(id: string) {
    const document = this.root.ownerDocument
    const root = svgNode(document, 'g', {
      class: 'waveform-annotation',
      'data-annotation-id': id,
    })
    const defs = svgNode(document, 'defs')
    const markerId = `waveform-native-annotation-${this.instanceId}-${++this.sequence}`
    const marker = svgNode(document, 'marker', {
      id: markerId,
      markerWidth: 8,
      markerHeight: 8,
      refX: 8,
      refY: 4,
      orient: 'auto',
      markerUnits: 'userSpaceOnUse',
    })
    const markerPath = svgNode(document, 'path', { d: 'M0,0 L8,4 L0,8 Z' })
    marker.append(markerPath)
    defs.append(marker)
    const arrow = svgNode(document, 'line', {
      class: 'waveform-annotation__arrow',
      'marker-end': `url(#${markerId})`,
    })
    const label = svgNode(document, 'g')
    const box = svgNode(document, 'rect', { class: 'waveform-annotation__box', rx: 3 })
    const text = svgNode(document, 'text', {
      class: 'waveform-annotation__text',
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
    })
    text.style.font = ANNOTATION_TEXT_FONT
    label.append(box, text)
    root.append(defs, arrow, label)
    const down = (event: PointerEvent) => this.handlers.down(id, root, event)
    const menu = (event: MouseEvent) => this.handlers.menu(id, event)
    const key = (event: KeyboardEvent) => {
      if (
        root.getAttribute('tabindex') !== '0' ||
        !(
          event.key === 'Enter' ||
          event.key === ' ' ||
          event.key === 'ContextMenu' ||
          (event.key === 'F10' && event.shiftKey)
        )
      )
        return
      event.preventDefault()
      event.stopPropagation()
      const bounds = box.getBoundingClientRect()
      const owner = document.defaultView
      if (owner)
        this.handlers.menu(
          id,
          new owner.MouseEvent('contextmenu', {
            clientX: bounds.left + bounds.width / 2,
            clientY: bounds.top + bounds.height / 2,
          }),
        )
    }
    root.addEventListener('pointerdown', down)
    root.addEventListener('contextmenu', menu)
    root.addEventListener('keydown', key)
    this.root.append(root)
    const binding: Binding = {
      root,
      marker: markerPath,
      arrow,
      label,
      box,
      text,
      release: () => {
        root.removeEventListener('pointerdown', down)
        root.removeEventListener('contextmenu', menu)
        root.removeEventListener('keydown', key)
        root.remove()
      },
    }
    this.bindings.set(id, binding)
    return binding
  }

  render(
    annotations: RenderedAnnotation[],
    left: number,
    top: number,
    interactive: boolean,
    offsets: ReadonlyMap<string, { x: number; y: number }>,
  ) {
    setSvgAttributes(this.root, { transform: `translate(${left},${top})` })
    this.root.classList.toggle('waveform-annotation-layer--interactive', interactive)
    const ids = new Set(annotations.map((item) => item.annotation.id))
    for (const [id, binding] of this.bindings)
      if (!ids.has(id)) {
        binding.release()
        this.bindings.delete(id)
      }
    for (const [index, item] of annotations.entries()) {
      const binding = this.bindings.get(item.annotation.id) ?? this.bind(item.annotation.id)
      const delta = offsets.get(item.annotation.id)
      const box = {
        ...item.box,
        x: item.box.x + (delta?.x ?? 0),
        y: item.box.y + (delta?.y ?? 0),
        lineEndX: item.box.lineEndX + (delta?.x ?? 0),
        lineEndY: item.box.lineEndY + (delta?.y ?? 0),
      }
      setSvgAttributes(binding.root, {
        'data-placement': item.placement,
        'data-leaving': item.leaving ? 'true' : 'false',
        opacity: (item.animationStyle?.opacity ?? 1) * (item.seriesOpacity ?? 1),
        tabindex: interactive && !item.leaving ? 0 : -1,
        role: 'button',
        'aria-label': `${item.annotation.text}，打开标注菜单`,
        'aria-haspopup': 'menu',
      })
      binding.root.style.pointerEvents = !interactive || item.leaving ? 'none' : ''
      setSvgAttributes(binding.marker, { fill: item.style.borderColor })
      setSvgAttributes(binding.arrow, {
        x1: box.lineEndX,
        y1: box.lineEndY,
        x2: item.anchorX,
        y2: item.anchorY,
        stroke: item.style.borderColor,
      })
      setSvgAttributes(binding.box, {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        fill: item.style.backgroundColor,
        stroke: item.style.borderColor,
      })
      const x = box.x + box.width / 2,
        y = box.y + box.height / 2
      const animation = item.animationStyle
      setSvgAttributes(binding.label, {
        transform: animation
          ? `translate(${x},${y + animation.offsetY}) scale(${animation.scale}) translate(${-x},${-y})`
          : '',
      })
      setSvgAttributes(binding.text, {
        x,
        y: y - ((item.lines.length - 1) * ANNOTATION_TEXT_LINE_HEIGHT) / 2,
        fill: item.style.textColor,
      })
      while (binding.text.children.length > item.lines.length)
        binding.text.lastElementChild!.remove()
      for (const [lineIndex, line] of item.lines.entries()) {
        let span = binding.text.children[lineIndex] as SVGTSpanElement | undefined
        if (!span) {
          span = svgNode(this.root.ownerDocument, 'tspan')
          binding.text.append(span)
        }
        span.textContent = line
        setSvgAttributes(span, { x, dy: lineIndex === 0 ? 0 : ANNOTATION_TEXT_LINE_HEIGHT })
      }
      const current = this.root.children[index]
      if (current !== binding.root) this.root.insertBefore(binding.root, current ?? null)
    }
  }

  dispose() {
    for (const binding of this.bindings.values()) binding.release()
    this.bindings.clear()
    this.root.remove()
  }
}
