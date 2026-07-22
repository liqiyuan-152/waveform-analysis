/**
 * 数据抽样算法测试
 */

import { describe, it, expect } from 'vitest'
import {
  downsampleLTTB,
  downsampleMinMax,
  adaptiveSampling,
  calculateSamplingThreshold,
} from './sampling'
import type { WaveformPoint } from '../types'

describe('downsampleLTTB', () => {
  it('returns empty array for empty input', () => {
    expect(downsampleLTTB([], 100)).toEqual([])
  })

  it('returns original data when threshold >= data length', () => {
    const data: WaveformPoint[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]
    expect(downsampleLTTB(data, 5)).toEqual(data)
    expect(downsampleLTTB(data, 3)).toEqual(data)
  })

  it('preserves first and last points', () => {
    const data: WaveformPoint[] = Array.from({ length: 1000 }, (_, i) => ({
      x: i,
      y: Math.sin(i / 100),
    }))
    const sampled = downsampleLTTB(data, 50)

    expect(sampled[0]).toEqual(data[0])
    expect(sampled[sampled.length - 1]).toEqual(data[data.length - 1])
  })

  it('reduces data to approximately threshold length', () => {
    const data: WaveformPoint[] = Array.from({ length: 10000 }, (_, i) => ({
      x: i,
      y: Math.sin(i / 100),
    }))
    const threshold = 500
    const sampled = downsampleLTTB(data, threshold)

    expect(sampled.length).toBe(threshold)
  })

  it('maintains sorted order', () => {
    const data: WaveformPoint[] = Array.from({ length: 1000 }, (_, i) => ({
      x: i,
      y: Math.random(),
    }))
    const sampled = downsampleLTTB(data, 100)

    for (let i = 1; i < sampled.length; i++) {
      expect(sampled[i]!.x).toBeGreaterThan(sampled[i - 1]!.x)
    }
  })

  it('handles minimum threshold of 3', () => {
    const data: WaveformPoint[] = Array.from({ length: 1000 }, (_, i) => ({
      x: i,
      y: i,
    }))
    const sampled = downsampleLTTB(data, 2)

    expect(sampled.length).toBeGreaterThanOrEqual(2)
  })

  it('preserves peaks in sine wave', () => {
    // 生成包含明确峰值的正弦波
    const data: WaveformPoint[] = Array.from({ length: 1000 }, (_, i) => ({
      x: i,
      y: Math.sin((i / 1000) * Math.PI * 4), // 4个周期
    }))
    const sampled = downsampleLTTB(data, 100)

    // 检查是否保留了接近峰值的点
    const maxY = Math.max(...sampled.map((p) => p.y))
    const minY = Math.min(...sampled.map((p) => p.y))

    expect(maxY).toBeGreaterThan(0.9) // 接近1
    expect(minY).toBeLessThan(-0.9) // 接近-1
  })
})

describe('downsampleMinMax', () => {
  it('returns empty array for empty input', () => {
    expect(downsampleMinMax([], 100)).toEqual([])
  })

  it('returns original data when threshold >= data length', () => {
    const data: WaveformPoint[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]
    expect(downsampleMinMax(data, 5)).toEqual(data)
  })

  it('captures min and max values in each bucket', () => {
    const data: WaveformPoint[] = [
      { x: 0, y: 5 },
      { x: 1, y: 1 }, // min
      { x: 2, y: 10 }, // max
      { x: 3, y: 3 },
      { x: 4, y: 7 },
    ]
    const sampled = downsampleMinMax(data, 2)

    // 应该包含最小值和最大值
    const yValues = sampled.map((p) => p.y)
    expect(yValues).toContain(1)
    expect(yValues).toContain(10)
  })

  it('maintains sorted order', () => {
    const data: WaveformPoint[] = Array.from({ length: 1000 }, (_, i) => ({
      x: i,
      y: Math.random(),
    }))
    const sampled = downsampleMinMax(data, 100)

    for (let i = 1; i < sampled.length; i++) {
      expect(sampled[i]!.x).toBeGreaterThanOrEqual(sampled[i - 1]!.x)
    }
  })

  it('preserves overall range of data', () => {
    const data: WaveformPoint[] = Array.from({ length: 1000 }, (_, i) => ({
      x: i,
      y: Math.sin(i / 100) * 100,
    }))
    const sampled = downsampleMinMax(data, 50)

    const originalMax = Math.max(...data.map((p) => p.y))
    const originalMin = Math.min(...data.map((p) => p.y))
    const sampledMax = Math.max(...sampled.map((p) => p.y))
    const sampledMin = Math.min(...sampled.map((p) => p.y))

    expect(Math.abs(sampledMax - originalMax)).toBeLessThan(1)
    expect(Math.abs(sampledMin - originalMin)).toBeLessThan(1)
  })
})

describe('adaptiveSampling', () => {
  it('returns original data when below threshold', () => {
    const data: WaveformPoint[] = Array.from({ length: 100 }, (_, i) => ({
      x: i,
      y: i,
    }))
    const result = adaptiveSampling(data, 500)

    expect(result.points).toEqual(data)
    expect(result.algorithm).toBe('none')
    expect(result.originalCount).toBe(100)
  })

  it('uses LTTB for moderate data sets', () => {
    const data: WaveformPoint[] = Array.from({ length: 10000 }, (_, i) => ({
      x: i,
      y: Math.sin(i / 100),
    }))
    const result = adaptiveSampling(data, 1000)

    expect(result.points.length).toBeLessThanOrEqual(1000)
    expect(result.algorithm).toBe('lttb')
    expect(result.originalCount).toBe(10000)
  })

  it('uses MinMax for very large data sets', () => {
    const data: WaveformPoint[] = Array.from({ length: 100000 }, (_, i) => ({
      x: i,
      y: Math.sin(i / 100),
    }))
    const result = adaptiveSampling(data, 1000)

    expect(result.points.length).toBeGreaterThan(0)
    expect(result.algorithm).toBe('minmax')
    expect(result.originalCount).toBe(100000)
  })

  it('respects custom maxPoints parameter', () => {
    const data: WaveformPoint[] = Array.from({ length: 10000 }, (_, i) => ({
      x: i,
      y: i,
    }))
    const result = adaptiveSampling(data, 200)

    expect(result.points.length).toBeLessThanOrEqual(200)
  })
})

describe('calculateSamplingThreshold', () => {
  it('returns reasonable threshold for typical viewport', () => {
    const threshold = calculateSamplingThreshold(1000, 1, 2)
    expect(threshold).toBe(2000)
  })

  it('scales with pixel ratio', () => {
    const threshold1x = calculateSamplingThreshold(1000, 1, 2)
    const threshold2x = calculateSamplingThreshold(1000, 2, 2)

    expect(threshold2x).toBe(threshold1x * 2)
  })

  it('scales with points per pixel', () => {
    const threshold2pp = calculateSamplingThreshold(1000, 1, 2)
    const threshold4pp = calculateSamplingThreshold(1000, 1, 4)

    expect(threshold4pp).toBe(threshold2pp * 2)
  })

  it('returns minimum of 100 points', () => {
    const threshold = calculateSamplingThreshold(10, 1, 1)
    expect(threshold).toBeGreaterThanOrEqual(100)
  })

  it('handles high DPI displays', () => {
    const threshold = calculateSamplingThreshold(1920, 2, 2)
    expect(threshold).toBe(7680)
  })
})
