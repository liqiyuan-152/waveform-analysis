import { init } from 'waveform-analysis/analysis'
import 'waveform-analysis/style.css'

/** The analysis component's raw X values use seconds. */
export function mountAnalysis(container: HTMLElement) {
  return init(container, {
    data: {
      kind: 'samples',
      values: Array.from({ length: 200 }, (_, i) => Math.sin(i / 12)),
      sampleRate: 100,
    },
    height: 320,
    grid: { rowCount: 1, columnCount: 1 },
    title: { text: '波形分析' },
  })
}
