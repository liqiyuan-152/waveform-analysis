import { afterEach, describe, expect, it, vi } from 'vitest'
import { init } from '@/chart/init'
import type { WaveformChartInstance } from '@/types/native'
import type { WaveformImageExportOptions } from '@/types/controls'
import { flushNativeUpdates } from '../support/nativeChart'

const instances: WaveformChartInstance[] = []
afterEach(() => {
  instances.forEach((instance) => instance.dispose())
  instances.length = 0
  vi.useRealTimers()
})

function chart(width = 800) {
  const host = document.createElement('div')
  const instance = init(
    host,
    {
      width,
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
  instances.push(instance)
  return instance
}

describe('native export version and cancellation barriers', () => {
  it('resolves a pending export when its frame commits without advancing polling timers', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const instance = chart()
    const waiting = instance.exportImage({ format: 'svg' })
    await flushNativeUpdates()
    await expect(waiting).resolves.toBeInstanceOf(Blob)
  })

  it('exports stable SVG independently of past finished subscriptions', async () => {
    const instance = chart()
    await flushNativeUpdates()
    const blob = await instance.exportImage({ format: 'svg' })
    expect(blob.type).toBe('image/svg+xml')
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsText(blob)
    })
    const snapshot = new DOMParser().parseFromString(text, 'image/svg+xml')
    expect(snapshot.querySelector('parsererror')).toBeNull()
    expect(snapshot.documentElement.getAttribute('width')).toBe('800')
    expect(snapshot.querySelector('.waveform-chart__line')).not.toBeNull()
  })

  it('rejects concurrent exports and cancels waiting exports on disposal', async () => {
    const instance = chart()
    const waiting = instance.exportImage({ format: 'svg' })
    await expect(instance.exportImage({ format: 'svg' })).rejects.toMatchObject({
      code: 'export-busy',
    })
    instance.dispose()
    await expect(waiting).rejects.toMatchObject({ code: 'export-cancelled' })
  })

  it('rejects superseded revisions but not failed option updates', async () => {
    const instance = chart()
    const waiting = instance.exportImage({ format: 'svg' })
    expect(() => instance.setOption({ data: undefined })).toThrow()
    instance.setOption({ lineColor: 'red' })
    await expect(waiting).rejects.toMatchObject({ code: 'export-stale' })
    await flushNativeUpdates()
    await expect(instance.exportImage({ format: 'svg' })).resolves.toBeInstanceOf(Blob)
  })

  it.each([null, { format: 'gif' }, { scale: 0 }, { scale: 5 }, { format: 'svg', scale: 2 }])(
    'rejects invalid export options: %j',
    async (options) => {
      const instance = chart()
      await expect(
        instance.exportImage(options as WaveformImageExportOptions),
      ).rejects.toMatchObject({ code: 'export-invalid-options' })
    },
  )

  it('rejects exports from zero-size containers', async () => {
    await expect(chart(0).exportImage({ format: 'svg' })).rejects.toMatchObject({
      code: 'export-unavailable',
    })
  })

  it('rejects captured dimensions on resize and retries with the new dimensions', async () => {
    const instance = chart()
    const waiting = instance.exportImage({ format: 'svg' })
    const assertion = expect(waiting).rejects.toMatchObject({ code: 'export-stale' })
    instance.setOption({ width: 360 })
    instance.resize()
    await assertion
    await flushNativeUpdates()
    await expect(instance.exportImage({ format: 'svg' })).resolves.toBeInstanceOf(Blob)
  })
})
