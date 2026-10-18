import { TextMeasurer } from '../../shared/axis/TextMeasurer'
import { dashFor } from './helpers.js'
import type { WaveformSeries } from '../types/data.js'
import type { RenderContext } from './context.js'

interface LegendSeries {
  key: string
  series: WaveformSeries
  visible: boolean
}

interface LegendLayoutItem {
  index: number
  width: number
}

interface LegendRow {
  items: LegendLayoutItem[]
  width: number
}

interface FittedLegendLabel {
  text: string
  width: number
  truncated: boolean
}

interface ResolvedLegendLayout {
  labels: string[]
  fittedLabels: FittedLegendLabel[]
  itemWidths: number[]
  rows: LegendRow[]
}

const NARROW_TEXT_WIDTH_FACTOR = 0.6
const SPACE_TEXT_WIDTH_FACTOR = 0.33

function normalizeShot(shot: WaveformSeries['shot']): string | undefined {
  if (typeof shot === 'number') return Number.isFinite(shot) ? String(shot) : undefined
  const value = shot?.trim()
  return value || undefined
}

function wrapLegendItems(
  items: LegendLayoutItem[],
  availableWidth: number,
  itemGap: number,
): LegendRow[] {
  const rows: LegendRow[] = []

  items.forEach((item) => {
    const row = rows[rows.length - 1]
    const nextWidth = row ? row.width + itemGap + item.width : item.width
    if (row && nextWidth <= availableWidth) {
      row.items.push(item)
      row.width = nextWidth
      return
    }
    rows.push({ items: [item], width: item.width })
  })

  return rows
}

function isZeroWidthCodePoint(codePoint: number): boolean {
  return (
    codePoint === 0x200d ||
    (codePoint >= 0x0300 && codePoint <= 0x036f) ||
    (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
    (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
    (codePoint >= 0x20d0 && codePoint <= 0x20ff) ||
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
    (codePoint >= 0xfe20 && codePoint <= 0xfe2f) ||
    (codePoint >= 0xe0100 && codePoint <= 0xe01ef)
  )
}

function isFullWidthCodePoint(codePoint: number): boolean {
  return (
    codePoint >= 0x1100 &&
    (codePoint <= 0x115f ||
      codePoint === 0x2329 ||
      codePoint === 0x232a ||
      (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
      (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
      (codePoint >= 0xff00 && codePoint <= 0xff60) ||
      (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
      (codePoint >= 0x1f300 && codePoint <= 0x1faff) ||
      (codePoint >= 0x20000 && codePoint <= 0x3fffd))
  )
}

function fallbackTextWidth(text: string, fontSize: number): number {
  return Array.from(text).reduce((width, character) => {
    const codePoint = character.codePointAt(0) ?? 0
    if (isZeroWidthCodePoint(codePoint)) return width
    if (/\s/u.test(character)) return width + fontSize * SPACE_TEXT_WIDTH_FACTOR
    return width + fontSize * (isFullWidthCodePoint(codePoint) ? 1 : NARROW_TEXT_WIDTH_FACTOR)
  }, 0)
}

export function createTextMeasurer(
  svg: RenderContext['svg'],
  fontSize: number,
  fontFamily?: string,
  fontWeight?: number | string,
) {
  const measurementNode = svg
    .append('text')
    .attr('visibility', 'hidden')
    .attr('aria-hidden', 'true')
    .attr('font-size', fontSize)
    .attr('font-family', fontFamily ?? null)
    .attr('font-weight', fontWeight ?? null)
    .node()

  return new TextMeasurer(
    {
      width(text) {
        if (!measurementNode) return undefined
        measurementNode.textContent = text
        return measurementNode.getComputedTextLength?.()
      },
      height(text) {
        if (!measurementNode) return undefined
        measurementNode.textContent = text
        return measurementNode.getBBox?.().height
      },
      destroy() {
        measurementNode?.remove()
      },
    },
    (text) => fallbackTextWidth(text, fontSize),
    fontSize,
  )
}

function fitLegendLabel(
  label: string,
  maxWidth: number,
  measure: (text: string) => number,
): FittedLegendLabel {
  const fullWidth = measure(label)
  if (fullWidth <= maxWidth) return { text: label, width: fullWidth, truncated: false }

  const ellipsis = '…'
  const ellipsisWidth = measure(ellipsis)
  if (maxWidth <= ellipsisWidth) return { text: ellipsis, width: ellipsisWidth, truncated: true }

  const characters = Array.from(label)
  let low = 0
  let high = characters.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (measure(characters.slice(0, middle).join('')) + ellipsisWidth <= maxWidth) low = middle
    else high = middle - 1
  }

  const text = `${characters.slice(0, low).join('')}${ellipsis}`
  return { text, width: measure(text), truncated: true }
}

function resolveLegendLayout(
  svg: RenderContext['svg'],
  series: WaveformSeries[],
  options: RenderContext['options'],
  availableWidth: number,
): ResolvedLegendLayout {
  const shots = series.map((item) => normalizeShot(item.shot))
  const multipleShots = new Set(shots.filter((shot): shot is string => shot !== undefined)).size > 1
  const labels = series.map((item, index) => {
    const name = item.name || `Series ${index + 1}`
    return multipleShots && shots[index] ? `${name} (${shots[index]})` : name
  })
  const decorationWidth = options.legend.lineLength + 16
  const maxItemWidth = Math.max(decorationWidth, options.legend.maxItemWidth)
  const textMeasurer = createTextMeasurer(svg, options.legend.fontSize)
  let fittedLabels: FittedLegendLabel[]
  try {
    fittedLabels = labels.map((label) =>
      fitLegendLabel(label, Math.max(0, maxItemWidth - decorationWidth), textMeasurer.measure),
    )
  } finally {
    textMeasurer.destroy()
  }
  const itemWidths = fittedLabels.map((label) =>
    Math.min(maxItemWidth, label.width + decorationWidth),
  )
  const rows = wrapLegendItems(
    itemWidths.map((itemWidth, index) => ({ index, width: itemWidth })),
    availableWidth,
    options.legend.itemGap,
  )
  return { labels, fittedLabels, itemWidths, rows }
}

export function renderLegend(
  ctx: RenderContext,
  legendSeries: LegendSeries[],
  onToggle: (key: string) => void,
) {
  const { svg, options, width, height } = ctx
  if (!options.legend.visible || !legendSeries.length) return

  const p = options.padding
  const lineLength = options.legend.lineLength
  const itemGap = options.legend.itemGap
  const rowHeight = options.legend.fontSize + 10
  const isRight = options.legend.position.includes('right')
  const isBottom = options.legend.position.includes('bottom')
  const horizontal = options.legend.orientation === 'horizontal'
  const group = svg.append('g').attr('class', 'waveform-legend')
  // Left headers extend rightward from the outer tick-label edge.
  const headerInset =
    !isBottom && horizontal
      ? Math.max(
          0,
          ...ctx.yAxes
            .filter(
              (axis) =>
                axis.options.visible && axis.options.position === 'left' && axis.headerWidth,
            )
            .map(
              (axis) =>
                (axis.headerRight ??
                  (axis.headerWidth ?? 0) - (axis.tickFootprint ?? axis.footprint)) -
                axis.offset +
                8,
            ),
        )
      : 0
  const rightHeaderInset =
    !isBottom && horizontal
      ? Math.max(
          0,
          ...ctx.yAxes
            .filter(
              (axis) =>
                axis.options.visible && axis.options.position === 'right' && axis.headerWidth,
            )
            .map(
              (axis) =>
                -(
                  axis.headerLeft ??
                  (axis.tickFootprint ?? axis.footprint) - (axis.headerWidth ?? 0)
                ) -
                axis.offset +
                8,
            ),
        )
      : 0
  const availableWidth = Math.max(0, width - p.left - p.right - headerInset - rightHeaderInset)
  const { labels, fittedLabels, itemWidths, rows } = resolveLegendLayout(
    svg,
    legendSeries.map((item) => item.series),
    options,
    availableWidth,
  )
  const positions: Array<{ x: number; y: number }> = []

  if (horizontal) {
    const rowStep = rowHeight + itemGap
    const topY = options.title.visible && options.title.text ? 46 : 22
    const firstRowY = isBottom ? height - 18 - (rows.length - 1) * rowStep : topY

    rows.forEach((row, rowIndex) => {
      let cursorX = isRight ? width - p.right - rightHeaderInset - row.width : p.left + headerInset
      const cursorY = firstRowY + rowIndex * rowStep
      row.items.forEach((item) => {
        positions[item.index] = { x: cursorX, y: cursorY }
        cursorX += item.width + itemGap
      })
    })
  } else {
    const cursorX = isRight ? width - p.right : p.left
    let cursorY = isBottom ? height - 18 : 22
    itemWidths.forEach((_itemWidth, index) => {
      positions[index] = { x: cursorX, y: cursorY }
      cursorY += rowHeight + itemGap
    })
  }

  legendSeries.forEach(({ key, series: s, visible }, index) => {
    const color = s.style?.color || options.line.color
    const lineWidth = s.style?.lineWidth ?? options.line.width
    const lineStyle = s.style?.lineStyle || options.line.style
    const label = labels[index]
    const fittedLabel = fittedLabels[index]
    const estimatedWidth = itemWidths[index]
    const position = positions[index]
    const item = group
      .append('g')
      .attr('class', 'waveform-legend-item')
      .attr('data-series-key', key)
      .attr('transform', `translate(${position.x},${position.y})`)
      .attr('role', 'button')
      .attr('tabindex', 0)
      .attr('aria-label', label)
      .attr('aria-pressed', visible ? 'true' : 'false')
      .style('cursor', 'pointer')
      .style('outline', 'none')
      .on('click', () => onToggle(key))
      .on('keydown', (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onToggle(key)
      })

    item
      .append('rect')
      .attr('x', -4)
      .attr('y', -rowHeight + 4)
      .attr('width', estimatedWidth + 8)
      .attr('height', rowHeight)
      .attr('fill', 'transparent')

    if (fittedLabel.truncated) item.append('title').text(label)

    item
      .append('line')
      .attr('x1', 0)
      .attr('x2', lineLength)
      .attr('y1', -4)
      .attr('y2', -4)
      .attr('stroke', color)
      .attr('stroke-width', lineWidth)
      .attr('stroke-dasharray', dashFor(lineStyle))
      .attr('opacity', visible ? 1 : 0.35)

    item
      .append('text')
      .attr('x', lineLength + 8)
      .attr('fill', options.legend.color)
      .attr('font-size', options.legend.fontSize)
      .attr('opacity', visible ? 1 : 0.35)
      .text(fittedLabel.text)
  })
}
