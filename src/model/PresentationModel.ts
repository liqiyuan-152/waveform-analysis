import type { WaveformInteractionMode } from '../types/chart'
import type { ResolvedWaveformChartProps } from '../types/options'

export class PresentationModel {
  private internalMode: WaveformInteractionMode = 'zoom'
  private currentPage = 1

  get page() {
    return this.currentPage
  }

  setPage(page: number, pageCount: number) {
    const next = Math.min(Math.max(1, pageCount), Math.max(1, Math.floor(page)))
    if (!Number.isFinite(next) || next === this.currentPage) return false
    this.currentPage = next
    return true
  }

  mode(options: ResolvedWaveformChartProps) {
    return options.interactionMode ?? this.internalMode
  }

  canSetMode(mode: WaveformInteractionMode, options: ResolvedWaveformChartProps) {
    return (
      !options.presentationMode &&
      (mode === 'none' ||
        (mode === 'zoom' && options.zoomable) ||
        (mode === 'pan' && options.pannable) ||
        (mode === 'annotation' && options.annotationsVisible))
    )
  }

  requestMode(mode: WaveformInteractionMode, options: ResolvedWaveformChartProps) {
    if (!this.canSetMode(mode, options)) return 'disabled' as const
    if (mode === this.mode(options)) return 'unchanged' as const
    if (options.interactionMode !== undefined) return 'requested' as const
    this.internalMode = mode
    return 'applied' as const
  }
}
