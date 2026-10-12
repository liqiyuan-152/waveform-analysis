import type { ResolvedWaveformChartProps } from '../core/waveformChartTypes'

/** Presentation changes invalidate an in-flight image snapshot, without serializing input data. */
export function chartExportOptions(props: ResolvedWaveformChartProps) {
  const keys = [
    'annotations',
    'annotationsVisible',
    'title',
    'axes',
    'frameStyle',
    'frameNumber',
    'frameNumbers',
    'legend',
    'cleanView',
    'rendering',
    'displayMode',
    'overlayMode',
    'initialXDomain',
    'initialXDomains',
    'yDomain',
    'yDomains',
    'grid',
    'plotMargin',
    'xLabel',
    'yLabel',
    'timeUnit',
    'zeroLine',
    'layoutPreset',
    'unitDisplayMode',
  ] as const satisfies readonly (keyof ResolvedWaveformChartProps)[]
  return Object.fromEntries(keys.map((key) => [key, props[key]]))
}
