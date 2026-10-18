import * as d3 from 'd3'
import { resolveOptions } from '../../../src/display/config/resolve'
import type { WaveformSeries, WaveformSeriesStyle } from '../../../src/display/types/data'
import type { ValueAxisOptions, WaveformOptions } from '../../../src/display/types/options'

type FieldKind = 'boolean' | 'color' | 'number' | 'range' | 'select' | 'text'

interface FieldDefinition {
  kind: FieldKind
  label: string
  path: string
  min?: number
  max?: number
  step?: number
  optional?: boolean
  options?: ReadonlyArray<{ label: string; value: string }>
  parse?: (raw: string) => ParseResult<string | number | undefined>
  validate?: (raw: string) => boolean
}

interface SubsectionDefinition {
  id: string
  label: string
  fields: FieldDefinition[]
}

interface TabDefinition {
  id: string
  label: string
  subsections?: SubsectionDefinition[]
  series?: boolean
}

export interface ParseResult<T> {
  valid: boolean
  value?: T
}

export interface ConfigPanelOptions {
  options: WaveformOptions
  series: WaveformSeries[]
  onOptionsChange: (options: WaveformOptions) => void
  onSeriesChange: (series: WaveformSeries[]) => void
  onEmptyPreviewChange: (enabled: boolean) => void
}

type ValueAxisMode = 'single' | 'multiple'

interface MultiAxisSnapshot {
  axes: [ValueAxisOptions, ValueAxisOptions]
  bindings: string[]
  gridAxisId: string
  zeroLineAxisId: string
}

const boolean = (label: string, path: string): FieldDefinition => ({ kind: 'boolean', label, path })
const color = (label: string, path: string): FieldDefinition => ({ kind: 'color', label, path })
const text = (
  label: string,
  path: string,
  validate?: (raw: string) => boolean,
): FieldDefinition => ({ kind: 'text', label, path, validate })
const number = (
  label: string,
  path: string,
  min?: number,
  step = 1,
  optional = false,
  max?: number,
): FieldDefinition => ({ kind: 'number', label, path, min, max, step, optional })
const range = (
  label: string,
  path: string,
  min: number,
  max: number,
  step: number,
): FieldDefinition => ({ kind: 'range', label, path, min, max, step })
const select = (
  label: string,
  path: string,
  options: ReadonlyArray<{ label: string; value: string }>,
): FieldDefinition => ({ kind: 'select', label, path, options })

const lineTypes = [
  { label: '直线', value: 'linear' },
  { label: '阶梯（起点）', value: 'step-start' },
  { label: '阶梯（中点）', value: 'step-middle' },
  { label: '阶梯（终点）', value: 'step-end' },
] as const
const lineStyles = [
  { label: '实线', value: 'solid' },
  { label: '虚线', value: 'dashed' },
  { label: '点划线', value: 'dash-dot' },
] as const
const gridLineStyles = [
  { label: '实线', value: 'solid' },
  { label: '虚线', value: 'dashed' },
] as const
const pointTypes = [
  { label: '圆形', value: 'circle' },
  { label: '方形', value: 'square' },
  { label: '三角形', value: 'triangle' },
  { label: '菱形', value: 'diamond' },
] as const

function axisFields(prefix: string, isX = prefix === 'xAxis'): FieldDefinition[] {
  return [
    boolean('显示坐标轴', `${prefix}.visible`),
    number('最小值', `${prefix}.min`, undefined, 0.1, true),
    number('最大值', `${prefix}.max`, undefined, 0.1, true),
    number('刻度数量', `${prefix}.tickCount`, 1, 1),
    ...(isX ? [number('刻度步长', `${prefix}.tickStep`, Number.MIN_VALUE, 0.1, true)] : []),
    ...(isX
      ? [
          boolean('隐藏端点刻度', `${prefix}.hideEndTicks`),
          boolean('显示端点值', `${prefix}.showEndValues`),
        ]
      : []),
    number('刻度长度', `${prefix}.tickSize`, 0, 1),
    number('刻度间距', `${prefix}.tickPadding`, 0, 1),
    text('数字格式', `${prefix}.tickFormat`, isD3Format),
    color('轴线颜色', `${prefix}.color`),
    number('轴线宽度', `${prefix}.width`, 0, 0.1),
    number('刻度字号', `${prefix}.fontSize`, 1, 1),
    color('刻度文字颜色', `${prefix}.fontColor`),
    text('刻度单位', `${prefix}.unit`),
    boolean('显示轴标题', `${prefix}.title.visible`),
    text('轴标题', `${prefix}.title.text`),
    text('标题单位', `${prefix}.title.unit`),
    color('标题颜色', `${prefix}.title.color`),
    number('标题字号', `${prefix}.title.fontSize`, 1, 1),
    text('标题字重', `${prefix}.title.fontWeight`),
    number('标题偏移', `${prefix}.title.offset`, 0, 1, !isX),
  ]
}

export const tabs: TabDefinition[] = [
  {
    id: 'layout',
    label: '布局',
    subsections: [
      {
        id: 'size',
        label: '尺寸与留白',
        fields: [
          { kind: 'text', label: '宽度', path: 'width', parse: parseDimension },
          { kind: 'text', label: '高度', path: 'height', parse: parseDimension },
          boolean('响应式布局', 'responsive.enabled'),
          number('宽高比', 'responsive.aspectRatio', 0.1, 0.1),
          number('最小高度', 'responsive.minHeight', 1, 1),
          number('最大高度', 'responsive.maxHeight', 1, 1),
          boolean('自动留白', 'layout.autoPadding'),
          number('上留白', 'padding.top', 0),
          number('右留白', 'padding.right', 0),
          number('下留白', 'padding.bottom', 0),
          number('左留白', 'padding.left', 0),
        ],
      },
      {
        id: 'frame',
        label: '边框',
        fields: [
          boolean('显示边框', 'frame.visible'),
          color('背景颜色', 'frame.backgroundColor'),
          color('边框颜色', 'frame.borderColor'),
          number('边框宽度', 'frame.borderWidth', 0, 0.1),
          select('边框样式', 'frame.borderStyle', [
            { label: '实线', value: 'solid' },
            { label: '虚线', value: 'dashed' },
            { label: '点线', value: 'dotted' },
          ]),
          number('圆角', 'frame.radius', 0),
        ],
      },
    ],
  },
  {
    id: 'stroke',
    label: '线点',
    subsections: [
      {
        id: 'line',
        label: '线条',
        fields: [
          boolean('显示线条', 'line.visible'),
          color('线条颜色', 'line.color'),
          number('线条宽度', 'line.width', 0, 0.1),
          select('连线类型', 'line.type', lineTypes),
          select('线条样式', 'line.style', lineStyles),
          range('线条透明度', 'line.opacity', 0, 1, 0.05),
        ],
      },
      {
        id: 'point',
        label: '数据点',
        fields: [
          boolean('显示数据点', 'point.visible'),
          select('数据点形状', 'point.type', pointTypes),
          number('数据点大小', 'point.size', 0, 0.5),
          color('数据点颜色', 'point.color'),
          color('数据点边框', 'point.borderColor'),
          number('点边框宽度', 'point.borderWidth', 0, 0.1),
        ],
      },
    ],
  },
  {
    id: 'axes',
    label: '坐标轴',
    subsections: [
      {
        id: 'x',
        label: 'X 轴',
        fields: [
          select('范围策略', 'xDomainStrategy.type', [
            { label: '数据范围', value: 'data' },
            { label: '易读范围', value: 'nice' },
          ]),
          select('扩展边界', 'xDomainStrategy.bounds', [
            { label: '两端', value: 'both' },
            { label: '仅终点', value: 'end' },
          ]),
          number('策略刻度数', 'xDomainStrategy.tickCount', 1, 1),
          boolean('包含手动范围', 'xDomainStrategy.includeExplicit'),
          ...axisFields('xAxis'),
        ],
      },
      { id: 'value-y', label: '值轴', fields: [] },
    ],
  },
  {
    id: 'grid',
    label: '网格',
    subsections: [
      {
        id: 'grid-lines',
        label: '网格线',
        fields: [
          boolean('显示网格', 'grid.visible'),
          select('辅助线样式', 'grid.style', gridLineStyles),
          color('辅助线颜色', 'grid.color'),
          number('辅助线宽度', 'grid.width', 0, 0.1),
          boolean('显示 X 网格', 'grid.x.visible'),
          number('X 网格宽度', 'grid.x.width', 0, 0.1),
          boolean('显示 Y 网格', 'grid.y.visible'),
          number('Y 网格宽度', 'grid.y.width', 0, 0.1),
          select('Y 网格参考轴', 'grid.y.axisId', []),
        ],
      },
      {
        id: 'zero-line',
        label: '零线',
        fields: [
          boolean('显示零线', 'zeroLine.visible'),
          color('零线颜色', 'zeroLine.color'),
          number('零线透明度', 'zeroLine.opacity', 0, 0.05, false, 1),
          number('零线宽度', 'zeroLine.width', 0, 0.1),
          text('零线虚线', 'zeroLine.dash'),
          select('零线参考轴', 'zeroLine.axisId', []),
        ],
      },
    ],
  },
  {
    id: 'text',
    label: '文字',
    subsections: [
      {
        id: 'title',
        label: '标题',
        fields: [
          boolean('显示图表标题', 'title.visible'),
          text('图表标题', 'title.text'),
          select('标题对齐', 'title.align', [
            { label: '左对齐', value: 'left' },
            { label: '居中', value: 'center' },
            { label: '右对齐', value: 'right' },
          ]),
          color('标题颜色', 'title.color'),
          number('标题字号', 'title.fontSize', 1),
          text('标题字重', 'title.fontWeight'),
        ],
      },
      {
        id: 'shot',
        label: '炮号',
        fields: [
          boolean('显示炮号', 'shot.visible'),
          text('炮号文字', 'shot.text'),
          color('炮号颜色', 'shot.color'),
          number('炮号字号', 'shot.fontSize', 1),
          text('炮号字重', 'shot.fontWeight'),
        ],
      },
      {
        id: 'frame-number',
        label: '图框编号',
        fields: [
          {
            kind: 'text',
            label: '图框编号',
            path: 'frameNumber',
            parse: (raw) => ({ valid: true, value: raw.trim() || undefined }),
          },
          color('编号颜色', 'frameNumberStyle.color'),
          range('编号透明度', 'frameNumberStyle.opacity', 0, 1, 0.05),
          number('编号字号', 'frameNumberStyle.fontSize', 1, 1, true),
          text('编号字体', 'frameNumberStyle.fontFamily'),
          text('编号字重', 'frameNumberStyle.fontWeight'),
        ],
      },
      {
        id: 'legend',
        label: '图例',
        fields: [
          boolean('显示图例', 'legend.visible'),
          select('图例位置', 'legend.position', [
            { label: '左上', value: 'top-left' },
            { label: '右上', value: 'top-right' },
            { label: '左下', value: 'bottom-left' },
            { label: '右下', value: 'bottom-right' },
          ]),
          select('图例方向', 'legend.orientation', [
            { label: '横向', value: 'horizontal' },
            { label: '纵向', value: 'vertical' },
          ]),
          color('图例文字颜色', 'legend.color'),
          number('图例字号', 'legend.fontSize', 1),
          number('图例间距', 'legend.itemGap', 0),
          number('图例线长', 'legend.lineLength', 1),
          number('单项最大宽度', 'legend.maxItemWidth', 1),
        ],
      },
      {
        id: 'empty',
        label: '空状态',
        fields: [
          boolean('显示空数据文字', 'emptyState.visible'),
          text('提示文字', 'emptyState.text'),
          color('提示颜色', 'emptyState.color'),
          number('提示字号', 'emptyState.fontSize', 1),
        ],
      },
    ],
  },
  { id: 'series', label: '曲线', series: true },
]

export function parseNumberInput(raw: string, optional = false): ParseResult<number | undefined> {
  if (raw.trim() === '') return optional ? { valid: true, value: undefined } : { valid: false }
  const value = Number(raw)
  return Number.isFinite(value) ? { valid: true, value } : { valid: false }
}

export function parseDimension(raw: string): ParseResult<string | number> {
  const value = raw.trim()
  if (!value) return { valid: false }
  const numeric = Number(value)
  return Number.isFinite(numeric) ? { valid: true, value: numeric } : { valid: true, value }
}

export function colorPickerValue(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'
}

export function getAtPath(source: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined,
      source,
    )
}

export function setAtPath<T>(source: T, path: string, value: unknown): T {
  const keys = path.split('.')
  const clone = (input: unknown): Record<string, unknown> =>
    (Array.isArray(input)
      ? [...input]
      : { ...(input as Record<string, unknown>) }) as unknown as Record<string, unknown>
  const root = clone(source)
  let output = root
  let input = source as Record<string, unknown>
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      output[key] = value
      return
    }
    const nextInput = input?.[key]
    const nextOutput = nextInput && typeof nextInput === 'object' ? clone(nextInput) : {}
    output[key] = nextOutput
    output = nextOutput
    input = (nextInput ?? {}) as Record<string, unknown>
  })
  return root as T
}

function isD3Format(value: string): boolean {
  if (!value) return true
  try {
    d3.format(value)
    return true
  } catch {
    return false
  }
}

function isCssColor(value: string): boolean {
  if (!value) return false
  return (
    typeof CSS === 'undefined' || typeof CSS.supports !== 'function' || CSS.supports('color', value)
  )
}

function fieldShell(labelText: string): { shell: HTMLLabelElement; control: HTMLDivElement } {
  const shell = document.createElement('label')
  shell.className = 'config-field'
  const label = document.createElement('span')
  label.className = 'config-field__label'
  label.textContent = labelText
  const control = document.createElement('div')
  control.className = 'config-field__control'
  shell.append(label, control)
  return { shell, control }
}

function createField(
  field: FieldDefinition,
  read: () => unknown,
  commit: (value: unknown) => void,
): HTMLElement {
  const { shell, control } = fieldShell(field.label)
  const current = read()

  if (field.kind === 'boolean') {
    shell.classList.add('config-field--switch')
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = Boolean(current)
    input.className = 'switch-input'
    const visual = document.createElement('span')
    visual.className = 'switch-visual'
    visual.setAttribute('aria-hidden', 'true')
    input.addEventListener('change', () => commit(input.checked))
    control.append(input, visual)
    return shell
  }

  if (field.kind === 'select') {
    const input = document.createElement('select')
    for (const option of field.options ?? []) {
      const element = document.createElement('option')
      element.value = option.value
      element.textContent = option.label
      input.append(element)
    }
    input.value = String(current ?? '')
    input.addEventListener('change', () => commit(input.value))
    control.append(input)
    return shell
  }

  if (field.kind === 'color') {
    const picker = document.createElement('input')
    picker.type = 'color'
    picker.className = 'color-picker'
    picker.value = colorPickerValue(current)
    picker.setAttribute('aria-label', `${field.label}色板`)
    const input = document.createElement('input')
    input.type = 'text'
    input.value = String(current ?? '')
    input.spellcheck = false
    picker.addEventListener('input', () => {
      input.value = picker.value
      input.removeAttribute('aria-invalid')
      commit(picker.value)
    })
    input.addEventListener('input', () => {
      const valid = isCssColor(input.value)
      input.setAttribute('aria-invalid', String(!valid))
      if (!valid) return
      picker.value = colorPickerValue(input.value)
      commit(input.value)
    })
    control.classList.add('color-control')
    control.append(picker, input)
    return shell
  }

  if (field.kind === 'range') {
    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = String(field.min)
    slider.max = String(field.max)
    slider.step = String(field.step)
    slider.value = String(current)
    slider.setAttribute('aria-label', field.label)
    const input = document.createElement('input')
    input.type = 'number'
    input.min = slider.min
    input.max = slider.max
    input.step = slider.step
    input.value = slider.value
    const apply = (raw: string, source: HTMLInputElement, target: HTMLInputElement) => {
      const parsed = parseNumberInput(raw)
      const valid = parsed.valid && parsed.value! >= field.min! && parsed.value! <= field.max!
      source.setAttribute('aria-invalid', String(!valid))
      if (!valid) return
      target.value = String(parsed.value)
      commit(parsed.value)
    }
    slider.addEventListener('input', () => apply(slider.value, slider, input))
    input.addEventListener('input', () => apply(input.value, input, slider))
    control.classList.add('range-control')
    control.append(slider, input)
    return shell
  }

  const input = document.createElement('input')
  input.type = field.kind === 'number' ? 'number' : 'text'
  input.value = current == null ? '' : String(current)
  if (field.min != null) input.min = String(field.min)
  if (field.max != null) input.max = String(field.max)
  if (field.step != null) input.step = String(field.step)
  input.addEventListener('input', () => {
    const parsed = field.parse
      ? field.parse(input.value)
      : field.kind === 'number'
        ? parseNumberInput(input.value, field.optional)
        : { valid: field.validate?.(input.value) ?? true, value: input.value }
    let valid = parsed.valid
    if (valid && typeof parsed.value === 'number') {
      valid =
        (field.min == null || parsed.value >= field.min) &&
        (field.max == null || parsed.value <= field.max)
    }
    input.setAttribute('aria-invalid', String(!valid))
    if (valid) commit(parsed.value)
  })
  control.append(input)
  return shell
}

function cloneSeries(series: WaveformSeries[]): WaveformSeries[] {
  return series.map((item) => ({
    ...item,
    data: item.data,
    style: item.style
      ? { ...item.style, point: item.style.point ? { ...item.style.point } : undefined }
      : undefined,
  }))
}

function cloneAxis(axis: ValueAxisOptions): ValueAxisOptions {
  return { ...axis, title: axis.title ? { ...axis.title } : undefined }
}

function seriesField(
  label: string,
  kind: FieldKind,
  value: unknown,
  onCommit: (value: unknown) => void,
  options?: FieldDefinition['options'],
  min?: number,
  max?: number,
  step?: number,
): HTMLElement {
  return createField({ label, kind, path: '', options, min, max, step }, () => value, onCommit)
}

function createOverrideField(
  label: string,
  value: unknown,
  inheritedValue: unknown,
  createControl: (value: unknown, commit: (value: unknown) => void) => HTMLElement,
  commit: (value: unknown) => void,
): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'series-override'
  const inheritLabel = document.createElement('label')
  inheritLabel.className = 'inherit-toggle'
  const inherit = document.createElement('input')
  inherit.type = 'checkbox'
  inherit.checked = value === undefined
  const caption = document.createElement('span')
  caption.textContent = '跟随全局'
  inheritLabel.append(inherit, caption)
  let control = createControl(value ?? inheritedValue, commit)
  control.classList.toggle('is-disabled', inherit.checked)
  control
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select')
    .forEach((element) => {
      element.disabled = inherit.checked
    })
  inherit.addEventListener('change', () => {
    if (inherit.checked) {
      commit(undefined)
    } else {
      commit(inheritedValue)
    }
    const replacement = createControl(inherit.checked ? inheritedValue : inheritedValue, commit)
    replacement.classList.toggle('is-disabled', inherit.checked)
    replacement
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select')
      .forEach((element) => {
        element.disabled = inherit.checked
      })
    control.replaceWith(replacement)
    control = replacement
  })
  const heading = document.createElement('div')
  heading.className = 'series-override__heading'
  const title = document.createElement('span')
  title.textContent = label
  heading.append(title, inheritLabel)
  wrapper.append(heading, control)
  return wrapper
}

function renderSeriesPanel(
  parent: HTMLElement,
  getSeries: () => WaveformSeries[],
  getOptions: () => WaveformOptions,
  getAxisIds: () => string[],
  selectedIndex: number,
  onSelect: (index: number) => void,
  activeCategory: 'line' | 'point',
  onCategoryChange: (category: 'line' | 'point') => void,
  updateSeries: (index: number, path: string, value: unknown) => void,
  showAxisBinding: boolean,
) {
  const series = getSeries()
  if (!series.length) {
    const empty = document.createElement('p')
    empty.className = 'config-empty'
    empty.textContent = '暂无曲线'
    parent.append(empty)
    return
  }

  const index = Math.min(selectedIndex, series.length - 1)
  const item = series[index]
  const toolbar = document.createElement('div')
  toolbar.className = 'series-toolbar'
  const selectorField = document.createElement('label')
  const selectorLabel = document.createElement('span')
  selectorLabel.textContent = '当前曲线'
  const selector = document.createElement('select')
  selector.setAttribute('aria-label', '选择曲线')
  series.forEach((entry, entryIndex) => {
    const option = document.createElement('option')
    option.value = String(entryIndex)
    option.textContent = entry.name || entry.id || `曲线 ${entryIndex + 1}`
    selector.append(option)
  })
  selector.value = String(index)
  selector.addEventListener('change', () => onSelect(Number(selector.value)))
  selectorField.className = 'series-selector'
  selectorField.append(selectorLabel, selector)

  const axisIds = getAxisIds()
  const segments = document.createElement('div')
  segments.className = 'segment-control series-segment-control'
  segments.setAttribute('aria-label', '曲线样式类型')
  for (const category of [
    { id: 'line', label: '线条' },
    { id: 'point', label: '数据点' },
  ] as const) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'segment-button'
    button.textContent = category.label
    button.setAttribute('aria-pressed', String(category.id === activeCategory))
    button.addEventListener('click', () => onCategoryChange(category.id))
    segments.append(button)
  }

  const overrides = document.createElement('div')
  overrides.className = 'series-overrides'
  const definitions: Array<{
    label: string
    path: string
    category: 'line' | 'point'
    inherited: () => unknown
    control: (value: unknown, commit: (value: unknown) => void) => HTMLElement
  }> = [
    {
      label: '颜色',
      path: 'style.color',
      category: 'line',
      inherited: () => getOptions().line?.color,
      control: (value, commit) => seriesField('颜色', 'color', value, commit),
    },
    {
      label: '线宽',
      path: 'style.lineWidth',
      category: 'line',
      inherited: () => getOptions().line?.width,
      control: (value, commit) =>
        seriesField('线宽', 'number', value, commit, undefined, 0, undefined, 0.1),
    },
    {
      label: '连线类型',
      path: 'style.lineType',
      category: 'line',
      inherited: () => getOptions().line?.type,
      control: (value, commit) => seriesField('连线类型', 'select', value, commit, lineTypes),
    },
    {
      label: '线条样式',
      path: 'style.lineStyle',
      category: 'line',
      inherited: () => getOptions().line?.style,
      control: (value, commit) => seriesField('线条样式', 'select', value, commit, lineStyles),
    },
    {
      label: '透明度',
      path: 'style.opacity',
      category: 'line',
      inherited: () => getOptions().line?.opacity,
      control: (value, commit) =>
        seriesField('透明度', 'range', value, commit, undefined, 0, 1, 0.05),
    },
    {
      label: '显示数据点',
      path: 'style.point.visible',
      category: 'point',
      inherited: () => getOptions().point?.visible,
      control: (value, commit) => seriesField('显示数据点', 'boolean', value, commit),
    },
    {
      label: '数据点形状',
      path: 'style.point.type',
      category: 'point',
      inherited: () => getOptions().point?.type,
      control: (value, commit) => seriesField('数据点形状', 'select', value, commit, pointTypes),
    },
    {
      label: '数据点大小',
      path: 'style.point.size',
      category: 'point',
      inherited: () => getOptions().point?.size,
      control: (value, commit) =>
        seriesField('数据点大小', 'number', value, commit, undefined, 0, undefined, 0.5),
    },
    {
      label: '数据点颜色',
      path: 'style.point.color',
      category: 'point',
      inherited: () => getOptions().point?.color,
      control: (value, commit) => seriesField('数据点颜色', 'color', value, commit),
    },
    {
      label: '点边框颜色',
      path: 'style.point.borderColor',
      category: 'point',
      inherited: () => getOptions().point?.borderColor,
      control: (value, commit) => seriesField('点边框颜色', 'color', value, commit),
    },
    {
      label: '点边框宽度',
      path: 'style.point.borderWidth',
      category: 'point',
      inherited: () => getOptions().point?.borderWidth,
      control: (value, commit) =>
        seriesField('点边框宽度', 'number', value, commit, undefined, 0, undefined, 0.1),
    },
  ]
  for (const definition of definitions.filter((entry) => entry.category === activeCategory)) {
    overrides.append(
      createOverrideField(
        definition.label,
        getAtPath(item, definition.path),
        definition.inherited(),
        definition.control,
        (value) => updateSeries(index, definition.path, value),
      ),
    )
  }
  toolbar.classList.toggle('series-toolbar--single', !showAxisBinding)
  toolbar.append(selectorField)
  if (showAxisBinding) {
    const selectedAxisId = item.yAxis && axisIds.includes(item.yAxis) ? item.yAxis : axisIds[0]
    const axis = seriesField(
      '坐标轴',
      'select',
      selectedAxisId,
      (value) => updateSeries(index, 'yAxis', value),
      axisIds.map((id) => ({ label: id === 'right' ? '右轴' : '左轴', value: id })),
    )
    axis.classList.add('series-axis')
    toolbar.append(axis)
  }
  parent.append(toolbar, segments, overrides)
}

let configPanelCounter = 0

export function createConfigPanel(container: HTMLElement, config: ConfigPanelOptions) {
  const resolvedAxes = resolveOptions(config.options).yAxes
  const configuredAxes = config.options.yAxes ?? resolvedAxes
  const sourceLeft = configuredAxes.find((axis) => axis.position !== 'right') ?? resolvedAxes[0]
  const sourceRight =
    configuredAxes.find((axis) => axis.position === 'right') ??
    resolveOptions({
      yAxes: [{ id: 'right', position: 'right', visible: true }],
    }).yAxes[0]
  const leftAxis = { ...cloneAxis(sourceLeft), id: 'left', position: 'left' as const }
  const rightAxis = { ...cloneAxis(sourceRight), id: 'right', position: 'right' as const }
  const sourcePositions = new Map(configuredAxes.map((axis) => [axis.id, axis.position]))
  const canonicalAxisId = (axisId?: string) =>
    sourcePositions.get(axisId ?? '') === 'right' ? 'right' : 'left'
  let valueAxisMode: ValueAxisMode = configuredAxes.some((axis) => axis.position === 'right')
    ? 'multiple'
    : 'single'
  let currentSeries: WaveformSeries[] = cloneSeries(config.series).map((series) => ({
    ...series,
    yAxis: valueAxisMode === 'multiple' ? canonicalAxisId(series.yAxis) : 'left',
  }))
  let currentOptions: WaveformOptions = {
    ...config.options,
    yAxes: valueAxisMode === 'multiple' ? [leftAxis, rightAxis] : [leftAxis],
    grid: {
      ...config.options.grid,
      y: {
        ...config.options.grid?.y,
        axisId:
          valueAxisMode === 'multiple' ? canonicalAxisId(config.options.grid?.y?.axisId) : 'left',
      },
    },
    zeroLine: {
      ...config.options.zeroLine,
      axisId:
        valueAxisMode === 'multiple' ? canonicalAxisId(config.options.zeroLine?.axisId) : 'left',
    },
  }
  const defaultBindings = config.series.map((_, index) =>
    index < Math.ceil(config.series.length / 2) ? 'left' : 'right',
  )
  let multiAxisSnapshot: MultiAxisSnapshot = {
    axes: [cloneAxis(leftAxis), cloneAxis(rightAxis)],
    bindings:
      valueAxisMode === 'multiple'
        ? currentSeries.map((series) => series.yAxis ?? 'left')
        : defaultBindings,
    gridAxisId: valueAxisMode === 'multiple' ? (currentOptions.grid?.y?.axisId ?? 'left') : 'left',
    zeroLineAxisId:
      valueAxisMode === 'multiple' ? (currentOptions.zeroLine?.axisId ?? 'left') : 'left',
  }
  let activeTabId = tabs[0].id
  let selectedSeriesIndex = 0
  let activeSeriesCategory: 'line' | 'point' = 'line'
  let selectedValueAxisIndex = 0
  let emptyPreview = false
  const activeSubsections = new Map(tabs.map((tab) => [tab.id, tab.subsections?.[0]?.id ?? '']))
  const instanceId = ++configPanelCounter
  container.replaceChildren()
  container.classList.add('config-panel')

  const heading = document.createElement('div')
  heading.className = 'config-panel__heading'
  const title = document.createElement('h2')
  title.textContent = '实时配置'
  heading.append(title)
  const tabList = document.createElement('div')
  tabList.className = 'config-tabs'
  tabList.setAttribute('role', 'tablist')
  tabList.setAttribute('aria-label', '配置分类')
  const panelHost = document.createElement('div')
  panelHost.className = 'config-panels'
  const tabButtons = new Map<string, HTMLButtonElement>()
  const tabPanels = new Map<string, HTMLDivElement>()

  const updateSeries = (index: number, path: string, value: unknown) => {
    const next = cloneSeries(currentSeries)
    next[index] = setAtPath(next[index], path, value)
    currentSeries = next
    if (valueAxisMode === 'multiple' && path === 'yAxis') {
      multiAxisSnapshot.bindings[index] = String(value)
    }
    config.onSeriesChange(cloneSeries(currentSeries))
  }

  const valueAxes = () => currentOptions.yAxes ?? [leftAxis]
  const axisIds = () => (valueAxisMode === 'multiple' ? ['left', 'right'] : ['left'])

  const commitOptions = (next: WaveformOptions) => {
    currentOptions = next
    const nextAxes = next.yAxes ?? []
    if (valueAxisMode === 'multiple' && nextAxes.length >= 2) {
      multiAxisSnapshot = {
        ...multiAxisSnapshot,
        axes: [cloneAxis(nextAxes[0]), cloneAxis(nextAxes[1])],
        gridAxisId: next.grid?.y?.axisId ?? 'left',
        zeroLineAxisId: next.zeroLine?.axisId ?? 'left',
      }
    } else if (valueAxisMode === 'single' && nextAxes[0]) {
      multiAxisSnapshot.axes[0] = cloneAxis(nextAxes[0])
    }
    config.onOptionsChange(currentOptions)
  }

  const switchValueAxisMode = (mode: ValueAxisMode) => {
    if (mode === valueAxisMode) return
    if (mode === 'single') {
      multiAxisSnapshot = {
        axes: [cloneAxis(valueAxes()[0]), cloneAxis(valueAxes()[1] ?? multiAxisSnapshot.axes[1])],
        bindings: currentSeries.map((series) => series.yAxis ?? 'left'),
        gridAxisId: currentOptions.grid?.y?.axisId ?? 'left',
        zeroLineAxisId: currentOptions.zeroLine?.axisId ?? 'left',
      }
      currentOptions = {
        ...currentOptions,
        yAxes: [cloneAxis(multiAxisSnapshot.axes[0])],
        grid: { ...currentOptions.grid, y: { ...currentOptions.grid?.y, axisId: 'left' } },
        zeroLine: { ...currentOptions.zeroLine, axisId: 'left' },
      }
      currentSeries = currentSeries.map((series) => ({ ...series, yAxis: 'left' }))
    } else {
      currentOptions = {
        ...currentOptions,
        yAxes: multiAxisSnapshot.axes.map(cloneAxis),
        grid: {
          ...currentOptions.grid,
          y: { ...currentOptions.grid?.y, axisId: multiAxisSnapshot.gridAxisId },
        },
        zeroLine: { ...currentOptions.zeroLine, axisId: multiAxisSnapshot.zeroLineAxisId },
      }
      currentSeries = currentSeries.map((series, index) => ({
        ...series,
        yAxis: multiAxisSnapshot.bindings[index] ?? 'left',
      }))
    }
    valueAxisMode = mode
    selectedValueAxisIndex = 0
    config.onOptionsChange(currentOptions)
    config.onSeriesChange(cloneSeries(currentSeries))
    renderActivePanel()
  }

  const renderFields = (fieldsDefinition: FieldDefinition[], subsectionId: string) => {
    const fields = document.createElement('div')
    fields.className = 'config-grid'
    for (const field of fieldsDefinition) {
      const axisReference = field.path === 'grid.y.axisId' || field.path === 'zeroLine.axisId'
      if (axisReference && valueAxisMode === 'single') continue
      const dynamicField =
        field.path === 'grid.y.axisId' || field.path === 'zeroLine.axisId'
          ? {
              ...field,
              options: axisIds().map((id) => ({
                label: id === 'right' ? '右轴' : '左轴',
                value: id,
              })),
            }
          : field
      fields.append(
        createField(
          dynamicField,
          () => getAtPath(currentOptions, dynamicField.path),
          (value) => {
            commitOptions(setAtPath(currentOptions, dynamicField.path, value))
          },
        ),
      )
    }
    if (subsectionId === 'empty') {
      fields.prepend(
        createField(
          boolean('预览空数据状态', '__emptyPreview'),
          () => emptyPreview,
          (value) => {
            emptyPreview = Boolean(value)
            config.onEmptyPreviewChange(emptyPreview)
          },
        ),
      )
    }
    return fields
  }

  const renderValueAxes = (parent: HTMLElement) => {
    const axes = valueAxes()
    const index = Math.min(selectedValueAxisIndex, axes.length - 1)
    const modeControl = document.createElement('div')
    modeControl.className = 'segment-control value-axis-mode'
    modeControl.setAttribute('aria-label', '值轴模式')
    for (const mode of [
      { id: 'single', label: '单值轴' },
      { id: 'multiple', label: '多值轴' },
    ] as const) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'segment-button'
      button.textContent = mode.label
      button.setAttribute('aria-pressed', String(mode.id === valueAxisMode))
      button.addEventListener('click', () => switchValueAxisMode(mode.id))
      modeControl.append(button)
    }
    parent.append(modeControl)

    if (valueAxisMode === 'multiple') {
      const toolbar = document.createElement('div')
      toolbar.className = 'value-axis-toolbar'
      const selector = document.createElement('select')
      selector.setAttribute('aria-label', '选择值轴')
      axes.forEach((item, axisIndex) => {
        const option = document.createElement('option')
        option.value = String(axisIndex)
        option.textContent = item.position === 'right' ? '右轴' : '左轴'
        selector.append(option)
      })
      selector.value = String(index)
      selector.addEventListener('change', () => {
        selectedValueAxisIndex = Number(selector.value)
        renderActivePanel()
      })
      toolbar.append(selector)
      parent.append(toolbar)
    }

    const fields = document.createElement('div')
    fields.className = 'config-grid value-axis-fields'
    for (const field of axisFields(`yAxes.${index}`, false)) {
      fields.append(
        createField(
          field,
          () => getAtPath(currentOptions, field.path),
          (value) => commitOptions(setAtPath(currentOptions, field.path, value)),
        ),
      )
    }
    parent.append(fields)
  }

  const renderActivePanel = () => {
    const tab = tabs.find((entry) => entry.id === activeTabId)!
    const panel = tabPanels.get(tab.id)!
    panel.replaceChildren()
    if (tab.series) {
      renderSeriesPanel(
        panel,
        () => currentSeries,
        () => currentOptions,
        axisIds,
        selectedSeriesIndex,
        (index) => {
          selectedSeriesIndex = index
          renderActivePanel()
        },
        activeSeriesCategory,
        (category) => {
          activeSeriesCategory = category
          renderActivePanel()
        },
        updateSeries,
        valueAxisMode === 'multiple',
      )
      return
    }
    const subsections = tab.subsections ?? []
    const activeSubsectionId = activeSubsections.get(tab.id) ?? subsections[0]?.id
    if (subsections.length > 1) {
      const segmented = document.createElement('div')
      segmented.className = 'segment-control'
      segmented.setAttribute('aria-label', `${tab.label}配置`)
      for (const subsection of subsections) {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'segment-button'
        button.textContent = subsection.label
        button.setAttribute('aria-pressed', String(subsection.id === activeSubsectionId))
        button.addEventListener('click', () => {
          activeSubsections.set(tab.id, subsection.id)
          renderActivePanel()
        })
        segmented.append(button)
      }
      panel.append(segmented)
    }
    const subsection =
      subsections.find((entry) => entry.id === activeSubsectionId) ?? subsections[0]
    if (subsection?.id === 'value-y') renderValueAxes(panel)
    else if (subsection) panel.append(renderFields(subsection.fields, subsection.id))
  }

  const activateTab = (tabId: string, focus = false) => {
    activeTabId = tabId
    for (const tab of tabs) {
      const active = tab.id === tabId
      const button = tabButtons.get(tab.id)!
      button.setAttribute('aria-selected', String(active))
      button.tabIndex = active ? 0 : -1
      tabPanels.get(tab.id)!.hidden = !active
    }
    renderActivePanel()
    if (focus) tabButtons.get(tabId)?.focus()
  }

  tabs.forEach((tab, index) => {
    const tabId = `config-tab-${instanceId}-${tab.id}`
    const panelId = `config-panel-${instanceId}-${tab.id}`
    const button = document.createElement('button')
    button.type = 'button'
    button.id = tabId
    button.className = 'config-tab'
    button.textContent = tab.label
    button.setAttribute('role', 'tab')
    button.setAttribute('aria-controls', panelId)
    button.addEventListener('click', () => activateTab(tab.id))
    button.addEventListener('keydown', (event) => {
      let nextIndex: number
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
      else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
      else if (event.key === 'Home') nextIndex = 0
      else if (event.key === 'End') nextIndex = tabs.length - 1
      else return
      event.preventDefault()
      activateTab(tabs[nextIndex].id, true)
    })
    const panel = document.createElement('div')
    panel.id = panelId
    panel.className = 'config-tabpanel'
    panel.setAttribute('role', 'tabpanel')
    panel.setAttribute('aria-labelledby', tabId)
    panel.hidden = tab.id !== activeTabId
    tabButtons.set(tab.id, button)
    tabPanels.set(tab.id, panel)
    tabList.append(button)
    panelHost.append(panel)
  })

  container.append(heading, tabList, panelHost)
  activateTab(activeTabId)
}

export function setSeriesStyleOverride(
  style: WaveformSeriesStyle | undefined,
  path: string,
  value: unknown,
): WaveformSeriesStyle {
  return setAtPath(style ?? {}, path, value)
}
