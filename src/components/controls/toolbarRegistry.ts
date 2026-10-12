import type {
  WaveformControlState,
  WaveformToolbarItem,
  WaveformToolbarOptions,
} from '../../types/controls'
import type { useChartCommands } from './useChartCommands'

type Commands = Pick<ReturnType<typeof useChartCommands>, 'execute' | 'setInteractionMode'>
interface ButtonDefinition {
  id: WaveformToolbarItem
  label: string
  icon: string
  group: 'mode' | 'viewport' | 'export'
  active: (state: WaveformControlState) => boolean
  enabled: (state: WaveformControlState, trackId?: string) => boolean
  run: (commands: Commands, trackId?: string) => void
}
const paths = {
  'zoom-box': 'M3 3h6M3 3v6M21 3h-6M21 3v6M3 21h6M3 21v-6M21 21h-6M21 21v-6',
  pan: 'M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4',
  annotate: 'M4 4h16v12H9l-5 4V4M8 8h8M8 12h5',
  'zoom-in': 'M12 5v14M5 12h14',
  'zoom-out': 'M5 12h14',
  reset: 'M4 11a8 8 0 1 1 1 6M4 4v7h7',
  fit: 'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M8 8h8v8H8z',
  export: 'M12 3v12M7 10l5 5 5-5M4 15v6h16v-6',
}
const modeItems = { 'zoom-box': 'zoom', pan: 'pan', annotate: 'annotation' } as const
const labels = {
  'zoom-box': '框选缩放',
  pan: '平移',
  annotate: '注解',
  'zoom-in': '放大',
  'zoom-out': '缩小',
  reset: '重置',
  fit: '显示全部',
  export: '导出图片',
}
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
export const toolbarRegistry = Object.fromEntries(
  defaultToolbarItems.map((id) => {
    const mode = modeItems[id as keyof typeof modeItems]
    const action =
      id === 'zoom-in' || id === 'zoom-out' || id === 'reset' || id === 'fit' ? id : undefined
    return [
      id,
      {
        id,
        label: labels[id],
        icon: paths[id],
        group: mode ? 'mode' : action ? 'viewport' : 'export',
        active: (state: WaveformControlState) => !!mode && state.mode === mode,
        enabled: (state: WaveformControlState, trackId?: string) =>
          action && trackId
            ? !!state.targets.find((t) => t.trackId === trackId)?.available[action]
            : state.available[id],
        run: (commands: Commands, trackId?: string) => {
          if (mode) commands.setInteractionMode(mode)
          else if (action)
            commands.execute(action, trackId ? { trackId } : {}, undefined, 'toolbar')
        },
      } satisfies ButtonDefinition,
    ]
  }),
) as Record<WaveformToolbarItem, ButtonDefinition>
export function resolveToolbar(options?: boolean | WaveformToolbarOptions) {
  const config = typeof options === 'object' ? options : {}
  const items = [...new Set(config.items ?? defaultToolbarItems)].filter(
    (id) => toolbarRegistry[id],
  )
  const groups: ButtonDefinition[][] = []
  items.forEach((id) => {
    const item = toolbarRegistry[id]
    if (groups.at(-1)?.[0]?.group === item.group) groups.at(-1)!.push(item)
    else groups.push([item])
  })
  return {
    visible: !!options && config.visible !== false && items.length > 0,
    display: config.display ?? 'hover',
    position: config.position ?? 'top-right',
    groups,
  }
}
