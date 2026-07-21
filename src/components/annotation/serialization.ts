import type { WaveformAnnotation, WaveformAnnotationStyle } from '../../types'
import { ANNOTATION_MAX_TEXT_LENGTH } from './markup'

const ANNOTATION_FILE_VERSION = 1

type JsonRecord = Record<string, unknown>

function fail(message: string): never {
  throw new TypeError(`Invalid waveform annotation file: ${message}`)
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(record: JsonRecord, key: string, path: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${path}.${key} must be a non-empty string`)
  }
  return value
}

function optionalString(record: JsonRecord, key: string, path: string): string | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string') fail(`${path}.${key} must be a string`)
  return value
}

function requiredFiniteNumber(record: JsonRecord, key: string, path: string): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${path}.${key} must be a finite number`)
  }
  return value
}

function optionalFiniteNumber(record: JsonRecord, key: string, path: string): number | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${path}.${key} must be a finite number`)
  }
  return value
}

function parseStyle(value: unknown, path: string): WaveformAnnotationStyle | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) fail(`${path} must be an object`)

  const borderColor = optionalString(value, 'borderColor', path)
  const textColor = optionalString(value, 'textColor', path)
  const backgroundColor = optionalString(value, 'backgroundColor', path)

  return {
    ...(borderColor !== undefined && { borderColor }),
    ...(textColor !== undefined && { textColor }),
    ...(backgroundColor !== undefined && { backgroundColor }),
  }
}

function parseAnnotation(value: unknown, index: number): WaveformAnnotation {
  const path = `annotations[${index}]`
  if (!isRecord(value)) fail(`${path} must be an object`)

  const text = requiredString(value, 'text', path)
  if (text.length > ANNOTATION_MAX_TEXT_LENGTH) {
    fail(`${path}.text must not exceed ${ANNOTATION_MAX_TEXT_LENGTH} characters`)
  }

  const labelOffsetX = optionalFiniteNumber(value, 'labelOffsetX', path)
  const labelOffsetY = optionalFiniteNumber(value, 'labelOffsetY', path)
  const createdAt = optionalString(value, 'createdAt', path)
  const style = parseStyle(value.style, `${path}.style`)

  return {
    id: requiredString(value, 'id', path),
    seriesId: requiredString(value, 'seriesId', path),
    x: requiredFiniteNumber(value, 'x', path),
    y: requiredFiniteNumber(value, 'y', path),
    text,
    ...(labelOffsetX !== undefined && { labelOffsetX }),
    ...(labelOffsetY !== undefined && { labelOffsetY }),
    ...(style !== undefined && { style }),
    ...(createdAt !== undefined && { createdAt }),
  }
}

function normalizeAnnotations(values: readonly unknown[]): WaveformAnnotation[] {
  const annotations = values.map(parseAnnotation)
  const ids = new Set<string>()
  annotations.forEach((annotation, index) => {
    if (ids.has(annotation.id)) fail(`annotations[${index}].id must be unique`)
    ids.add(annotation.id)
  })
  return annotations
}

/** Serialize annotations to the versioned waveform annotation JSON format. */
export function serializeWaveformAnnotations(annotations: readonly WaveformAnnotation[]): string {
  return JSON.stringify(
    { version: ANNOTATION_FILE_VERSION, annotations: normalizeAnnotations(annotations) },
    null,
    2,
  )
}

/** Parse and validate a versioned waveform annotation JSON document. */
export function parseWaveformAnnotations(json: string): WaveformAnnotation[] {
  if (typeof json !== 'string') fail('input must be a JSON string')

  let document: unknown
  try {
    document = JSON.parse(json)
  } catch {
    fail('input is not valid JSON')
  }

  if (!isRecord(document)) fail('root must be an object')
  if (document.version !== ANNOTATION_FILE_VERSION) {
    fail(`version must be ${ANNOTATION_FILE_VERSION}`)
  }
  if (!Array.isArray(document.annotations)) fail('annotations must be an array')

  return normalizeAnnotations(document.annotations)
}
