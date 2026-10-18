import { Popup, type PopupPlacement } from 'waveform-analysis/popup'
import 'waveform-analysis/popup/style.css'
import { createExample } from '../example'

export function mount(host: HTMLElement, report: (message: string) => void) {
  const demo = createExample(host)
  const basic = demo.section('基本浮层', '与 Ant Design Popover 一致的标题、内容、箭头和点击交互。')
  const trigger = demo.button(basic, '打开基本浮层', () => {})
  const popup = demo.own(
    new Popup(trigger, {
      title: '标题',
      content: '这是气泡卡片的内容，可以放置说明文字或交互操作。',
      trigger: 'click',
      onOpenChange: (open) => report(open ? '基本浮层已打开' : '基本浮层已关闭'),
    }),
  )
  demo.button(popup.content, '关闭浮层', () => popup.close(true))

  const modes = demo.section(
    '触发方式',
    '默认悬停延迟 0.1 秒；鼠标移入卡片可继续交互，也支持键盘聚焦。',
  )
  for (const [mode, label] of [
    ['hover', '悬停打开'],
    ['focus', '聚焦打开'],
  ] as const) {
    const button = demo.button(modes, label, () => {})
    demo.own(
      new Popup(button, {
        trigger: mode,
        title: label,
        content: '移开鼠标或焦点关闭，Escape 也可关闭。',
      }),
    )
  }

  const placements = demo.section(
    '十二个方向',
    '点击查看方向；空间不足时自动翻转，居中方向会沿视口边缘平移。',
  )
  const directions: PopupPlacement[] = [
    'topLeft',
    'top',
    'topRight',
    'leftTop',
    'left',
    'leftBottom',
    'rightTop',
    'right',
    'rightBottom',
    'bottomLeft',
    'bottom',
    'bottomRight',
  ]
  for (const placement of directions) {
    const button = demo.button(placements, placement, () => {})
    demo.own(
      new Popup(button, {
        placement,
        trigger: 'click',
        title: placement,
        content: '箭头始终指向触发元素。',
        width: 200,
      }),
    )
  }

  const custom = demo.section(
    '自定义尺寸',
    '无箭头、自定义 DOM 内容，宽度 320px，内容最大高度 180px。',
  )
  const button = demo.button(custom, '打开自定义尺寸', () => {})
  const content = demo.document.createElement('div')
  for (let i = 1; i <= 12; i++) {
    const line = demo.document.createElement('p')
    line.textContent = `第 ${i} 行：内容超出高度后在卡片内部滚动。`
    content.append(line)
  }
  demo.own(
    new Popup(button, {
      title: '自定义内容',
      content,
      trigger: 'click',
      arrow: false,
      width: 320,
      maxHeight: 180,
    }),
  )
  return demo
}
