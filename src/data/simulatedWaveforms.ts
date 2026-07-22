import type { WaveformData, WaveformPoint, WaveformSeries } from '../types'

const POINT_COUNT = 1_000
const START_TIME = -5
const END_TIME = 5
const TWO_PI = Math.PI * 2

type SignalGenerator = (time: number, noise: number) => number
type ErrorGenerator = (time: number, value: number) => Pick<
  WaveformPoint,
  'error' | 'lowerError' | 'upperError'
>

interface SimulatedSeriesDefinition
  extends Pick<
    WaveformSeries,
    'id' | 'name' | 'unit' | 'lineType' | 'pointType' | 'errorBar'
  > {
  signal: SignalGenerator
  errors?: ErrorGenerator
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
): WaveformPoint[] {
  return Array.from({ length: POINT_COUNT }, (_, index) => {
    const time = START_TIME + (index * (END_TIME - START_TIME)) / (POINT_COUNT - 1)
    const value = signal(time, noise())
    return {
      x: time,
      y: value,
      ...(errors?.(time, value) ?? {}),
    }
  })
}

const seriesDefinitions: SimulatedSeriesDefinition[] = [
  {
    id: 'simulated-sine',
    name: '正弦基波',
    unit: 'V',
    lineType: 'none',
    pointType: 'triangle',
    errorBar: { visible: true },
    signal: (time) => 1.2 * Math.sin(TWO_PI * 0.8 * time),
    errors: (time) => ({
      lowerError: 0.06 + 0.015 * Math.abs(Math.sin(time)),
      upperError: 0.08 + 0.02 * Math.abs(Math.cos(time)),
    }),
  },
  {
    id: 'simulated-harmonic',
    name: '谐波扰动',
    unit: 'V',
    lineType: 'linear',
    pointType: 'none',
    signal: (time) =>
      0.9 * Math.sin(TWO_PI * 0.55 * time) + 0.28 * Math.sin(TWO_PI * 2.2 * time + 0.4),
  },
  {
    id: 'simulated-damped',
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
    name: '阶跃响应',
    unit: 'V',
    lineType: 'linear',
    pointType: 'none',
    signal: (time) => (time < 0 ? 0 : 1 - Math.exp(-time * 2.4)),
  },
  {
    id: 'simulated-pulse',
    name: '脉冲响应',
    unit: 'V',
    lineType: 'linear',
    pointType: 'none',
    signal: (time) => 1.8 * Math.exp(-((time - 0.75) ** 2) / 0.12),
  },
  {
    id: 'simulated-noise',
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
  return {
    kind: 'series',
    series: seriesDefinitions.map(({ signal, errors, ...series }) => ({
      ...series,
      data: {
        kind: 'points',
        points: createPoints(signal, noise, errors),
      },
    })),
  }
}
