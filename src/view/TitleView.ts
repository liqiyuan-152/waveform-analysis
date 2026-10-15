import {
  calculateRotatedTitleLayout,
  TITLE_AREA_HORIZONTAL_PADDING,
} from '../components/core/title'
import {
  TITLE_CHAR_WIDTH_RATIO,
  TITLE_DEFAULT_FONT_SIZE,
  TITLE_LINE_HEIGHT,
} from '../components/core/constants'
import type { ResolvedWaveformChartProps } from '../types/options'

/** Owns title measurement and presentation, using the same layout algorithm as the Vue boundary. */
export class TitleView {
  readonly root: HTMLDivElement
  private readonly measure: HTMLSpanElement
  private readonly visual: HTMLSpanElement
  private readonly text: HTMLSpanElement

  constructor(parent: HTMLElement) {
    const document = parent.ownerDocument
    this.root = document.createElement('div')
    this.root.className = 'waveform-chart__title-area'
    this.measure = document.createElement('span')
    this.measure.className = 'waveform-chart__title-measure'
    this.measure.setAttribute('aria-hidden', 'true')
    this.visual = document.createElement('span')
    this.visual.className = 'waveform-chart__title-visual'
    this.text = document.createElement('span')
    this.text.className = 'waveform-chart__title-text'
    this.visual.append(this.text)
    this.root.append(this.measure, this.visual)
    parent.append(this.root)
  }

  update(width: number, options: ResolvedWaveformChartProps) {
    const title = options.title
    const text = title?.text.trim() ?? ''
    const reserved = !!title && title.visible !== false && text.length > 0
    this.root.style.display = reserved ? '' : 'none'
    if (!reserved) return 0
    const edge = options.layoutPreset === 'edge-compact'
    const style = title?.textStyle
    const fontSize =
      Number.isFinite(style?.fontSize) && style!.fontSize! > 0
        ? style!.fontSize!
        : TITLE_DEFAULT_FONT_SIZE
    const rotation = Number.isFinite(style?.rotation) ? style!.rotation! : 0
    const normalized = ((rotation % 360) + 360) % 360
    const rotated = normalized > 1e-6 && Math.abs(normalized - 360) > 1e-6
    const spacing = Number.parseFloat(style?.letterSpacing ?? '')
    const estimatedWidth = Math.max(
      1,
      text.length * fontSize * TITLE_CHAR_WIDTH_RATIO +
        (Number.isFinite(spacing) ? Math.max(0, text.length - 1) * spacing : 0),
    )
    const availableWidth =
      width - TITLE_AREA_HORIZONTAL_PADDING * 2 > 0
        ? width - TITLE_AREA_HORIZONTAL_PADDING * 2
        : estimatedWidth
    const presentation = {
      color: style?.color ?? '#1f2937',
      fontSize: `${fontSize}px`,
      fontFamily: style?.fontFamily || '"Microsoft YaHei", "微软雅黑", sans-serif',
      fontWeight: String(
        edge && fontSize === 18 && style?.fontWeight === 700 ? 600 : (style?.fontWeight ?? 400),
      ),
      fontStyle: style?.fontStyle ?? 'normal',
      textDecoration: style?.textDecoration ?? 'none',
      letterSpacing: style?.letterSpacing ?? 'normal',
      lineHeight: String(TITLE_LINE_HEIGHT),
    }
    this.measure.textContent = text
    Object.assign(this.measure.style, presentation, {
      width: 'max-content',
      maxWidth: rotated ? 'none' : `${availableWidth}px`,
      whiteSpace: rotated ? 'nowrap' : 'normal',
      overflowWrap: rotated ? 'normal' : 'anywhere',
    })
    const rect = this.measure.getBoundingClientRect()
    const measuredWidth = this.measure.scrollWidth || rect.width
    const measuredHeight = this.measure.scrollHeight || rect.height
    const layout = calculateRotatedTitleLayout({
      naturalWidth:
        edge && !rotated && measuredHeight > 0
          ? Math.min(measuredWidth || availableWidth, availableWidth)
          : measuredWidth || estimatedWidth,
      naturalHeight: measuredHeight || fontSize * TITLE_LINE_HEIGHT,
      availableWidth,
      rotation,
      edgeCompact: edge,
    })
    Object.assign(this.root.style, {
      height: `${layout.areaHeight}px`,
      justifyContent:
        title?.align === 'left' ? 'flex-start' : title?.align === 'right' ? 'flex-end' : 'center',
    })
    this.root.setAttribute('aria-hidden', String(options.cleanView))
    if (options.cleanView) {
      this.root.removeAttribute('role')
      this.root.removeAttribute('aria-level')
    } else {
      this.root.setAttribute('role', 'heading')
      this.root.setAttribute('aria-level', '2')
    }
    this.visual.style.display = options.cleanView ? 'none' : ''
    Object.assign(this.visual.style, {
      width: `${layout.visualWidth}px`,
      height: `${layout.visualHeight}px`,
    })
    this.text.textContent = text
    Object.assign(this.text.style, presentation, {
      width: `${layout.textWidth}px`,
      minHeight: `${layout.textHeight}px`,
      textAlign: title?.align ?? 'center',
      whiteSpace: rotated ? 'nowrap' : 'normal',
      overflowWrap: rotated ? 'normal' : 'anywhere',
      transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${layout.scale})`,
    })
    this.text.setAttribute('data-title-scale', String(layout.scale))
    if (layout.wrapped) this.text.setAttribute('data-title-wrapped', 'true')
    else this.text.removeAttribute('data-title-wrapped')
    return layout.areaHeight
  }

  alignToPlot(left: number, width: number, options: ResolvedWaveformChartProps) {
    const align = options.title?.align
    const plotAligned = !align || align === 'center' || align === 'left'
    Object.assign(this.root.style, {
      boxSizing: plotAligned ? 'border-box' : '',
      marginLeft: plotAligned ? `${left}px` : '',
      width: plotAligned ? `${width}px` : '',
      paddingLeft: align === 'left' ? '0px' : '',
      paddingRight: align === 'left' ? '0px' : '',
    })
  }

  dispose() {
    this.root.remove()
  }
}
