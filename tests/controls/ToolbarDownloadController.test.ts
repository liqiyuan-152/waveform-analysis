import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToolbarDownloadController } from '@/controls/ToolbarDownloadController'

afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
})
describe('native toolbar download ownership', () => {
  it('reports failure, retries, and releases URL/link after successful download', async () => {
    const generate = vi
      .fn()
      .mockRejectedValueOnce(new Error('导出失败'))
      .mockResolvedValue(new Blob(['svg']))
    const changed = vi.fn(),
      view = new ToolbarDownloadController(document, generate, changed)
    await view.download('png')
    expect(view.busy).toBe(false)
    expect(view.feedback).toBe('导出失败')
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:toolbar')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toBe('waveform.svg')
      expect(this.isConnected).toBe(true)
    })
    await view.download('svg')
    expect(generate).toHaveBeenLastCalledWith({ format: 'svg' })
    expect(create).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(revoke).toHaveBeenCalledWith('blob:toolbar')
    expect(document.querySelector('a[download]')).toBeNull()
    expect(view.feedback).toBe('')
    expect(view.busy).toBe(false)
    expect(changed).toHaveBeenCalledTimes(4)
    view.dispose()
  })

  it('deduplicates busy clicks and never downloads or refreshes after disposal', async () => {
    let resolve!: (blob: Blob) => void
    const generate = vi.fn(
      () =>
        new Promise<Blob>((complete) => {
          resolve = complete
        }),
    )
    const changed = vi.fn(),
      view = new ToolbarDownloadController(document, generate, changed)
    const first = view.download('svg')
    await view.download('png')
    expect(generate).toHaveBeenCalledOnce()
    expect(view.busy).toBe(true)
    view.dispose()
    resolve(new Blob(['svg']))
    await first
    expect(view.busy).toBe(false)
    expect(changed).toHaveBeenCalledOnce()
    expect(document.querySelector('a[download]')).toBeNull()
    await view.download('svg')
    expect(generate).toHaveBeenCalledOnce()
  })

  it('releases the URL even when clicking the download link throws', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:toolbar')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('下载失败')
    })
    const view = new ToolbarDownloadController(
      document,
      async () => new Blob(),
      () => {},
    )
    await view.download('svg')
    expect(view.feedback).toBe('下载失败')
    expect(revoke).toHaveBeenCalledOnce()
    expect(document.querySelector('a[download]')).toBeNull()
    view.dispose()
  })
})
