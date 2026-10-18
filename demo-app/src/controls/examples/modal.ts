import { Modal } from 'waveform-analysis/modal'
import { Select } from 'waveform-analysis/select'
import 'waveform-analysis/modal/style.css'
import 'waveform-analysis/select/style.css'
import { createExample } from '../example'

export function mount(host: HTMLElement, report: (message: string) => void) {
  const demo = createExample(host)
  const modal = demo.own(new Modal(demo.document, { title: '基础弹窗' }))
  const paragraph = demo.document.createElement('p')
  paragraph.textContent = '自定义内容与页脚。Escape 优先关闭内部下拉框，再关闭弹窗。'
  modal.body.append(paragraph)
  const options = [
    { value: 'a', label: '选项 A' },
    { value: 'b', label: '选项 B' },
  ]
  const select = demo.own(
    new Select(demo.document, '弹窗内选项', (value) => {
      select.update(options, value)
      report(`弹窗内选择：${value}`)
    }),
  )
  select.update(options, 'a')
  modal.body.append(select.root)
  demo.button(modal.footer, '完成并关闭', () => {
    modal.close()
    report('已完成并关闭')
  })
  demo.button(
    demo.section('基本弹窗', '支持重复打开、焦点约束、关闭动画及焦点恢复。'),
    '打开 Modal',
    () => modal.open(),
  )

  let requested = false
  const confirm = demo.own(
    new Modal(demo.document, {
      title: '关闭请求确认',
      cancel: () => {
        requested = true
        text.textContent = '确定放弃未保存的内容吗？请选择继续编辑或放弃并关闭。'
        report('已拦截关闭请求，等待确认')
      },
    }),
  )
  const text = demo.document.createElement('p')
  text.textContent = '点击关闭按钮或按 Escape，演示由消费者接管关闭请求。'
  confirm.body.append(text)
  demo.button(confirm.footer, '继续编辑', () => {
    requested = false
    text.textContent = '继续编辑中，再次关闭会请求确认。'
  })
  demo.button(confirm.footer, '放弃并关闭', () => {
    confirm.close()
    report(requested ? '已确认放弃并关闭' : '已关闭')
  })
  demo.button(
    demo.section('消费者确认关闭', 'cancel 回调可以让弹窗保持打开，等待用户明确选择。'),
    '打开关闭确认示例',
    () => {
      requested = false
      text.textContent = '点击关闭按钮或按 Escape，演示由消费者接管关闭请求。'
      confirm.open()
    },
  )
  return demo
}
