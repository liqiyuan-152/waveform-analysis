// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveOptions } from '../../../src/display/config/resolve'
import type { WaveformOptions } from '../../../src/display/types/options'
import type { WaveformSeries } from '../../../src/display/types/data'
import {
  colorPickerValue,
  createConfigPanel,
  parseDimension,
  parseNumberInput,
  setAtPath,
  setSeriesStyleOverride,
} from '../fixtures/legacyConfigPanel'

afterEach(() => document.body.replaceChildren())

function findField(container: HTMLElement, label: string): HTMLElement {
  const field = Array.from(container.querySelectorAll<HTMLElement>('.config-field')).find(
    (element) => element.querySelector('.config-field__label')?.textContent === label,
  )
  if (!field) throw new Error(`Field not found: ${label}`)
  return field
}

function fireInput(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function clickButton(container: HTMLElement, label: string, selector = 'button') {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>(selector)).find(
    (element) => element.textContent === label,
  )
  if (!button) throw new Error(`Button not found: ${label}`)
  button.click()
  return button
}

describe('config panel utilities', () => {
  it('parses optional numbers and dimensions without accepting incomplete numbers', () => {
    expect(parseNumberInput('', true)).toEqual({ valid: true, value: undefined })
    expect(parseNumberInput('-', true)).toEqual({ valid: false })
    expect(parseNumberInput('2.5')).toEqual({ valid: true, value: 2.5 })
    expect(parseDimension('100%')).toEqual({ valid: true, value: '100%' })
    expect(parseDimension('640')).toEqual({ valid: true, value: 640 })
  })

  it('updates nested values immutably and preserves sibling settings', () => {
    const options: WaveformOptions = { line: { color: '#2563eb', width: 2 } }
    const updated = setAtPath(options, 'line.width', 4)
    expect(updated).not.toBe(options)
    expect(updated.line).not.toBe(options.line)
    expect(updated.line).toEqual({ color: '#2563eb', width: 4 })
    expect(options.line?.width).toBe(2)
  })

  it('uses a safe swatch fallback while preserving editable CSS color strings', () => {
    expect(colorPickerValue('#12aBcD')).toBe('#12aBcD')
    expect(colorPickerValue('transparent')).toBe('#000000')
  })

  it('adds and clears nested series overrides', () => {
    const withOverride = setSeriesStyleOverride(undefined, 'point.size', 5)
    expect(withOverride.point?.size).toBe(5)
    const cleared = setSeriesStyleOverride(withOverride, 'point.size', undefined)
    expect(cleared.point?.size).toBeUndefined()
  })
})

describe('createConfigPanel', () => {
  const baseSeries: WaveformSeries[] = [
    { name: 'CH1', data: [{ x: 0, y: 1 }] },
    { name: 'CH2', data: [{ x: 0, y: 2 }], style: { color: '#dc2626' } },
  ]

  function setup() {
    const container = document.createElement('div')
    container.className = 'workspace__inner'
    document.body.append(container)
    const options = resolveOptions({ line: { color: '#2563eb', width: 2 } })
    const onOptionsChange = vi.fn()
    const onSeriesChange = vi.fn()
    const onEmptyPreviewChange = vi.fn()
    createConfigPanel(container, {
      options,
      series: baseSeries,
      onOptionsChange,
      onSeriesChange,
      onEmptyPreviewChange,
    })
    return { container, onOptionsChange, onSeriesChange, onEmptyPreviewChange }
  }

  it('edits zero-line opacity within its supported range', () => {
    const { container, onOptionsChange } = setup()
    clickButton(container, '网格')
    clickButton(container, '零线')
    const input = findField(container, '零线透明度').querySelector<HTMLInputElement>('input')!
    expect(input.value).toBe('0.5')
    expect(input.min).toBe('0')
    expect(input.max).toBe('1')
    fireInput(input, '0.25')
    expect(onOptionsChange.mock.lastCall![0].zeroLine.opacity).toBe(0.25)
    expect(onOptionsChange.mock.lastCall![0].zeroLine.color).toBe('#ff0000')
  })

  it.each(['rgba(255, 0, 0, 0.5)', '#ff000080'])(
    'edits zero-line alpha color %s independently of opacity',
    (color) => {
      const { container, onOptionsChange } = setup()
      clickButton(container, '网格')
      clickButton(container, '零线')
      const colorField = findField(container, '零线颜色')
      fireInput(colorField.querySelector<HTMLInputElement>('input[type="text"]')!, color)
      expect(onOptionsChange.mock.lastCall![0].zeroLine.color).toBe(color)
      fireInput(findField(container, '零线透明度').querySelector<HTMLInputElement>('input')!, '1')
      expect(onOptionsChange.mock.lastCall![0].zeroLine).toMatchObject({ color, opacity: 1 })
      fireInput(colorField.querySelector<HTMLInputElement>('input[type="color"]')!, '#ff0000')
      expect(onOptionsChange.mock.lastCall![0].zeroLine).toMatchObject({
        color: '#ff0000',
        opacity: 1,
      })
    },
  )

  it('renders accessible tabs and supports keyboard activation', () => {
    const { container } = setup()
    const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
    expect(tabs).toHaveLength(6)
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      '布局',
      '线点',
      '坐标轴',
      '网格',
      '文字',
      '曲线',
    ])
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
    expect(tabs[0].getAttribute('aria-controls')).toBeTruthy()
    expect(container.querySelectorAll<HTMLElement>('[role="tabpanel"]:not([hidden])')).toHaveLength(
      1,
    )

    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(tabs[1].getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(tabs[1])
  })

  it('commits live option edits without dropping sibling values or tab state', () => {
    const { container, onOptionsChange } = setup()
    expect(container.classList.contains('workspace__inner')).toBe(true)
    clickButton(container, '线点', '[role="tab"]')
    const input = findField(container, '线条宽度').querySelector<HTMLInputElement>(
      'input[type="number"]',
    )!
    fireInput(input, '4.5')
    const updated = onOptionsChange.mock.lastCall![0] as WaveformOptions
    expect(updated.line).toMatchObject({ color: '#2563eb', width: 4.5 })

    clickButton(container, '布局', '[role="tab"]')
    clickButton(container, '线点', '[role="tab"]')
    expect(findField(container, '线条宽度').querySelector<HTMLInputElement>('input')?.value).toBe(
      '4.5',
    )
  })

  it('commits shared grid style, color, and width without dropping axis settings', () => {
    const { container, onOptionsChange } = setup()
    clickButton(container, '网格', '[role="tab"]')

    const style = findField(container, '辅助线样式').querySelector<HTMLSelectElement>('select')!
    style.value = 'solid'
    style.dispatchEvent(new Event('change', { bubbles: true }))

    const color = findField(container, '辅助线颜色').querySelector<HTMLInputElement>(
      'input[type="text"]',
    )!
    fireInput(color, '#123456')

    const width = findField(container, '辅助线宽度').querySelector<HTMLInputElement>(
      'input[type="number"]',
    )!
    fireInput(width, '1.5')

    const updated = onOptionsChange.mock.lastCall![0] as WaveformOptions
    expect(updated.grid).toMatchObject({
      style: 'solid',
      color: '#123456',
      width: 1.5,
      x: { visible: true },
      y: { visible: true },
    })
    expect(container.textContent).not.toContain('X 网格颜色')
    expect(container.textContent).not.toContain('Y 网格虚线')
  })

  it('clears optional axis bounds and blocks invalid D3 formats', () => {
    const { container, onOptionsChange } = setup()
    clickButton(container, '坐标轴', '[role="tab"]')
    const minInput = findField(container, '最小值').querySelector<HTMLInputElement>('input')!
    fireInput(minInput, '10')
    fireInput(minInput, '')
    expect((onOptionsChange.mock.lastCall![0] as WaveformOptions).xAxis?.min).toBeUndefined()

    const callsBeforeInvalidFormat = onOptionsChange.mock.calls.length
    const formatInput = findField(container, '数字格式').querySelector<HTMLInputElement>('input')!
    fireInput(formatInput, 'invalid format')
    expect(formatInput.getAttribute('aria-invalid')).toBe('true')
    expect(onOptionsChange).toHaveBeenCalledTimes(callsBeforeInvalidFormat)
  })

  it('edits and clears the optional X-axis tick step', () => {
    const { container, onOptionsChange } = setup()
    clickButton(container, '坐标轴', '[role="tab"]')
    const input = findField(container, '刻度步长').querySelector<HTMLInputElement>('input')!

    expect(input.value).toBe('')
    fireInput(input, '2.5')
    expect((onOptionsChange.mock.lastCall![0] as WaveformOptions).xAxis?.tickStep).toBe(2.5)

    fireInput(input, '')
    expect((onOptionsChange.mock.lastCall![0] as WaveformOptions).xAxis?.tickStep).toBeUndefined()

    const callsBeforeInvalidStep = onOptionsChange.mock.calls.length
    fireInput(input, '0')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(onOptionsChange).toHaveBeenCalledTimes(callsBeforeInvalidStep)
  })

  it('omits ineffective and legacy axis controls', () => {
    const { container } = setup()
    clickButton(container, '坐标轴', '[role="tab"]')

    expect(container.textContent).not.toContain('兼容标签')
    expect(container.textContent).not.toContain('位置')

    clickButton(container, '值轴', '.segment-button')
    expect(container.textContent).not.toContain('轴 ID')
    expect(container.querySelector('[aria-label="新增值轴"]')).toBeNull()
    expect(container.querySelector('.axis-command--danger')).toBeNull()
  })

  it('toggles empty-data preview independently of chart options', () => {
    const { container, onEmptyPreviewChange } = setup()
    clickButton(container, '文字', '[role="tab"]')
    clickButton(container, '空状态', '.segment-button')
    const input = findField(container, '预览空数据状态').querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    )!
    input.checked = true
    input.dispatchEvent(new Event('change', { bubbles: true }))
    expect(onEmptyPreviewChange).toHaveBeenLastCalledWith(true)
  })

  it('edits and clears the frame number without dropping its styles', () => {
    const { container, onOptionsChange } = setup()
    clickButton(container, '文字', '[role="tab"]')
    clickButton(container, '图框编号', '.segment-button')

    fireInput(
      findField(container, '图框编号').querySelector<HTMLInputElement>('input')!,
      'FRAME-12',
    )
    fireInput(findField(container, '编号字号').querySelector<HTMLInputElement>('input')!, '48')
    let updated = onOptionsChange.mock.lastCall![0] as WaveformOptions
    expect(updated.frameNumber).toBe('FRAME-12')
    expect(updated.frameNumberStyle).toMatchObject({ color: '#1677ff', opacity: 0.1, fontSize: 48 })

    fireInput(findField(container, '图框编号').querySelector<HTMLInputElement>('input')!, '  ')
    updated = onOptionsChange.mock.lastCall![0] as WaveformOptions
    expect(updated.frameNumber).toBeUndefined()
    expect(updated.frameNumberStyle?.fontSize).toBe(48)

    fireInput(findField(container, '编号字号').querySelector<HTMLInputElement>('input')!, '')
    expect(
      (onOptionsChange.mock.lastCall![0] as WaveformOptions).frameNumberStyle?.fontSize,
    ).toBeUndefined()
  })

  it('turns inherited series values into overrides and clears them again', () => {
    const { container, onSeriesChange } = setup()
    clickButton(container, '曲线', '[role="tab"]')
    const colorOverride = Array.from(
      container.querySelectorAll<HTMLElement>('.series-override'),
    ).find(
      (element) =>
        element.querySelector('.series-override__heading > span')?.textContent === '颜色',
    )!
    const inherit = colorOverride.querySelector<HTMLInputElement>('.inherit-toggle input')!
    expect(inherit.checked).toBe(true)

    inherit.checked = false
    inherit.dispatchEvent(new Event('change', { bubbles: true }))
    expect((onSeriesChange.mock.lastCall![0] as WaveformSeries[])[0].style?.color).toBe('#2563eb')

    inherit.checked = true
    inherit.dispatchEvent(new Event('change', { bubbles: true }))
    expect((onSeriesChange.mock.lastCall![0] as WaveformSeries[])[0].style?.color).toBeUndefined()
  })

  it('switches subsections and series while preserving their current selections', () => {
    const { container } = setup()
    clickButton(container, '线点', '[role="tab"]')
    clickButton(container, '数据点', '.segment-button')
    expect(findField(container, '数据点大小')).toBeTruthy()
    clickButton(container, '布局', '[role="tab"]')
    clickButton(container, '线点', '[role="tab"]')
    expect(
      container.querySelector<HTMLButtonElement>(
        '.config-tabpanel:not([hidden]) .segment-button[aria-pressed="true"]',
      )?.textContent,
    ).toBe('数据点')

    clickButton(container, '曲线', '[role="tab"]')
    clickButton(container, '数据点', '.series-segment-control .segment-button')
    expect(
      container.querySelector<HTMLButtonElement>(
        '.series-segment-control .segment-button[aria-pressed="true"]',
      )?.textContent,
    ).toBe('数据点')
    expect(findField(container, '显示数据点')).toBeTruthy()
    const selector = container.querySelector<HTMLSelectElement>('[aria-label="选择曲线"]')!
    selector.value = '1'
    selector.dispatchEvent(new Event('change', { bubbles: true }))
    expect(container.querySelector<HTMLSelectElement>('[aria-label="选择曲线"]')?.value).toBe('1')
    clickButton(container, '线条', '.series-segment-control .segment-button')
    const inherit = Array.from(container.querySelectorAll<HTMLElement>('.series-override'))
      .find(
        (element) =>
          element.querySelector('.series-override__heading > span')?.textContent === '颜色',
      )
      ?.querySelector<HTMLInputElement>('.inherit-toggle input')
    expect(inherit?.checked).toBe(false)
  })

  it('switches value-axis modes and restores multi-axis configuration', () => {
    const container = document.createElement('div')
    document.body.append(container)
    const onOptionsChange = vi.fn()
    const onSeriesChange = vi.fn()
    createConfigPanel(container, {
      options: resolveOptions({
        yAxes: [{ id: 'left' }, { id: 'right', position: 'right' }],
        grid: { y: { axisId: 'right' } },
        zeroLine: { axisId: 'right' },
      }),
      series: [
        { name: 'CH1', yAxis: 'left', data: [{ x: 0, y: 1 }] },
        { name: 'CH2', yAxis: 'right', data: [{ x: 0, y: 2 }] },
      ],
      onOptionsChange,
      onSeriesChange,
      onEmptyPreviewChange: vi.fn(),
    })

    clickButton(container, '坐标轴', '[role="tab"]')
    clickButton(container, '值轴', '.segment-button')
    const modeButtons = container.querySelectorAll<HTMLButtonElement>(
      '[aria-label="值轴模式"] .segment-button',
    )
    expect(Array.from(modeButtons, (button) => button.textContent)).toEqual(['单值轴', '多值轴'])
    expect(modeButtons[1].getAttribute('aria-pressed')).toBe('true')

    const selector = container.querySelector<HTMLSelectElement>('[aria-label="选择值轴"]')!
    expect(Array.from(selector.options, (option) => option.textContent)).toEqual(['左轴', '右轴'])
    selector.value = '1'
    selector.dispatchEvent(new Event('change', { bubbles: true }))

    fireInput(
      findField(container, '轴线颜色').querySelector<HTMLInputElement>('input[type="text"]')!,
      '#123456',
    )
    clickButton(container, '单值轴', '[aria-label="值轴模式"] .segment-button')

    const singleOptions = onOptionsChange.mock.lastCall![0] as WaveformOptions
    const singleSeries = onSeriesChange.mock.lastCall![0] as WaveformSeries[]
    expect(singleOptions.yAxes).toHaveLength(1)
    expect(singleOptions.yAxes?.[0]).toMatchObject({ id: 'left', position: 'left' })
    expect(singleOptions.grid?.y?.axisId).toBe('left')
    expect(singleOptions.zeroLine?.axisId).toBe('left')
    expect(singleSeries.every((item) => item.yAxis === 'left')).toBe(true)
    expect(container.querySelector('[aria-label="选择值轴"]')).toBeNull()

    clickButton(container, '网格', '[role="tab"]')
    expect(container.textContent).not.toContain('Y 网格参考轴')
    clickButton(container, '零线', '.segment-button')
    expect(container.textContent).not.toContain('零线参考轴')
    clickButton(container, '曲线', '[role="tab"]')
    expect(container.querySelector('.series-axis')).toBeNull()

    clickButton(container, '坐标轴', '[role="tab"]')
    fireInput(
      findField(container, '轴线颜色').querySelector<HTMLInputElement>('input[type="text"]')!,
      '#abcdef',
    )
    clickButton(container, '多值轴', '[aria-label="值轴模式"] .segment-button')

    const restoredOptions = onOptionsChange.mock.lastCall![0] as WaveformOptions
    const restoredSeries = onSeriesChange.mock.lastCall![0] as WaveformSeries[]
    expect(restoredOptions.yAxes).toHaveLength(2)
    expect(restoredOptions.yAxes?.[0]).toMatchObject({
      id: 'left',
      position: 'left',
      color: '#abcdef',
    })
    expect(restoredOptions.yAxes?.[1]).toMatchObject({
      id: 'right',
      position: 'right',
      color: '#123456',
    })
    expect(restoredOptions.grid?.y?.axisId).toBe('right')
    expect(restoredOptions.zeroLine?.axisId).toBe('right')
    expect(restoredSeries.map((item) => item.yAxis)).toEqual(['left', 'right'])
  })

  it('recognizes an initial single axis and creates default left/right bindings', () => {
    const container = document.createElement('div')
    document.body.append(container)
    const onOptionsChange = vi.fn()
    const onSeriesChange = vi.fn()
    createConfigPanel(container, {
      options: resolveOptions({ yAxes: [{ id: 'left' }] }),
      series: [
        { name: 'CH1', data: [{ x: 0, y: 1 }] },
        { name: 'CH2', data: [{ x: 0, y: 2 }] },
        { name: 'CH3', data: [{ x: 0, y: 3 }] },
      ],
      onOptionsChange,
      onSeriesChange,
      onEmptyPreviewChange: vi.fn(),
    })

    clickButton(container, '坐标轴', '[role="tab"]')
    clickButton(container, '值轴', '.segment-button')
    expect(
      container.querySelector<HTMLButtonElement>(
        '[aria-label="值轴模式"] .segment-button[aria-pressed="true"]',
      )?.textContent,
    ).toBe('单值轴')

    clickButton(container, '多值轴', '[aria-label="值轴模式"] .segment-button')
    expect((onOptionsChange.mock.lastCall![0] as WaveformOptions).yAxes).toMatchObject([
      { id: 'left', position: 'left' },
      { id: 'right', position: 'right' },
    ])
    expect(
      (onSeriesChange.mock.lastCall![0] as WaveformSeries[]).map((item) => item.yAxis),
    ).toEqual(['left', 'left', 'right'])
  })
})
