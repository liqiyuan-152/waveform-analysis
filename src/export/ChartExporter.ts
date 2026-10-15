import type { ChartUpdateScheduler } from '../chart/ChartUpdateScheduler'
import type { WaveformImageExportOptions } from '../types/controls'
import { imageExportError } from './imageExportError'
import { SvgExporter } from './SvgExporter'
import { PngExporter } from './PngExporter'

/** Owns one cancellable export; a captured revision prevents mixed-version snapshots. */
export class ChartExporter {
  private disposed = false
  private busy = false
  private abort?: (error: Error) => void
  private readonly svgExporter = new SvgExporter()

  constructor(
    private readonly svg: SVGSVGElement,
    private readonly scheduler: ChartUpdateScheduler,
    private readonly size: () => { width: number; height: number; titleHeight?: number },
  ) {}

  invalidate() {
    this.abort?.(imageExportError('export-stale'))
  }

  async exportImage(options: WaveformImageExportOptions = {}): Promise<Blob> {
    if (this.disposed) throw imageExportError('export-cancelled')
    if (!options || typeof options !== 'object' || Array.isArray(options))
      throw imageExportError('export-invalid-options')
    const format = options.format ?? 'png'
    const scale = options.scale ?? 1
    const background = options.backgroundColor
    const document = this.svg.ownerDocument
    const window = document.defaultView!
    if (
      !['svg', 'png'].includes(format) ||
      !Number.isFinite(scale) ||
      scale <= 0 ||
      scale > 4 ||
      (format === 'svg' && scale !== 1) ||
      (background !== undefined &&
        (typeof background !== 'string' || !window.CSS?.supports('color', background)))
    )
      throw imageExportError('export-invalid-options')
    if (this.busy) throw imageExportError('export-busy')
    const size = { ...this.size() }
    if (
      !Number.isFinite(size.width) ||
      !Number.isFinite(size.height) ||
      size.width <= 0 ||
      size.height <= 0
    )
      throw imageExportError('export-unavailable')
    this.busy = true
    const revision = this.scheduler.revision
    let stopped = false
    let timeout: number | undefined
    let poll: number | undefined
    let unsubscribe: (() => void) | undefined
    let rejectPoll: ((error: Error) => void) | undefined
    let png: PngExporter | undefined
    const check = () => {
      if (this.disposed) throw imageExportError('export-cancelled')
      if (revision !== this.scheduler.revision) throw imageExportError('export-stale')
      const currentSize = this.size()
      if (size.width !== currentSize.width || size.height !== currentSize.height)
        throw imageExportError('export-stale')
      if (stopped) throw imageExportError('export-timeout')
    }
    const cancellation = new Promise<never>((_, reject) => {
      this.abort = reject
      timeout = window.setTimeout(() => reject(imageExportError('export-timeout')), 5000)
    })
    const waitStable = () =>
      new Promise<void>((resolve, reject) => {
        rejectPoll = reject
        const test = () => {
          window.clearTimeout(poll)
          if (stopped) return
          try {
            check()
            if (this.scheduler.isStable(revision)) {
              unsubscribe?.()
              unsubscribe = undefined
              rejectPoll = undefined
              resolve()
            } else poll = window.setTimeout(test, 16)
          } catch (error) {
            reject(error)
          }
        }
        unsubscribe = this.scheduler.onFrameSettled(test)
        test()
      })
    const wait = <T>(promise: PromiseLike<T> | T) => Promise.race([cancellation, promise])
    const generate = async () => {
      await wait(waitStable())
      check()
      await wait(document.fonts?.ready)
      check()
      // Font measurements, sampling and animation may queue frames without a new revision.
      await wait(waitStable())
      check()
      const container = this.svg.parentElement
      const snapshot = this.svgExporter.serialize(
        this.svg,
        background,
        container
          ? {
              container,
              ...size,
              titleHeight: this.size().titleHeight ?? 0,
            }
          : undefined,
      )
      const blob = new window.Blob([snapshot], { type: 'image/svg+xml' })
      if (format === 'svg') return blob
      png = new PngExporter(document)
      const result = await wait(png.render(blob, size, scale))
      check()
      return result
    }
    try {
      return await Promise.race([cancellation, generate()])
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error
      throw imageExportError('export-render-failed')
    } finally {
      stopped = true
      window.clearTimeout(timeout)
      window.clearTimeout(poll)
      unsubscribe?.()
      rejectPoll?.(imageExportError('export-cancelled'))
      png?.dispose()
      this.abort = undefined
      this.busy = false
    }
  }

  dispose() {
    this.disposed = true
    this.abort?.(imageExportError('export-cancelled'))
  }
}
