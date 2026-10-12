import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useChartImageExport } from '@/components/controls/useChartImageExport'
import { createChartSnapshot } from '@/components/controls/chartSnapshot'
import { mountSizedChart } from '@tests/support/waveformChart'

const originalURL = globalThis.URL
const originalImage = globalThis.Image

function harness(ready = true, width = 300) {
  const version = ref(0)
  const stable = ref(ready)
  const container = document.createElement('div')
  container.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><text>中文波形</text></svg>'
  document.body.appendChild(container)
  let api!: ReturnType<typeof useChartImageExport>
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useChartImageExport({
          container: () => container,
          svg: () => container.querySelector('svg')!,
          size: () => ({ width, height: 200, titleHeight: 0 }),
          version: () => version.value,
          ready: () => stable.value,
        })
        return () => null
      },
    }),
  )
  return {
    api,
    version,
    stable,
    close: () => {
      wrapper.unmount()
      container.remove()
    },
  }
}
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  globalThis.URL = originalURL
  globalThis.Image = originalImage
})
describe('chart image export', () => {
  it('exports SVG after stable sampling without initiating a download', async () => {
    const h = harness(false)
    const result = h.api.exportImage({ format: 'svg' })
    h.stable.value = true
    const blob = await result
    expect(blob.type).toBe('image/svg+xml')
    expect(blob.size).toBeGreaterThan(100)
    h.close()
  })
  it('rejects invalid sizes/options and concurrent calls', async () => {
    const empty = harness(true, 0)
    await expect(empty.api.exportImage()).rejects.toMatchObject({ code: 'export-unavailable' })
    empty.close()
    const h = harness(false)
    for (const options of [
      { scale: 0 },
      { scale: 5 },
      { format: 'svg' as const, scale: 2 },
      { scale: NaN },
    ])
      await expect(h.api.exportImage(options)).rejects.toMatchObject({
        code: 'export-invalid-options',
      })
    const first = h.api.exportImage({ format: 'svg' })
    const rejected = expect(first).rejects.toMatchObject({ code: 'export-stale' })
    await expect(h.api.exportImage()).rejects.toMatchObject({ code: 'export-busy' })
    h.version.value++
    await rejected
    h.stable.value = true
    expect((await h.api.exportImage({ format: 'svg' })).type).toBe('image/svg+xml')
    h.close()
  })
  it('cancels on unmount and bounds the total wait to five seconds', async () => {
    vi.useFakeTimers()
    const h = harness(false)
    const result = h.api.exportImage()
    const assertion = expect(result).rejects.toMatchObject({ code: 'export-timeout' })
    await vi.advanceTimersByTimeAsync(5000)
    await assertion
    const cancelled = h.api.exportImage()
    const cancellation = expect(cancelled).rejects.toMatchObject({ code: 'export-cancelled' })
    h.close()
    await cancellation
    await expect(h.api.exportImage()).rejects.toMatchObject({ code: 'export-cancelled' })
    expect(vi.getTimerCount()).toBe(0)
  })
  it('creates PNG with scaled dimensions and cleans up URLs and canvas', async () => {
    const create = vi.fn(() => 'blob:test'),
      revoke = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        set src(value: string) {
          if (value) queueMicrotask(() => this.onload?.())
        }
      },
    )
    const drawImage = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D)
    const dimensions: number[][] = []
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback,
    ) {
      dimensions.push([this.width, this.height])
      callback(new Blob(['png'], { type: 'image/png' }))
    })
    const h = harness()
    expect((await h.api.exportImage({ scale: 2 })).type).toBe('image/png')
    expect(dimensions).toEqual([[600, 400]])
    expect(drawImage).toHaveBeenCalledOnce()
    expect(revoke).toHaveBeenCalledWith('blob:test')
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => callback(null))
    await expect(h.api.exportImage()).rejects.toMatchObject({ code: 'export-render-failed' })
    expect(revoke).toHaveBeenCalledTimes(2)
    h.close()
  })
  it('removes interaction layers and serializes legends without foreignObject', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      measureText: (text: string) => ({ width: text.length * 14 }),
    } as unknown as CanvasRenderingContext2D)
    const container = document.createElement('div')
    container.innerHTML = `<span class="waveform-chart__title-text">中文标题</span><svg width="300" height="200"><defs><clipPath id="a"><rect width="10" height="10"/></clipPath></defs><path clip-path="url(http://localhost/#a)" stroke="red" d="M0 0L10 10"/><g class="waveform-chart__hover-layer"><text>hover</text></g><rect class="waveform-chart__overlay"/><rect class="waveform-chart__zoom-selection"/><foreignObject width="200"><div class="waveform-legend__panel"><button class="waveform-legend__item"><svg><path stroke="red"/></svg><span class="waveform-legend__label">通道甲</span></button></div></foreignObject><text>注解</text></svg>`
    document.body.appendChild(container)
    const result = createChartSnapshot(
      container,
      container.querySelector('svg')!,
      300,
      240,
      40,
      '#fff',
    )
    const parsed = new DOMParser().parseFromString(result, 'image/svg+xml')
    expect(parsed.querySelector('parsererror')).toBeNull()
    expect(parsed.documentElement.textContent).toContain('中文标题')
    expect(result).toContain('通道甲')
    expect(result).toContain('注解')
    expect(result).toContain('url(#a)')
    expect(result).not.toContain('foreignObject')
    expect(result).not.toContain('hover-layer')
    expect(result).not.toContain('zoom-selection')
    container.remove()
  })
  it('integrates raw sampling and rejects data replacement during font wait', async () => {
    let finish!: () => void
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        ready: new Promise<void>((r) => {
          finish = r
        }),
      },
    })
    const w = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 1 },
          { x: 1, y: 2 },
        ],
      },
      { rendering: { sampling: { mode: 'raw' } } },
    )
    const first = w.vm.exportImage({ format: 'svg' })
    const rejection = expect(first).rejects.toMatchObject({ code: 'export-stale' })
    await flushPromises()
    await w.setProps({
      data: {
        kind: 'points',
        points: [
          { x: 0, y: 3 },
          { x: 2, y: 4 },
        ],
      },
    })
    await rejection
    finish()
    expect((await w.vm.exportImage({ format: 'svg' })).type).toBe('image/svg+xml')
    w.unmount()
    Reflect.deleteProperty(document, 'fonts')
  })
})
