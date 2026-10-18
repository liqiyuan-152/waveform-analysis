import { Pagination } from 'waveform-analysis/pagination'
import 'waveform-analysis/pagination/style.css'
import { createExample } from '../example'

export function mount(host: HTMLElement, report: (message: string) => void) {
  const demo = createExample(host)
  const card = demo.section(
    '页码切换与跳页',
    '共 20 页；省略号按钮向前或向后跳转 5 页。更新状态本身不触发回调。',
  )
  let page = 1,
    pageCount = 20
  const pagination = demo.own(
    new Pagination(card, (next) => {
      page = next
      pagination.update({ page, pageCount })
      report(`当前第 ${page} 页，共 ${pageCount} 页`)
    }),
  )
  pagination.update({ page, pageCount })
  const actions = demo.document.createElement('div')
  actions.className = 'control-example__actions'
  card.append(actions)
  demo.button(actions, '调整为 3 页', () => {
    pageCount = 3
    page = Math.min(page, pageCount)
    pagination.update({ page, pageCount })
    report(`当前第 ${page} 页，共 ${pageCount} 页`)
  })
  demo.button(actions, '恢复 20 页', () => {
    pageCount = 20
    pagination.update({ page, pageCount })
    report('已恢复 20 页')
  })
  const disabled = demo.own(
    new Pagination(demo.section('禁用状态', '所有导航按钮均不可操作。'), () => {}),
  )
  disabled.update({ page: 2, pageCount: 8, disabled: true })
  return demo
}
