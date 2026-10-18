import type { WaveformSeries } from 'waveform-analysis/display'

export const scientificSeries: WaveformSeries[] = [
  {
    id: 'scientific-sample',
    name: '小数值测试',
    unit: 'ms',
    yAxis: 'left',
    data: [
      { x: 0, y: 0.0002 },
      { x: 1, y: 0.00032 },
      { x: 2, y: 0.00048 },
      { x: 3, y: 0.00041 },
      { x: 4, y: 0.00063 },
      { x: 5, y: 0.0008 },
      { x: 6, y: 0.00069 },
      { x: 7, y: 0.00054 },
      { x: 8, y: 0.00061 },
      { x: 9, y: 0.00038 },
      { x: 10, y: 0.00027 },
    ],
    style: { color: '#2dd4bf' },
  },
]
