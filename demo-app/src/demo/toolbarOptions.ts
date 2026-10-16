import type { WaveformToolbarItem } from 'waveform-analysis'

// Demo presentation choices; command execution stays inside the public chart component.
export const defaultToolbarOffsets = { offsetX: -30, offsetY: 18 }
export const defaultToolbarItems: WaveformToolbarItem[] = [
  'zoom-box',
  'pan',
  'annotate',
  'zoom-in',
  'zoom-out',
  'reset',
  'fit',
  'export',
]
export const toolbarLabels: Record<WaveformToolbarItem, string> = {
  'zoom-box': '框选缩放',
  pan: '平移',
  annotate: '注解',
  'zoom-in': '放大',
  'zoom-out': '缩小',
  reset: '重置',
  fit: '显示全部',
  export: '导出图片',
}
