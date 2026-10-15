import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PngExporter } from '@/export/PngExporter'
import { init } from '@/chart/init'
import type { WaveformChartInstance } from '@/types/native'
import { flushNativeUpdates } from '../support/nativeChart'

class ControlledImage {
  static autoLoad = true
  static instances: ControlledImage[] = []
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  current = ''
  constructor() {
    ControlledImage.instances.push(this)
  }
  set src(value: string) {
    this.current = value
    if (value && ControlledImage.autoLoad) this.onload?.()
  }
}
const exporters: PngExporter[] = []
const charts: WaveformChartInstance[] = []
const originalImage = globalThis.Image
const originalURL = globalThis.URL
let revoke: ReturnType<typeof vi.fn>
let draw = vi.fn<(...args: unknown[]) => void>()
let canvases: HTMLCanvasElement[]
let dimensions: number[][]
beforeEach(() => {
  canvases = []
  dimensions = []
  ControlledImage.instances = []
  ControlledImage.autoLoad = true
  vi.stubGlobal('Image', ControlledImage)
  revoke = vi.fn()
  draw = vi.fn<(...args: unknown[]) => void>()
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:export'), revokeObjectURL: revoke })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    return {
      measureText: (text: string) => ({ width: text.length * 8 }),
      drawImage: (...args: unknown[]) => {
        canvases.push(this)
        draw(...args)
      },
    } as unknown as CanvasRenderingContext2D
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback,
  ) {
    dimensions.push([this.width, this.height])
    callback(new Blob(['png'], { type: 'image/png' }))
  })
})
afterEach(() => {
  exporters.splice(0).forEach((exporter) => exporter.dispose())
  charts.splice(0).forEach((chart) => chart.dispose())
  vi.restoreAllMocks()
  vi.stubGlobal('Image', originalImage)
  vi.stubGlobal('URL', originalURL)
  vi.useRealTimers()
})
function exporter() {
  const result = new PngExporter(document)
  exporters.push(result)
  return result
}
const svg = () => new Blob(['<svg/>'], { type: 'image/svg+xml' })
const size = { width: 300, height: 200 }
async function tick() {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}
function cleaned() {
  expect(revoke).toHaveBeenCalledWith('blob:export')
  for (const image of ControlledImage.instances) {
    expect(image.current).toBe('')
    expect(image.onload).toBeNull()
    expect(image.onerror).toBeNull()
  }
  for (const canvas of canvases) expect([canvas.width, canvas.height]).toEqual([0, 0])
  expect(document.querySelector('canvas, a[download]')).toBeNull()
}

describe('PNG export resources', () => {
  it('encodes scaled dimensions and clears temporary resources without downloading', async () => {
    await expect(exporter().render(svg(), size, 2)).resolves.toMatchObject({ type: 'image/png' })
    expect(dimensions).toEqual([[600, 400]])
    expect(draw).toHaveBeenCalledOnce()
    cleaned()
  })
  it.each([0, -1, NaN, Infinity, 5])(
    'rejects invalid scale %s before creating resources',
    async (scale) => {
      await expect(exporter().render(svg(), size, scale)).rejects.toMatchObject({
        code: 'export-invalid-options',
      })
      expect(URL.createObjectURL).not.toHaveBeenCalled()
    },
  )
  it.each([0, NaN, Infinity])('rejects unavailable dimensions %s', async (width) => {
    await expect(exporter().render(svg(), { width, height: 200 })).rejects.toMatchObject({
      code: 'export-unavailable',
    })
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
  it('handles a decoder failure and permits a subsequent retry', async () => {
    ControlledImage.autoLoad = false
    const png = exporter()
    const result = png.render(svg(), size)
    const assertion = expect(result).rejects.toMatchObject({ code: 'export-render-failed' })
    ControlledImage.instances[0]!.onerror?.()
    await assertion
    cleaned()
    ControlledImage.autoLoad = true
    await expect(png.render(svg(), size)).resolves.toMatchObject({ type: 'image/png' })
    expect(revoke).toHaveBeenCalledTimes(2)
  })
  it.each(['context', 'draw', 'null-blob', 'encode-throw'] as const)(
    'cleans up after %s failure',
    async (failure) => {
      if (failure === 'context')
        vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null)
      if (failure === 'draw')
        draw.mockImplementation(() => {
          throw new Error('draw failed')
        })
      if (failure === 'null-blob')
        vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) =>
          callback(null),
        )
      if (failure === 'encode-throw')
        vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation(() => {
          throw new Error('encode failed')
        })
      await expect(exporter().render(svg(), size)).rejects.toMatchObject({
        code: 'export-render-failed',
      })
      cleaned()
    },
  )
  it('cancels pending decoding and rejects concurrent attempts', async () => {
    ControlledImage.autoLoad = false
    const png = exporter()
    const result = png.render(svg(), size)
    await expect(png.render(svg(), size)).rejects.toMatchObject({ code: 'export-busy' })
    png.dispose()
    await expect(result).rejects.toMatchObject({ code: 'export-cancelled' })
    cleaned()
    await expect(png.render(svg(), size)).rejects.toMatchObject({ code: 'export-cancelled' })
  })
  it('cancels pending encoding and ignores a late callback', async () => {
    let encode!: BlobCallback
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => {
      encode = callback
    })
    const png = exporter()
    const result = png.render(svg(), size)
    await tick()
    png.dispose()
    await expect(result).rejects.toMatchObject({ code: 'export-cancelled' })
    encode(new Blob(['late']))
    await tick()
    cleaned()
  })
  it.each(['resize', 'timeout', 'dispose'] as const)(
    'cleans PNG resources when chart export stops on %s',
    async (reason) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      ControlledImage.autoLoad = false
      const chart = init(
        document.createElement('div'),
        {
          width: 300,
          height: 400,
          animationEnabled: false,
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ],
          },
        },
        { autoResize: false },
      )
      charts.push(chart)
      await flushNativeUpdates()
      await vi.advanceTimersByTimeAsync(100)
      await flushNativeUpdates()
      const result = chart.exportImage()
      void result.catch(() => {})
      await tick()
      await vi.advanceTimersByTimeAsync(16)
      expect(ControlledImage.instances).toHaveLength(1)
      const code = {
        resize: 'export-stale',
        timeout: 'export-timeout',
        dispose: 'export-cancelled',
      }[reason]
      const assertion = expect(result).rejects.toMatchObject({ code })
      if (reason === 'resize') chart.setOption({ width: 360 })
      else if (reason === 'timeout') await vi.advanceTimersByTimeAsync(5000)
      else chart.dispose()
      await assertion
      await tick()
      cleaned()
      // The live resized chart may publish sampling diagnostics independently of export cleanup.
      if (reason === 'resize') {
        await flushNativeUpdates()
        await vi.advanceTimersByTimeAsync(100)
      }
      expect(vi.getTimerCount()).toBe(0)
      if (reason !== 'dispose') {
        ControlledImage.autoLoad = true
        await flushNativeUpdates()
        await expect(chart.exportImage()).resolves.toMatchObject({ type: 'image/png' })
      }
    },
  )
})
