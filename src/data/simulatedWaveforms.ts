import type { WaveformData, WaveformPoint, WaveformSeries } from '../types'

const POINT_COUNT = 1_000
const START_TIME = -5
const END_TIME = 5
const TWO_PI = Math.PI * 2

type SignalGenerator = (time: number, noise: number) => number
type ErrorGenerator = (
  time: number,
  value: number,
  noise: () => number,
) => Pick<WaveformPoint, 'error' | 'lowerError' | 'upperError'>

interface SimulatedSeriesDefinition extends Pick<
  WaveformSeries,
  'id' | 'trackId' | 'shotNo' | 'name' | 'unit' | 'color' | 'lineType' | 'pointType' | 'errorBar'
> {
  signal: SignalGenerator
  errors?: ErrorGenerator
  minimumX?: number
}

function createSeededNoise(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000 - 0.5
  }
}

function createPoints(
  signal: SignalGenerator,
  noise: () => number,
  errors?: ErrorGenerator,
  errorNoise: () => number = noise,
): WaveformPoint[] {
  return Array.from({ length: POINT_COUNT }, (_, index) => {
    const time = START_TIME + (index * (END_TIME - START_TIME)) / (POINT_COUNT - 1)
    const value = signal(time, noise())
    return {
      x: time,
      y: value,
      ...errors?.(time, value, errorNoise),
    }
  })
}

const seriesDefinitions: SimulatedSeriesDefinition[] = [
  {
    id: 'simulated-sine',
    shotNo: '13300',
    name: '正弦基波',
    unit: 'V',
    lineType: 'linear',
    pointType: 'circle',
    errorBar: { visible: true, width: 1.5, capWidth: 10 },
    signal: (time) => 1.2 * Math.sin(TWO_PI * 0.8 * time),
    errors: (_time, _value, noise) => ({
      lowerError: 0.05 + (noise() + 0.5) * 0.45,
      upperError: 0.05 + (noise() + 0.5) * 0.45,
    }),
  },
  {
    id: 'simulated-harmonic',
    trackId: 'simulated-harmonic-frame',
    shotNo: '13300',
    name: '谐波扰动',
    unit: 'V',
    lineType: 'linear',
    pointType: 'none',
    signal: (time) =>
      0.9 * Math.sin(TWO_PI * 0.55 * time) + 0.28 * Math.sin(TWO_PI * 2.2 * time + 0.4),
  },
  {
    id: 'simulated-harmonic-reference',
    trackId: 'simulated-harmonic-frame',
    shotNo: '13300',
    name: '谐波对比',
    unit: 'V',
    color: '#2ca02c',
    lineType: 'linear',
    pointType: 'none',
    signal: (time) =>
      0.62 * Math.sin(TWO_PI * 0.55 * time + 0.55) + 0.18 * Math.sin(TWO_PI * 2.2 * time - 0.2),
  },
  {
    id: 'simulated-harmonic-correction',
    trackId: 'simulated-harmonic-frame',
    shotNo: '13300',
    name: '谐波校正',
    unit: 'V',
    color: '#722ed1',
    lineType: 'linear',
    pointType: 'none',
    signal: (time) =>
      0.48 * Math.sin(TWO_PI * 0.55 * time - 0.35) + 0.12 * Math.sin(TWO_PI * 2.2 * time + 0.7),
  },
  {
    id: 'simulated-damped',
    shotNo: '13300',
    name: '阻尼振荡',
    unit: 'A',
    lineType: 'linear',
    pointType: 'none',
    signal: (time) => {
      const elapsed = time + 5
      return 2.4 * Math.exp(-elapsed * 0.28) * Math.sin(TWO_PI * 1.25 * elapsed)
    },
  },
  {
    id: 'simulated-step',
    shotNo: '13300',
    name: '阶跃响应',
    unit: 'V',
    lineType: 'linear',
    pointType: 'none',
    minimumX: 0,
    signal: (time) => (time < 0 ? 0 : 1 - Math.exp(-time * 2.4)),
  },
  {
    id: 'simulated-pulse',
    shotNo: '13300',
    name: '脉冲响应',
    unit: 'V',
    lineType: 'linear',
    pointType: 'none',
    signal: (time) => 1.8 * Math.exp(-((time - 0.75) ** 2) / 0.12),
  },
  {
    id: 'simulated-noise',
    shotNo: '13300',
    name: '带噪信号',
    unit: 'A',
    lineType: 'linear',
    pointType: 'diamond',
    errorBar: { visible: true },
    signal: (time, noise) => 0.7 * Math.sin(TWO_PI * 0.45 * time) + noise * 0.36,
    errors: () => ({ error: 0.12 }),
  },
]

export function createSimulatedWaveformData(): WaveformData {
  const noise = createSeededNoise(0x5eed1234)
  const errorNoise = createSeededNoise(0xe220a11)
  return {
    kind: 'series',
    series: seriesDefinitions.map(({ signal, errors, minimumX, ...series }) => {
      const points = createPoints(signal, noise, errors, errorNoise)
      return {
        ...series,
        data: {
          kind: 'points' as const,
          points: minimumX === undefined ? points : points.filter((point) => point.x >= minimumX),
        },
      }
    }),
  }
}
