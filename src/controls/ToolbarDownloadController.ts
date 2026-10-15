import type { WaveformImageExportOptions } from '../types/controls'

/** Owns download resources and asynchronous feedback; the instance export API returns only Blob. */
export class ToolbarDownloadController {
  busy = false
  feedback = ''
  private disposed = false

  constructor(
    private readonly document: Document,
    private readonly generate: (options: WaveformImageExportOptions) => Promise<Blob>,
    private readonly changed: () => void,
  ) {}

  async download(format: 'png' | 'svg') {
    if (this.disposed || this.busy) return
    this.busy = true
    this.feedback = ''
    this.changed()
    try {
      const blob = await this.generate({ format })
      if (this.disposed) return
      const owner = this.document.defaultView!
      const url = owner.URL.createObjectURL(blob)
      const link = this.document.createElement('a')
      try {
        link.href = url
        link.download = `waveform.${format}`
        this.document.body.append(link)
        link.click()
      } finally {
        link.remove()
        owner.URL.revokeObjectURL(url)
      }
    } catch (error) {
      if (!this.disposed)
        this.feedback = error instanceof Error ? error.message : '导出失败，请重试'
    } finally {
      this.busy = false
      if (!this.disposed) this.changed()
    }
  }

  dispose() {
    this.disposed = true
  }
}
