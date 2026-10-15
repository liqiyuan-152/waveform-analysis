import { imageExportError } from './imageExportError'

/** Owns the decoding/encoding resources for one PNG attempt, including cancellation. */
export class PngExporter {
  private disposed = false
  private busy = false
  private cancel?: () => void

  constructor(private readonly document: Document) {}

  async render(svg: Blob, size: { width: number; height: number }, scale = 1): Promise<Blob> {
    if (this.disposed) throw imageExportError('export-cancelled')
    if (!Number.isFinite(scale) || scale <= 0 || scale > 4)
      throw imageExportError('export-invalid-options')
    const width = Math.round(size.width * scale)
    const height = Math.round(size.height * scale)
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
      throw imageExportError('export-unavailable')
    if (this.busy) throw imageExportError('export-busy')
    this.busy = true
    const window = this.document.defaultView!
    let url: string | undefined
    let image: HTMLImageElement | undefined
    let canvas: HTMLCanvasElement | undefined
    const cancelled = new Promise<never>((_, reject) => {
      this.cancel = () => reject(imageExportError('export-cancelled'))
    })
    const check = () => {
      if (this.disposed) throw imageExportError('export-cancelled')
    }
    try {
      url = window.URL.createObjectURL(svg)
      image = new window.Image()
      await Promise.race([
        cancelled,
        new Promise<void>((resolve, reject) => {
          image!.onload = () => resolve()
          image!.onerror = () => reject(imageExportError('export-render-failed'))
          image!.src = url!
        }),
      ])
      check()
      canvas = this.document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) throw imageExportError('export-render-failed')
      context.drawImage(image, 0, 0, width, height)
      const result = await Promise.race([
        cancelled,
        new Promise<Blob>((resolve, reject) => {
          canvas!.toBlob(
            (blob) => (blob ? resolve(blob) : reject(imageExportError('export-render-failed'))),
            'image/png',
          )
        }),
      ])
      check()
      return result
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error
      throw imageExportError('export-render-failed')
    } finally {
      if (image) {
        image.onload = null
        image.onerror = null
        image.src = ''
      }
      if (url) window.URL.revokeObjectURL(url)
      if (canvas) {
        canvas.width = 0
        canvas.height = 0
      }
      this.cancel = undefined
      this.busy = false
    }
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.cancel?.()
  }
}
