import { mockControlGeometry } from '../support/controlGeometry'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { init } from '@/chart/init'
import type { WaveformChartOptions } from '@/types/options'
import type { WaveformAnnotation } from '@/types/chart'
import { flushNativeUpdates } from '../support/nativeChart'

beforeEach(mockControlGeometry)

const cleanup: Array<() => void> = []
afterEach(() => {
  cleanup.splice(0).forEach((dispose) => dispose())
  vi.restoreAllMocks()
})
const annotation: WaveformAnnotation = {
  id: 'note',
  seriesId: 'a',
  x: 1,
  y: 10,
  text: '原文字',
  labelOffsetX: 8,
  labelOffsetY: -4,
  style: {
    borderColor: 'rgba(22, 119, 255, 0.7)',
    textColor: '#333333',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
}
const data = {
  kind: 'series' as const,
  series: ['a', 'b'].map((id, index) => ({
    id,
    name: `通道 ${id}`,
    trackId: 'group',
    unit: 'V',
    data: {
      kind: 'points' as const,
      points: [
        { x: 0, y: index * 100 },
        { x: 1, y: index ? 150 : 10 },
        { x: 2, y: index ? 200 : 20 },
      ],
    },
  })),
}
async function setup(options: WaveformChartOptions = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  Object.defineProperty(host, 'getClientRects', { value: () => [{}] })
  const chart = init(
    host,
    {
      data,
      width: 800,
      height: 360,
      annotations: [structuredClone(annotation)],
      animationEnabled: false,
      xDomainStrategy: { type: 'data' },
      ...options,
    },
    { autoResize: false },
  )
  cleanup.push(() => {
    chart.dispose()
    host.remove()
  })
  await flushNativeUpdates()
  return { chart, host }
}
function dialog(document = window.document) {
  const root = [...document.querySelectorAll<HTMLDialogElement>('dialog')].at(-1)!
  if (!root) throw new Error('Expected native annotation dialog')
  return {
    root,
    text: root.querySelector<HTMLTextAreaElement>('textarea')!,
    time: root.querySelector<HTMLInputElement>('[aria-label="标注横轴时间"]')!,
    save: root.querySelector<HTMLButtonElement>('.waveform-modal__button--primary')!,
    error: root.querySelector<HTMLElement>('[role="alert"]')!,
  }
}
function edit(host: HTMLElement) {
  host.querySelector('.waveform-annotation')!.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      clientX: 200,
      clientY: 100,
    }),
  )
  host.querySelector<HTMLButtonElement>('.waveform-annotation-context-menu button')!.click()
  return dialog(host.ownerDocument)
}
function input(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
}
function commit(element: HTMLInputElement) {
  element.dispatchEvent(new FocusEvent('blur'))
}

describe('native annotation editor integration', () => {
  it('updates the open editor and its controls without losing drafts when controlTheme changes', async () => {
    const { chart, host } = await setup({ controlTheme: 'dark' })
    const editor = edit(host)
    input(editor.text, '主题切换中的草稿')
    expect(editor.root.dataset.controlTheme).toBe('dark')
    chart.setOption({ controlTheme: 'light' })
    await flushNativeUpdates()
    expect(editor.root.open).toBe(true)
    expect(editor.text.value).toBe('主题切换中的草稿')
    for (const control of editor.root.querySelectorAll<HTMLElement>('[data-control-theme]'))
      expect(control.dataset.controlTheme).toBe('light')
  })

  it('hydrates title, coordinates, character limit, series options and initial focus', async () => {
    const { host } = await setup()
    const editor = edit(host)
    expect(editor.root.open).toBe(true)
    expect(
      editor.root.querySelector(`#${editor.root.getAttribute('aria-labelledby')}`)!.textContent,
    ).toBe('编辑标注')
    expect(document.activeElement).toBe(editor.text)
    expect(editor.text.value).toBe('原文字')
    expect(editor.text.maxLength).toBe(40)
    expect(editor.time.value).toBe('1000.000')
    expect(
      editor.root.querySelector('.waveform-annotation-editor__coordinates code')!.textContent,
    ).toBe('10')
    editor.root.querySelector<HTMLButtonElement>('[aria-label="选择标注波形"]')!.click()
    expect(
      [...editor.root.querySelectorAll('[role="option"]')].map((node) => node.textContent),
    ).toEqual(['通道 a (V)', '通道 b (V)'])
    expect(editor.root.querySelector('[role="note"]')!.textContent).toContain(
      '自动吸附最近的采样点',
    )
  })

  it('creates through the overlay with trimmed text and a replacement request, then waits for acknowledgement', async () => {
    const { host, chart } = await setup({ interactionMode: 'annotation', hiddenSeriesIds: ['b'] })
    const request = vi.fn(),
      created = vi.fn()
    chart.on('update:annotations', request)
    chart.on('annotation-create', created)
    const overlay = host.querySelector<SVGRectElement>('.waveform-chart__overlay')!
    overlay.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        clientX: Number(overlay.getAttribute('width')) / 2,
        clientY: Number(overlay.getAttribute('height')) / 2,
      }),
    )
    const editor = dialog()
    expect(editor.save.disabled).toBe(true)
    input(editor.text, '  新标注  ')
    editor.save.click()
    expect(created).toHaveBeenCalledOnce()
    const replacement = request.mock.calls[0]![0] as WaveformAnnotation[]
    expect(replacement).toHaveLength(2)
    expect(replacement[1]).toMatchObject({ seriesId: 'a', x: 1, y: 10, text: '新标注' })
    expect(editor.root.isConnected).toBe(false)
    expect(host.querySelectorAll('.waveform-annotation')).toHaveLength(1)
    chart.setOption({ annotations: replacement })
    await flushNativeUpdates()
    expect(host.querySelectorAll('.waveform-annotation')).toHaveLength(2)
  })

  it('snaps time on save, preserves style/offsets and emits the original previous snapshot once', async () => {
    const { host, chart } = await setup()
    const request = vi.fn(),
      update = vi.fn(),
      rendered = vi.fn()
    chart.on('update:annotations', request)
    chart.on('annotation-update', update)
    chart.on('rendered', rendered)
    const editor = edit(host)
    input(editor.text, '  修改  ')
    input(editor.time, '1500')
    editor.text.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', ctrlKey: true }),
    )
    expect(update).toHaveBeenCalledExactlyOnceWith(
      { ...annotation, x: 2, y: 20, text: '修改' },
      annotation,
    )
    expect(request).toHaveBeenCalledOnce()
    expect(host.querySelector('text.waveform-annotation__text')!.textContent).toBe('原文字')
    expect(rendered).not.toHaveBeenCalled()
    editor.save.click()
    expect(request).toHaveBeenCalledOnce()
    expect(annotation.text).toBe('原文字')
  })

  it('enforces the 40 UTF-16 character limit and permits multiline text', async () => {
    const { host, chart } = await setup()
    const update = vi.fn()
    chart.on('annotation-update', update)
    const editor = edit(host)
    input(editor.text, ' ')
    expect(editor.save.disabled).toBe(true)
    input(editor.text, '🙂'.repeat(21))
    expect(
      editor.root.querySelector('.waveform-annotation-editor__label-row small')!.textContent,
    ).toBe('42/40')
    expect(editor.save.disabled).toBe(true)
    input(editor.text, '🙂'.repeat(19) + '\n中')
    expect(editor.text.value.length).toBe(40)
    editor.save.click()
    expect(update.mock.calls[0]![0].text).toBe('🙂'.repeat(19) + '\n中')
  })

  it.each(['', ' ', '1e-', 'Infinity', 'NaN', '3000'])(
    'validates %j on blur, blocks saving and recovers without persisting invalid time',
    async (value) => {
      const { host, chart } = await setup()
      const request = vi.fn()
      chart.on('update:annotations', request)
      const editor = edit(host)
      input(editor.time, value)
      expect(editor.error.hidden).toBe(true)
      commit(editor.time)
      expect(editor.error.textContent).toBe(
        value === '3000' ? '时间超出当前波形范围' : '请输入有效的时间',
      )
      expect(editor.time.getAttribute('aria-invalid')).toBe('true')
      expect(editor.time.getAttribute('aria-describedby')).toBe(editor.error.id)
      expect(editor.save.disabled).toBe(true)
      editor.text.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', metaKey: true }),
      )
      expect(request).not.toHaveBeenCalled()
      input(editor.time, '1500')
      expect(editor.error.hidden).toBe(true)
      commit(editor.time)
      expect(editor.error.hidden).toBe(true)
      expect(editor.save.disabled).toBe(false)
      editor.save.click()
      expect(request.mock.calls[0]![0][0]).toMatchObject({ x: 2, y: 20 })
    },
  )

  it('confirms the highlighted series on the first Tab before the dialog moves focus', async () => {
    const { host } = await setup()
    const editor = edit(host)
    const select = editor.root.querySelector<HTMLButtonElement>('[aria-label="选择标注波形"]')!
    select.focus()
    select.click()
    select.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }),
    )
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    select.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(true)
    expect(select.textContent).toBe('通道 b (V)')
    expect(document.activeElement).toBe(select)
    expect(editor.root.querySelector('[role="listbox"]')).toBeNull()
    select.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).not.toBe(select)
  })

  it('shares decimal arrow/button stepping, focuses the input and retains partial numeric strings', async () => {
    const { host } = await setup()
    const editor = edit(host)
    input(editor.time, '1e-')
    expect(editor.time.value).toBe('1e-')
    expect(editor.time.hasAttribute('aria-valuenow')).toBe(false)
    editor.time.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowUp' }))
    expect(editor.time.value).toBe('0.001')
    editor.root.querySelector<HTMLButtonElement>('[aria-label="增加时间"]')!.click()
    expect(editor.time.value).toBe('0.002')
    expect(document.activeElement).toBe(editor.time)
    editor.root.querySelector<HTMLButtonElement>('[aria-label="减少时间"]')!.click()
    expect(editor.time.value).toBe('0.001')
  })

  it('changes series using the current full source, updates Y and preserves locally hydrated colors', async () => {
    const { host, chart } = await setup()
    const update = vi.fn()
    chart.on('annotation-update', update)
    const editor = edit(host),
      select = editor.root.querySelector<HTMLButtonElement>('[aria-label="选择标注波形"]')!
    select.click()
    editor.root.querySelectorAll<HTMLElement>('[role="option"]')[1].click()
    expect(editor.root.querySelector('.waveform-annotation-editor__series b')!.textContent).toBe(
      '通道 b',
    )
    expect(
      editor.root.querySelector('.waveform-annotation-editor__coordinates code')!.textContent,
    ).toBe('150')
    input(editor.time, '2000')
    editor.save.click()
    expect(update).toHaveBeenCalledExactlyOnceWith(
      { ...annotation, seriesId: 'b', x: 2, y: 200 },
      annotation,
    )
  })

  it('preserves edits through resize/style changes and converts pending time display without changing seconds', async () => {
    const { host, chart } = await setup()
    const update = vi.fn()
    chart.on('annotation-update', update)
    const editor = edit(host)
    input(editor.time, '1500')
    input(editor.text, '保留编辑')
    chart.setOption({ width: 360, lineColor: '#f00', timeUnit: 's' })
    await flushNativeUpdates()
    expect(dialog().root).toBe(editor.root)
    expect(editor.time.value).toBe('1.5')
    expect(editor.text.value).toBe('保留编辑')
    editor.save.click()
    expect(update.mock.calls[0]).toEqual([
      { ...annotation, x: 2, y: 20, text: '保留编辑' },
      annotation,
    ])
  })

  it('uses the latest full typed source after data replacement even when SVG sampling omits that point', async () => {
    const x = Float64Array.from({ length: 10001 }, (_, index) => index / 1000)
    const y = Float64Array.from(x, (value) => Math.sin(value))
    const typed = (values: Float64Array) => ({
      kind: 'series' as const,
      series: [{ id: 'a', name: '完整', data: { kind: 'typed-points' as const, x, y: values } }],
    })
    const { host, chart } = await setup({
      data: typed(y),
      annotations: [{ ...annotation, x: 5, y: Math.sin(5) }],
      rendering: {
        sampling: { mode: 'auto', strategy: 'average', maxPointCount: 20, autoThreshold: 1 },
      },
    })
    const update = vi.fn()
    chart.on('annotation-update', update)
    const editor = edit(host)
    input(editor.time, '5432.1')
    const nextY = Float64Array.from(y, (value) => value * 2)
    chart.setOption({ data: typed(nextY) })
    await flushNativeUpdates()
    const path = host.querySelector('.waveform-chart__line')!.getAttribute('d')!
    expect([...path.matchAll(/[ML]/g)].length).toBeLessThan(50)
    editor.save.click()
    expect(update.mock.calls[0]![0]).toMatchObject({ x: x[5432], y: nextY[5432] })
    expect(y[5432]).toBe(Math.sin(x[5432]!))
  })

  it('keeps error domains, hover/tooltip and annotation snapping on an extreme omitted from sampled geometry', async () => {
    const x = Float64Array.from({ length: 10001 }, (_, index) => index / 1000)
    const y = new Float64Array(x.length),
      lowerError = new Float64Array(x.length),
      upperError = new Float64Array(x.length)
    y[5432] = 100
    lowerError[5432] = 600
    upperError[5432] = 1000
    const { host, chart } = await setup({
      data: {
        kind: 'series',
        series: [
          {
            id: 'a',
            name: '完整峰值',
            errorBar: { visible: true },
            data: { kind: 'typed-points', x, y, lowerError, upperError },
          },
        ],
      },
      annotations: [{ ...annotation, x: x[5432]!, y: 100 }],
      rendering: {
        sampling: { mode: 'auto', strategy: 'average', maxPointCount: 20, autoThreshold: 1 },
      },
    })
    const domain = chart.getControlState().targets[0]!.viewport.yDomains.a!
    expect(domain[0]).toBeLessThanOrEqual(-500)
    expect(domain[1]).toBeGreaterThanOrEqual(1100)
    const overlay = host.querySelector<SVGRectElement>('.waveform-chart__overlay')!
    const pixel = (Number(overlay.getAttribute('width')) * x[5432]!) / 10
    const path = host.querySelector('.waveform-chart__line')!.getAttribute('d')!
    const vertices = [...path.matchAll(/[ML](-?\d+(?:\.\d+)?),/g)].map((match) => Number(match[1]))
    expect(vertices.length).toBeLessThan(50)
    expect(vertices).not.toContain(Number(pixel.toFixed(3)))
    const hover = vi.fn(),
      update = vi.fn()
    chart.on('point-hover', hover)
    chart.on('annotation-update', update)
    overlay.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        pointerId: 1,
        clientX: pixel,
        clientY: 100,
      }),
    )
    await flushNativeUpdates()
    expect(hover).toHaveBeenLastCalledWith({
      x: x[5432],
      y: 100,
      lowerError: 600,
      upperError: 1000,
    })
    expect(host.querySelector('.waveform-tooltip__value')!.textContent).toContain('y:100')
    const editor = edit(host)
    input(editor.time, '5432.1')
    editor.save.click()
    expect(update.mock.calls[0]![0]).toMatchObject({ x: x[5432], y: 100 })
    expect(chart.getControlState().targets[0]!.viewport.yDomains.a).toEqual(domain)
    expect([y[5432], lowerError[5432], upperError[5432]]).toEqual([100, 600, 1000])
  })

  it('revalidates time against a replacement source before accepting save', async () => {
    const { host, chart } = await setup()
    const request = vi.fn()
    chart.on('update:annotations', request)
    const editor = edit(host)
    input(editor.time, '1800')
    chart.setOption({
      data: {
        kind: 'series',
        series: [
          {
            id: 'a',
            name: 'a',
            data: {
              kind: 'points',
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 10 },
              ],
            },
          },
        ],
      },
    })
    await flushNativeUpdates()
    editor.save.click()
    expect(editor.error.textContent).toBe('时间超出当前波形范围')
    expect(request).not.toHaveBeenCalled()
    input(editor.time, '1000')
    editor.save.click()
    expect(request).toHaveBeenCalledOnce()
  })

  it('blocks repeated submission during the leave transition and revalidates changed data', async () => {
    const { host, chart } = await setup()
    const request = vi.fn()
    chart.on('update:annotations', request)
    const editor = edit(host)
    const animation = { cancel: vi.fn(), onfinish: undefined as (() => void) | undefined }
    editor.root.querySelector<HTMLElement>('.waveform-modal__panel')!.animate = vi.fn(
      () => animation as unknown as Animation,
    )
    input(editor.time, '2000')
    editor.save.click()
    editor.save.click()
    expect(editor.root.getAttribute('aria-busy')).toBe('true')
    expect(request).not.toHaveBeenCalled()
    chart.setOption({
      data: {
        kind: 'series',
        series: data.series.map((series) => ({
          ...series,
          data: { kind: 'points', points: series.data.points.slice(0, 2) },
        })),
      },
    })
    await flushNativeUpdates()
    animation.onfinish!()
    expect(request).not.toHaveBeenCalled()
    expect(editor.error.textContent).toBe('时间超出当前波形范围')
    expect(editor.root.getAttribute('aria-busy')).toBeNull()
    input(editor.time, '1000')
    editor.save.click()
    animation.onfinish!()
    expect(request).toHaveBeenCalledOnce()
  })

  it('ignores composing save shortcuts and cancels pending animation callbacks on destruction', async () => {
    const { host, chart } = await setup()
    const request = vi.fn()
    chart.on('update:annotations', request)
    const editor = edit(host)
    editor.text.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'Enter',
        ctrlKey: true,
        isComposing: true,
      }),
    )
    expect(request).not.toHaveBeenCalled()
    const animation = { cancel: vi.fn(), onfinish: undefined as (() => void) | undefined }
    editor.root.querySelector<HTMLElement>('.waveform-modal__panel')!.animate = vi.fn(
      () => animation as unknown as Animation,
    )
    editor.save.click()
    chart.dispose()
    animation.onfinish!()
    expect(animation.cancel).toHaveBeenCalledOnce()
    expect(request).not.toHaveBeenCalled()
    expect(document.querySelector('dialog')).toBeNull()
  })

  it('removes hidden alternatives without resetting local edits', async () => {
    const { host, chart } = await setup()
    const update = vi.fn()
    chart.on('annotation-update', update)
    const editor = edit(host)
    input(editor.text, '保留文字')
    chart.setOption({ hiddenSeriesIds: ['b'] })
    await flushNativeUpdates()
    editor.root.querySelector<HTMLButtonElement>('[aria-label="选择标注波形"]')!.click()
    expect(
      [...editor.root.querySelectorAll('[role="option"]')].map((node) => node.textContent),
    ).toEqual(['通道 a (V)'])
    expect(editor.text.value).toBe('保留文字')
    editor.save.click()
    expect(update.mock.calls[0]![0]).toMatchObject({ seriesId: 'a', text: '保留文字' })
  })

  it.each([
    'cancel',
    'close',
    'escape',
    'native-cancel',
    'hide',
    'hidden-series',
    'presentation',
    'removed',
    'dispose',
  ] as const)('closes on %s with no replacement and no stale detached save', async (reason) => {
    const { host, chart } = await setup()
    const request = vi.fn()
    chart.on('update:annotations', request)
    const editor = edit(host)
    input(editor.text, '未保存')
    if (reason === 'cancel')
      editor.root
        .querySelector<HTMLButtonElement>(
          '.waveform-modal__button:not(.waveform-modal__button--primary)',
        )!
        .click()
    if (reason === 'close')
      editor.root.querySelector<HTMLButtonElement>('[aria-label="关闭"]')!.click()
    if (reason === 'escape')
      editor.text.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))
    if (reason === 'native-cancel')
      editor.root.dispatchEvent(new Event('cancel', { cancelable: true }))
    if (reason === 'hide') chart.setOption({ annotationsVisible: false })
    if (reason === 'hidden-series') chart.setOption({ hiddenSeriesIds: ['a'] })
    if (reason === 'presentation') chart.setOption({ presentationMode: true })
    if (reason === 'removed') chart.setOption({ annotations: [] })
    if (reason === 'dispose') chart.dispose()
    await flushNativeUpdates()
    expect(editor.root.isConnected).toBe(false)
    editor.save.click()
    editor.text.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', ctrlKey: true }),
    )
    expect(request).not.toHaveBeenCalled()
  })

  it('handles synchronous host acknowledgement and disposal during the request callback', async () => {
    const { host, chart } = await setup()
    chart.on('update:annotations', (annotations) => chart.setOption({ annotations }))
    const update = vi.fn()
    chart.on('annotation-update', update)
    const editor = edit(host)
    input(editor.text, '确认')
    editor.save.click()
    await flushNativeUpdates()
    expect(host.querySelector('.waveform-annotation__text')!.textContent).toBe('确认')
    expect(update).toHaveBeenCalledOnce()
    chart.on('update:annotations', () => chart.dispose())
    const second = edit(host)
    input(second.text, '销毁')
    second.save.click()
    expect(second.root.isConnected).toBe(false)
    expect(update).toHaveBeenCalledOnce()
  })

  it('rolls back a failed dialog open and permits a later retry', async () => {
    const { host } = await setup()
    const oldOverflow = document.body.style.overflow
    const report = vi.spyOn(console, 'error').mockImplementation(() => {})
    const show = vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(() => {
      throw new Error('top layer unavailable')
    })
    host
      .querySelector('.waveform-annotation')!
      .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
    host.querySelector<HTMLButtonElement>('.waveform-annotation-context-menu button')!.click()
    expect(document.querySelector('dialog')).toBeNull()
    expect(document.body.style.overflow).toBe(oldOverflow)
    expect(report).toHaveBeenCalledOnce()
    show.mockRestore()
    expect(edit(host).root.open).toBe(true)
  })

  it('cleans up when a consumer disposes during the initial textarea focus', async () => {
    const { host, chart } = await setup()
    const overflow = document.body.style.overflow
    const disposeOnFocus = (event: FocusEvent) => {
      if ((event.target as Element | null)?.matches('textarea')) chart.dispose()
    }
    document.addEventListener('focusin', disposeOnFocus)
    try {
      host
        .querySelector('.waveform-annotation')!
        .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
      host.querySelector<HTMLButtonElement>('.waveform-annotation-context-menu button')!.click()
      expect(chart.isDisposed()).toBe(true)
      expect(document.querySelector('dialog')).toBeNull()
      expect(document.body.style.overflow).toBe(overflow)
    } finally {
      document.removeEventListener('focusin', disposeOnFocus)
    }
  })

  it('creates the editor in the host iframe, isolates scroll/Escape and restores owner-window focus', async () => {
    const iframe = document.createElement('iframe')
    document.body.append(iframe)
    const owner = iframe.contentWindow! as Window & typeof globalThis
    const host = owner.document.createElement('div'),
      previous = owner.document.createElement('button')
    owner.document.body.append(previous, host)
    owner.document.body.style.overflow = 'auto'
    const parentOverflow = document.body.style.overflow
    Object.defineProperty(host, 'getClientRects', { value: () => [{}] })
    owner.HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
    owner.HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
    }
    const frames = new Map<number, FrameRequestCallback>()
    let sequence = 0
    vi.spyOn(owner, 'requestAnimationFrame').mockImplementation((callback) => {
      const id = ++sequence
      frames.set(id, callback)
      return id
    })
    vi.spyOn(owner, 'cancelAnimationFrame').mockImplementation((id) => {
      frames.delete(id)
    })
    const chart = init(
      host,
      {
        data,
        width: 800,
        height: 360,
        annotations: [annotation],
        animationEnabled: false,
        rendering: { sampling: { mode: 'raw' } },
      },
      { autoResize: false },
    )
    cleanup.push(() => {
      chart.dispose()
      iframe.remove()
    })
    for (let turn = 0; turn < 12; turn++) {
      const callbacks = [...frames.values()]
      frames.clear()
      callbacks.forEach((callback) => callback(0))
      await Promise.resolve()
    }
    previous.focus()
    const editor = edit(host),
      update = vi.fn()
    chart.on('annotation-update', update)
    expect(editor.root.ownerDocument).toBe(owner.document)
    expect(owner.document.activeElement).toBe(editor.text)
    expect(owner.document.body.style.overflow).toBe('hidden')
    expect(document.body.style.overflow).toBe(parentOverflow)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(editor.root.open).toBe(true)
    input(editor.time, '1500')
    input(editor.text, 'iframe 修改')
    editor.text.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', ctrlKey: true }),
    )
    expect(update).toHaveBeenCalledExactlyOnceWith(
      { ...annotation, x: 2, y: 20, text: 'iframe 修改' },
      annotation,
    )
    expect(owner.document.body.style.overflow).toBe('auto')
    expect(owner.document.activeElement).toBe(previous)
    expect(editor.root.isConnected).toBe(false)
  })
})

describe('native annotation style editing', () => {
  it('edits exact CSS colors and independent alpha without changing the controlled source', async () => {
    const { host, chart } = await setup()
    const editor = edit(host)
    const request = vi.fn(),
      updated = vi.fn()
    chart.on('update:annotations', request)
    chart.on('annotation-update', updated)
    editor.root.querySelector<HTMLButtonElement>('[aria-label="标注边框色"]')!.click()
    const text = editor.root.querySelector<HTMLInputElement>('[aria-label="标注边框色精确值"]')!
    input(text, '#12345678')
    editor.root.querySelector<HTMLButtonElement>('[aria-label="标注背景色"]')!.click()
    const alpha = editor.root.querySelector<HTMLInputElement>('[aria-label="标注背景色透明度"]')!
    input(alpha, '12.3456')
    chart.setOption({ width: 700 })
    await flushNativeUpdates()
    expect(text.value).toBe('#12345678')
    expect(alpha.value).toBe('12.3456')
    editor.save.click()
    const [replacement] = request.mock.calls[0]
    expect(replacement[0].style).toEqual({
      borderColor: '#12345678',
      textColor: '#333333',
      backgroundColor: 'rgba(255, 255, 255, 0.123456)',
    })
    expect(updated).toHaveBeenCalledWith(replacement[0], annotation)
    expect(host.querySelector('.waveform-annotation__box')!.getAttribute('fill')).toBe(
      annotation.style!.backgroundColor,
    )
    chart.setOption({ annotations: replacement })
    await flushNativeUpdates()
    expect(host.querySelector('.waveform-annotation__box')!.getAttribute('fill')).toBe(
      'rgba(255, 255, 255, 0.123456)',
    )
  })

  it('dismisses nested format, then color popup, then dialog and restores trigger focus', async () => {
    const { host } = await setup()
    const editor = edit(host)
    const trigger = editor.root.querySelector<HTMLButtonElement>('[aria-label="标注文字色"]')!
    trigger.click()
    const format = editor.root.querySelector<HTMLButtonElement>(
      '[aria-label="标注文字色颜色格式"]',
    )!
    format.click()
    const escape = () =>
      format.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    escape()
    expect(editor.root.querySelectorAll('.waveform-popup')).toHaveLength(1)
    expect(document.activeElement).toBe(format)
    escape()
    expect(editor.root.querySelector('.waveform-popup')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(editor.root.open).toBe(true)
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(editor.root.isConnected).toBe(false)
  })

  it('preserves Ctrl+Enter save from a field inside the color popup', async () => {
    const { host, chart } = await setup()
    const request = vi.fn()
    chart.on('update:annotations', request)
    const editor = edit(host)
    editor.root.querySelector<HTMLButtonElement>('[aria-label="标注文字色"]')!.click()
    const text = editor.root.querySelector<HTMLInputElement>('[aria-label="标注文字色精确值"]')!
    input(text, '#abcdef')
    text.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }))
    expect(request).toHaveBeenCalledOnce()
    expect(request.mock.calls[0][0][0].style.textColor).toBe('#abcdef')
    expect(editor.root.isConnected).toBe(false)
  })

  it('blocks invalid colors and alpha, restores validity and cancels without requests', async () => {
    const { host, chart } = await setup()
    const editor = edit(host),
      request = vi.fn()
    chart.on('update:annotations', request)
    editor.root.querySelector<HTMLButtonElement>('[aria-label="标注文字色"]')!.click()
    const text = editor.root.querySelector<HTMLInputElement>('[aria-label="标注文字色精确值"]')!
    const alpha = editor.root.querySelector<HTMLInputElement>('[aria-label="标注文字色透明度"]')!
    input(text, 'not a color')
    expect(text.getAttribute('aria-invalid')).toBe('true')
    expect(editor.save.disabled).toBe(true)
    editor.save.click()
    expect(request).not.toHaveBeenCalled()
    input(text, 'hsl(120, 100%, 25%)')
    expect(editor.save.disabled).toBe(false)
    input(alpha, '101')
    expect(editor.save.disabled).toBe(true)
    input(alpha, '')
    expect(editor.save.disabled).toBe(true)
    input(alpha, '0')
    expect(editor.save.disabled).toBe(false)
    editor.root.querySelector<HTMLButtonElement>('.waveform-modal__close')!.click()
    expect(request).not.toHaveBeenCalled()
    input(text, 'red')
    expect(request).not.toHaveBeenCalled()
    expect(document.querySelector('dialog')).toBeNull()
  })
})
