import type { WaveformData } from 'waveform-analysis/native'

export function exampleData(version = 0): WaveformData {
  return {
    kind: 'series',
    series: ['a', 'b'].map((id, index) => ({
      id,
      trackId: 'shared',
      name: `通道 ${index + 1}`,
      unit: 'V',
      data: {
        kind: 'samples',
        sampleRate: 1000,
        startTime: version,
        values: Array.from({ length: 1000 }, (_, i) => Math.sin(i / (40 + index * 20) + version)),
      },
    })),
  }
}
