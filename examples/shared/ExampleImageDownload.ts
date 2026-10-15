import type { WaveformChartInstance } from 'waveform-analysis/native'

/** The consumer owns downloads; exportImage itself only returns a Blob. */
export class ExampleImageDownload {
  private disposed = false
  private busy = false

  constructor(
    private readonly chart: WaveformChartInstance,
    private readonly document: Document,
    private readonly changed: (message: string, busy: boolean) => void,
  ) {}

  async save(format: 'svg' | 'png') {
    if (this.disposed || this.busy) return
    this.busy = true
    this.changed('正在导出…', true)
    try {
      const blob = await this.chart.exportImage({
        format,
        scale: format === 'png' ? 2 : 1,
        backgroundColor: '#fff',
      })
      if (this.disposed) return
      const owner = this.document.defaultView!
      const url = owner.URL.createObjectURL(blob)
      const link = this.document.createElement('a')
      try {
        link.href = url
        link.download = `waveform-example.${format}`
        this.document.body.append(link)
        link.click()
      } finally {
        link.remove()
        owner.URL.revokeObjectURL(url)
      }
      this.changed(`已导出 ${format.toUpperCase()}`, false)
    } catch (error) {
      if (!this.disposed)
        this.changed(error instanceof Error ? error.message : '导出失败，请重试', false)
    } finally {
      this.busy = false
    }
  }

  dispose() {
    this.disposed = true
  }
}
