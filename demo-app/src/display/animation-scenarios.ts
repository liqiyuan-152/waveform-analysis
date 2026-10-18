import type { WaveformSeries } from 'waveform-analysis/display'

export function animationScenario(
  name: string,
  version: number,
  previous: WaveformSeries[] = [],
): WaveformSeries[] {
  if (name === 'append') {
    return previous.map((series, index) => {
      const last = series.data[series.data.length - 1]
      const prior = series.data[series.data.length - 2]
      const interval = last && prior && last.x > prior.x ? last.x - prior.x : 1
      const x = last ? last.x + interval : 0
      return {
        ...series,
        data: [
          ...series.data,
          { id: `append-${version}`, x, y: Math.sin(x / 3 + version / 4 + index) },
        ],
      }
    })
  }
  const start = name === 'window' ? version : 0
  const count = 14
  const amplitude =
    name === 'extreme' ? 1e8 : name === 'auto-padding' ? 10 ** (version % 5) : 1 + (version % 4)
  return ['signal', 'reference'].map((id, index) => ({
    id,
    name: index ? '参考通道' : '信号通道',
    data: Array.from({ length: count }, (_, offset) => {
      const x = start + offset
      return { id: `point-${x}`, x, y: Math.sin(x / 3 + version / 4 + index) * amplitude }
    }),
  }))
}
