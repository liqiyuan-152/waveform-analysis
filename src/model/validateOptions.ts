import { WaveformChartError } from '../chart/WaveformChartError'
import type { WaveformChartOptionUpdate } from '../types/options'

const enumFields: Record<string, readonly string[]> = {
  displayMode: ['independent', 'separated', 'compact'],
  overlayMode: ['single-axis', 'multi-axis'],
  interactionMode: ['zoom', 'annotation', 'pan', 'none'],
  timeUnit: ['s', 'ms'],
  layoutPreset: ['default', 'edge-compact'],
  unitDisplayMode: ['axis', 'legend-single-series', 'channel-label', 'channel-label-or-legend'],
}
const booleanFields = new Set([
  'animationEnabled',
  'showTooltip',
  'zoomable',
  'integerZoom',
  'pannable',
  'annotationsVisible',
  'cleanView',
  'presentationMode',
])
const numericFields = new Set([
  'width',
  'height',
  'minZoomSpan',
  'minVisiblePoints',
  'animationThreshold',
])
const stringFields = new Set(['xLabel', 'yLabel', 'lineColor'])
const objectFields = new Set([
  'animation',
  'animationUpdate',
  'animationAnnotation',
  'xDomainStrategy',
  'amplitudeLimits',
  'frameNumbers',
  'frameStyle',
  'axes',
  'grid',
  'rendering',
  'plotMargin',
  'title',
  'legend',
  'zeroLine',
])

function invalid(field: string): never {
  throw new WaveformChartError('invalid-option', `Invalid ${field}`, field)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isDomain(value: unknown) {
  return Array.isArray(value) && value.length === 2 && value.every(Number.isFinite)
}

function isFloatingStorage(value: unknown, xCoordinates = false) {
  if (!ArrayBuffer.isView(value)) return false
  // instanceof rejects valid numeric storage created in another window.
  const tag = Object.prototype.toString.call(value)
  return tag === '[object Float64Array]' || (!xCoordinates && tag === '[object Float32Array]')
}

/** Validate structure only: non-finite points, invalid rates and typed lengths remain tolerable. */
function validateData(value: unknown, field: string, allowSeries = true) {
  if (!isRecord(value)) invalid(field)
  switch (value.kind) {
    case 'points':
      if (!Array.isArray(value.points) || !value.points.every(isRecord)) invalid(field)
      break
    case 'samples':
      if (!Array.isArray(value.values) || typeof value.sampleRate !== 'number') invalid(field)
      if (value.startTime !== undefined && typeof value.startTime !== 'number') invalid(field)
      break
    case 'typed-samples':
      if (!isFloatingStorage(value.values) || typeof value.sampleRate !== 'number') invalid(field)
      if (value.startTime !== undefined && typeof value.startTime !== 'number') invalid(field)
      break
    case 'typed-points':
      if (!isFloatingStorage(value.x, true) || !isFloatingStorage(value.y)) invalid(field)
      for (const key of ['error', 'lowerError', 'upperError'])
        if (value[key] !== undefined && !isFloatingStorage(value[key])) invalid(field)
      break
    case 'series':
      if (!allowSeries || !Array.isArray(value.series)) invalid(field)
      for (const series of value.series) {
        if (!isRecord(series) || typeof series.name !== 'string') invalid(field)
        for (const key of ['id', 'trackId', 'shotNo'])
          if (series[key] !== undefined && typeof series[key] !== 'string') invalid(field)
        validateData(series.data, field, false)
      }
      break
    default:
      invalid(field)
  }
}

export function validateOptions(patch: WaveformChartOptionUpdate) {
  if (!isRecord(patch)) invalid('options')
  for (const [field, value] of Object.entries(patch)) {
    if (field === 'data') {
      validateData(value, field)
      continue
    }
    if (value === undefined) continue
    if (
      field === 'pointSize' &&
      (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
    )
      invalid(field)
    const choices = enumFields[field]
    if (choices && (typeof value !== 'string' || !choices.includes(value))) invalid(field)
    if (booleanFields.has(field) && typeof value !== 'boolean') invalid(field)
    if (numericFields.has(field) && (typeof value !== 'number' || !Number.isFinite(value)))
      invalid(field)
    if (stringFields.has(field) && typeof value !== 'string') invalid(field)
    if (objectFields.has(field) && !isRecord(value)) invalid(field)
    if (['initialXDomain', 'panXDomain', 'yDomain'].includes(field) && !isDomain(value))
      invalid(field)
    if (['initialXDomains', 'yDomains'].includes(field)) {
      if (!isRecord(value) || !Object.values(value).every(isDomain)) invalid(field)
    }
    if (['hiddenSeriesIds', 'defaultHiddenSeriesIds'].includes(field)) {
      if (!Array.isArray(value) || !value.every((id) => typeof id === 'string')) invalid(field)
    }
    if (field === 'annotations' && (!Array.isArray(value) || !value.every(isRecord))) invalid(field)
    if (
      field === 'maxZoomScale' &&
      value !== null &&
      (typeof value !== 'number' || !Number.isFinite(value))
    )
      invalid(field)
    if (field === 'frameNumber' && typeof value !== 'string' && typeof value !== 'number')
      invalid(field)
    if (field === 'toolbar' && typeof value !== 'boolean' && !isRecord(value)) invalid(field)
  }
  // Guard values that are directly called/read rather than normalized by existing algorithms.
  if (patch.title && typeof patch.title.text !== 'string') invalid('title')
  if (
    patch.axes?.x?.labelFormatter !== undefined &&
    typeof patch.axes.x.labelFormatter !== 'function'
  )
    invalid('axes')
}
