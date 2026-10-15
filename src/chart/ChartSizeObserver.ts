import type { ResolvedWaveformChartProps } from '../types/options'
import { minimumHeight } from '../components/core/constants'

export class ChartSizeObserver {
  private observer?: ResizeObserver
  private size = { width: 0, height: 0 }

  constructor(
    private readonly host: HTMLElement,
    private readonly root: HTMLElement,
    private readonly options: () => ResolvedWaveformChartProps,
    private readonly changed: () => void,
    autoResize = true,
    measured: () => void = () => {},
  ) {
    if (autoResize) {
      const Observer = host.ownerDocument.defaultView?.ResizeObserver
      if (Observer) {
        this.observer = new Observer(() => {
          if (!this.resize()) measured()
        })
        this.observer.observe(root)
        this.observer.observe(host)
      } else {
        console.info('WaveformChart: ResizeObserver unavailable; call resize() after size changes')
      }
    }
  }

  get value() {
    return { ...this.size }
  }

  resize() {
    const options = this.options()
    this.root.style.width = options.width === undefined ? '100%' : `${Math.max(0, options.width)}px`
    this.root.style.height =
      options.height === undefined ? '100%' : `${Math.max(minimumHeight, options.height)}px`
    this.root.style.minHeight = `${minimumHeight}px`
    const hostRect = this.host.getBoundingClientRect()
    const rootRect = this.root.getBoundingClientRect()
    // An attached display:none ancestor must not be bypassed with fixed-size fallbacks.
    const hidden = this.host.isConnected && this.host.getClientRects().length === 0
    const measured = this.root.getClientRects().length > 0
    const style = measured
      ? this.root.ownerDocument.defaultView?.getComputedStyle(this.root)
      : undefined
    const pixels = (name: keyof CSSStyleDeclaration) =>
      Number.parseFloat(String(style?.[name])) || 0
    // Vue's ResizeObserver supplies contentRect. Exclude the same border/padding from DOM reads.
    const contentWidth =
      (this.root.clientWidth ||
        rootRect.width - pixels('borderLeftWidth') - pixels('borderRightWidth')) -
      pixels('paddingLeft') -
      pixels('paddingRight')
    const contentHeight =
      (this.root.clientHeight ||
        rootRect.height - pixels('borderTopWidth') - pixels('borderBottomWidth')) -
      pixels('paddingTop') -
      pixels('paddingBottom')
    const width = hidden ? 0 : measured ? contentWidth : (options.width ?? hostRect.width)
    const height = hidden
      ? 0
      : measured
        ? contentHeight
        : options.height === undefined
          ? Math.max(minimumHeight, hostRect.height)
          : Math.max(minimumHeight, options.height)
    const next = { width: Math.max(0, width), height: Math.max(0, height) }
    if (next.width === this.size.width && next.height === this.size.height) return false
    this.size = next
    this.changed()
    return true
  }

  dispose() {
    this.observer?.disconnect()
    this.observer = undefined
  }
}
