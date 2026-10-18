import * as d3 from 'd3'

type FieldKind = 'boolean' | 'color' | 'number' | 'range' | 'select' | 'text'

export interface FieldDefinition {
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

export interface TabDefinition {
  id: string
  label: string
  subsections?: SubsectionDefinition[]
  series?: boolean
}

export interface ParseResult<T> {
  valid: boolean
  value?: T
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

export const lineTypes = [
  { label: '直线', value: 'linear' },
  { label: '阶梯（起点）', value: 'step-start' },
  { label: '阶梯（中点）', value: 'step-middle' },
  { label: '阶梯（终点）', value: 'step-end' },
] as const
export const lineStyles = [
  { label: '实线', value: 'solid' },
  { label: '虚线', value: 'dashed' },
  { label: '点划线', value: 'dash-dot' },
] as const
const gridLineStyles = [
  { label: '实线', value: 'solid' },
  { label: '虚线', value: 'dashed' },
] as const
export const pointTypes = [
  { label: '圆形', value: 'circle' },
  { label: '方形', value: 'square' },
  { label: '三角形', value: 'triangle' },
  { label: '菱形', value: 'diamond' },
] as const

export function axisFields(prefix: string, isX = prefix === 'xAxis'): FieldDefinition[] {
  return [
    boolean('显示坐标轴', `${prefix}.visible`),
    number('最小值', `${prefix}.min`, undefined, 0.1, true),
    number('最大值', `${prefix}.max`, undefined, 0.1, true),
    number('刻度数量', `${prefix}.tickCount`, 1, 1),
    select('刻度策略', `${prefix}.tickStrategy`, [
      { label: 'Legacy', value: 'legacy' },
      { label: 'Nice', value: 'nice' },
    ]),
    ...(isX ? [number('最小刻度间隔', `${prefix}.minInterval`, 0, 0.1)] : []),
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
  // UI parsing deliberately uses no private package import.
  const match = /^((?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(px|%)?$/i.exec(value)
  const number = match ? Number(match[1]) : NaN
  const parsed =
    Number.isFinite(number) && number > 0 && (match?.[2] !== '%' || number <= 100)
      ? { value: number }
      : undefined
  return parsed
    ? { valid: true, value: /(?:px|%)$/i.test(value) ? value : parsed.value }
    : { valid: false }
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

export function isD3Format(value: string): boolean {
  if (!value) return true
  try {
    d3.format(value)
    return true
  } catch {
    return false
  }
}

export function isCssColor(value: string): boolean {
  if (!value) return false
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function')
    return CSS.supports('color', value)
  const probe = document.createElement('span')
  probe.style.color = value
  return probe.style.color !== ''
}
