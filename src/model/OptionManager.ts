import type { ResolvedWaveformChartProps } from '../types/options'
import type { WaveformChartOptions, WaveformChartOptionUpdate } from '../types/options'
import { validateOptions } from './validateOptions'

function defaults(): ResolvedWaveformChartProps {
  return {
    data: { kind: 'points', points: [] },
    animationEnabled: true,
    controlTheme: 'auto',
    displayMode: 'independent',
    overlayMode: 'single-axis',
    unitDisplayMode: 'axis',
    layoutPreset: 'default',
    yLabel: '幅值',
    lineColor: '#0960bd',
    pointSize: 2,
    showTooltip: true,
    zoomable: true,
    integerZoom: false,
    pannable: false,
    minVisiblePoints: 0,
    xDomainStrategy: { type: 'integer-ms' },
    timeUnit: 'ms',
    annotations: [],
    annotationsVisible: true,
    grid: { rowCount: 2, columnCount: 1, showPagination: true },
    rendering: {},
    plotMargin: {},
    legend: { position: 'top-right', orientation: 'auto' },
    defaultHiddenSeriesIds: [],
    cleanView: false,
    presentationMode: false,
    zeroLine: { visible: true },
  }
}

/** Builds candidates without changing live configuration; the chart commits after preparation. */
export class OptionManager {
  private raw: WaveformChartOptions = {}
  private readonly base = defaults()
  private resolved = this.base

  constructor(options: WaveformChartOptions = {}) {
    this.commit(this.prepare(options))
  }

  get value(): ResolvedWaveformChartProps {
    return this.resolved
  }

  prepare(patch: WaveformChartOptionUpdate) {
    validateOptions(patch)
    const raw = { ...this.raw, ...patch }
    const defined = Object.fromEntries(
      Object.entries(raw).filter(([, value]) => value !== undefined),
    )
    const resolved = { ...this.base, ...defined } as ResolvedWaveformChartProps
    return { raw, resolved }
  }

  commit(candidate: ReturnType<OptionManager['prepare']>) {
    this.raw = candidate.raw
    this.resolved = candidate.resolved
  }
}
