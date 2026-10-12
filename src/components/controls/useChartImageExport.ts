import { nextTick, onBeforeUnmount, watch } from 'vue'
import type {
  WaveformImageExportError,
  WaveformImageExportErrorCode,
  WaveformImageExportOptions,
} from '../../types/controls'
import { updateMaximumTickVisibility } from '../rendering/yAxisTickVisibility'
import { createChartSnapshot } from './chartSnapshot'
export function imageExportError(code: WaveformImageExportErrorCode): WaveformImageExportError {
  const messages = {
    'export-invalid-options': '图片导出参数无效',
    'export-unavailable': '图表尚未具备有效尺寸',
    'export-busy': '已有导出正在执行',
    'export-cancelled': '图表已卸载，导出取消',
    'export-render-failed': '图片编码失败',
    'export-stale': '图表已变化，请重新导出',
    'export-timeout': '等待图表稳定超时，请重试',
  }
  return Object.assign(new Error(messages[code]), { code })
}
interface Context {
  container: () => HTMLElement | undefined
  svg: () => SVGSVGElement | undefined
  size: () => { width: number; height: number; titleHeight: number }
  version: () => unknown
  ready: () => boolean
}
export function useChartImageExport(c: Context) {
  let busy = false
  let disposed = false
  let revision = 0
  let abort: ((error: WaveformImageExportError) => void) | undefined
  watch(
    c.version,
    () => {
      revision++
      abort?.(imageExportError('export-stale'))
    },
    { flush: 'sync' },
  )
  onBeforeUnmount(() => {
    disposed = true
    abort?.(imageExportError('export-cancelled'))
  })
  async function exportImage(options: WaveformImageExportOptions = {}): Promise<Blob> {
    const format = options.format ?? 'png'
    const scale = options.scale ?? 1
    if (
      !['png', 'svg'].includes(format) ||
      !Number.isFinite(scale) ||
      scale <= 0 ||
      scale > 4 ||
      (format === 'svg' && scale !== 1) ||
      (options.backgroundColor !== undefined &&
        (typeof options.backgroundColor !== 'string' ||
          !CSS.supports('color', options.backgroundColor)))
    )
      throw imageExportError('export-invalid-options')
    if (disposed) throw imageExportError('export-cancelled')
    if (busy) throw imageExportError('export-busy')
    const container = c.container(),
      svg = c.svg(),
      size = c.size()
    if (!container || !svg || size.width <= 0 || size.height <= 0)
      throw imageExportError('export-unavailable')
    busy = true
    const captured = revision
    let timer: ReturnType<typeof setTimeout> | undefined
    let poll: ReturnType<typeof setTimeout> | undefined
    let url: string | undefined
    let img: HTMLImageElement | undefined
    let canvas: HTMLCanvasElement | undefined
    let stopped = false
    const check = () => {
      if (disposed) throw imageExportError('export-cancelled')
      if (captured !== revision) throw imageExportError('export-stale')
      if (stopped) throw imageExportError('export-timeout')
    }
    const cancelled = new Promise<never>((_, reject) => {
      abort = reject
      timer = setTimeout(() => reject(imageExportError('export-timeout')), 5000)
    })
    const generate = async () => {
      await nextTick()
      check()
      await new Promise<void>((resolve) => {
        const test = () => {
          if (stopped) return
          if (c.ready()) resolve()
          else poll = setTimeout(test, 16)
        }
        test()
      })
      await document.fonts?.ready
      await nextTick()
      check()
      updateMaximumTickVisibility(svg)
      const snapshot = createChartSnapshot(
        container,
        svg,
        size.width,
        size.height,
        size.titleHeight,
        options.backgroundColor,
      )
      const blob = new Blob([snapshot], { type: 'image/svg+xml' })
      if (format === 'svg') return blob
      url = URL.createObjectURL(blob)
      img = new Image()
      await new Promise<void>((resolve, reject) => {
        img!.onload = () => resolve()
        img!.onerror = () => reject(imageExportError('export-render-failed'))
        img!.src = url!
      })
      check()
      canvas = document.createElement('canvas')
      canvas.width = Math.round(size.width * scale)
      canvas.height = Math.round(size.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw imageExportError('export-render-failed')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const png = await new Promise<Blob>((resolve, reject) =>
        canvas!.toBlob(
          (result) => (result ? resolve(result) : reject(imageExportError('export-render-failed'))),
          'image/png',
        ),
      )
      check()
      return png
    }
    try {
      return await Promise.race([cancelled, generate()])
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error
      throw imageExportError('export-render-failed')
    } finally {
      stopped = true
      clearTimeout(timer)
      clearTimeout(poll)
      if (img) {
        img.onload = null
        img.onerror = null
        img.src = ''
      }
      if (url) URL.revokeObjectURL(url)
      if (canvas) {
        canvas.width = 0
        canvas.height = 0
      }
      abort = undefined
      busy = false
    }
  }
  return { exportImage }
}
