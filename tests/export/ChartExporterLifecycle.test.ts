import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChartEventEmitter } from '@/chart/ChartEventEmitter'
import { ChartUpdateScheduler } from '@/chart/ChartUpdateScheduler'
import { ChartExporter } from '@/export/ChartExporter'
import { SvgExporter } from '@/export/SvgExporter'

const exporters: ChartExporter[] = []
const originalCSS = globalThis.CSS
beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }))
afterEach(() => {
  exporters.splice(0).forEach((exporter) => exporter.dispose())
  vi.restoreAllMocks()
  vi.stubGlobal('CSS', originalCSS)
  vi.useRealTimers()
})

function harness() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '800')
  svg.setAttribute('height', '400')
  const size = { width: 800, height: 400 }
  const frames = new Map<number, () => void>()
  let id = 0
  let stable = true
  const scheduler = new ChartUpdateScheduler(
    {
      request: (callback) => {
        frames.set(++id, callback)
        return id
      },
      cancel: (handle) => frames.delete(handle),
    },
    { data() {}, layout() {}, sampling() {}, view: () => true, isStable: () => stable },
    new ChartEventEmitter(),
  )
  const exporter = new ChartExporter(svg, scheduler, () => size)
  exporters.push(exporter)
  const frame = () => {
    const queued = [...frames.values()]
    frames.clear()
    queued.forEach((callback) => callback())
  }
  scheduler.invalidate('data')
  frame()
  return { exporter, scheduler, size, frame, setStable: (value: boolean) => (stable = value) }
}

function fonts() {
  let finish!: () => void
  const ready = new Promise<void>((resolve) => (finish = resolve))
  const original = Object.getOwnPropertyDescriptor(document, 'fonts')
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready } })
  return {
    finish,
    restore() {
      if (original) Object.defineProperty(document, 'fonts', original)
      else Reflect.deleteProperty(document, 'fonts')
    },
  }
}

async function microtasks() {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}

describe('native export lifecycle', () => {
  it('rechecks queued font measurement frames before serializing the same revision', async () => {
    const pending = fonts()
    try {
      const { exporter, scheduler, frame } = harness()
      const serialize = vi.spyOn(SvgExporter.prototype, 'serialize')
      const revision = scheduler.revision
      const result = exporter.exportImage({ format: 'svg' })
      await microtasks()
      scheduler.refresh('layout')
      pending.finish()
      await microtasks()
      expect(scheduler.revision).toBe(revision)
      expect(serialize).not.toHaveBeenCalled()
      frame()
      await expect(result).resolves.toBeInstanceOf(Blob)
      expect(serialize).toHaveBeenCalledOnce()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      pending.restore()
    }
  })

  it('captures validated options before the caller mutates them', async () => {
    const pending = fonts()
    vi.stubGlobal('CSS', { supports: () => true })
    try {
      const { exporter } = harness()
      const serialize = vi.spyOn(SvgExporter.prototype, 'serialize')
      const options = { format: 'svg' as const, backgroundColor: '#123456' }
      const result = exporter.exportImage(options)
      options.backgroundColor = 'invalid color'
      pending.finish()
      await expect(result).resolves.toBeInstanceOf(Blob)
      expect(serialize.mock.calls[0]?.[1]).toBe('#123456')
    } finally {
      pending.restore()
    }
  })

  it('times out unstable sampling/animation and allows a stable retry without timers', async () => {
    const { exporter, setStable, scheduler, frame } = harness()
    setStable(false)
    const result = exporter.exportImage({ format: 'svg' })
    const assertion = expect(result).rejects.toMatchObject({ code: 'export-timeout' })
    await vi.advanceTimersByTimeAsync(5000)
    await assertion
    expect(vi.getTimerCount()).toBe(0)
    setStable(true)
    scheduler.refresh()
    frame()
    await expect(exporter.exportImage({ format: 'svg' })).resolves.toBeInstanceOf(Blob)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['timeout', 'dispose', 'invalidate'] as const)(
    'does not resume serialization when fonts resolve after %s',
    async (reason) => {
      const pending = fonts()
      try {
        const { exporter } = harness()
        const serialize = vi.spyOn(SvgExporter.prototype, 'serialize')
        const result = exporter.exportImage({ format: 'svg' })
        const code = {
          timeout: 'export-timeout',
          dispose: 'export-cancelled',
          invalidate: 'export-stale',
        }[reason]
        const assertion = expect(result).rejects.toMatchObject({ code })
        await microtasks()
        if (reason === 'timeout') await vi.advanceTimersByTimeAsync(5000)
        else exporter[reason]()
        await assertion
        pending.finish()
        await microtasks()
        expect(serialize).not.toHaveBeenCalled()
        expect(vi.getTimerCount()).toBe(0)
        if (reason !== 'dispose')
          await expect(exporter.exportImage({ format: 'svg' })).resolves.toBeInstanceOf(Blob)
      } finally {
        pending.restore()
      }
    },
  )

  it('rejects a size change while waiting instead of encoding old dimensions', async () => {
    const { exporter, size, setStable } = harness()
    setStable(false)
    const result = exporter.exportImage({ format: 'svg' })
    const assertion = expect(result).rejects.toMatchObject({ code: 'export-stale' })
    size.width = 900
    await vi.advanceTimersByTimeAsync(16)
    await assertion
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects a new business revision while waiting without an explicit invalidate hook', async () => {
    const { exporter, scheduler, setStable } = harness()
    setStable(false)
    const result = exporter.exportImage({ format: 'svg' })
    const assertion = expect(result).rejects.toMatchObject({ code: 'export-stale' })
    scheduler.invalidate('data')
    await vi.advanceTimersByTimeAsync(16)
    await assertion
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears the waiting poll immediately on disposal', async () => {
    const { exporter, setStable } = harness()
    setStable(false)
    const result = exporter.exportImage({ format: 'svg' })
    exporter.dispose()
    await expect(result).rejects.toMatchObject({ code: 'export-cancelled' })
    expect(vi.getTimerCount()).toBe(0)
    await expect(exporter.exportImage({ format: 'svg' })).rejects.toMatchObject({
      code: 'export-cancelled',
    })
  })
})
