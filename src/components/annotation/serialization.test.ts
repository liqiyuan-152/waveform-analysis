import { describe, expect, it } from 'vitest'

import type { WaveformAnnotation } from '../../types'
import { parseWaveformAnnotations, serializeWaveformAnnotations } from './serialization'

describe('waveform annotation serialization', () => {
  it('round-trips every annotation field through a versioned document', () => {
    const source: WaveformAnnotation[] = [
      {
        id: 'note-1',
        seriesId: 'channel-a',
        x: 1.25,
        y: -3.5,
        text: '峰值',
        labelOffsetX: 12,
        labelOffsetY: -8,
        createdAt: '2026-07-21T12:00:00.000Z',
        style: {
          borderColor: '#1677ff',
          textColor: '#333333',
          backgroundColor: 'rgba(255, 255, 255, 0.92)',
        },
      },
    ]
    const sourceSnapshot = JSON.parse(JSON.stringify(source))

    const parsed = parseWaveformAnnotations(serializeWaveformAnnotations(source))

    expect(JSON.parse(serializeWaveformAnnotations(source))).toMatchObject({ version: 1 })
    expect(source).toEqual(sourceSnapshot)
    expect(parsed).toEqual(source)
    expect(parsed).not.toBe(source)
    expect(parsed[0]).not.toBe(source[0])
    expect(parsed[0].style).not.toBe(source[0].style)
  })

  it('allows annotations for series that are not currently loaded', () => {
    expect(
      parseWaveformAnnotations(
        JSON.stringify({
          version: 1,
          annotations: [{ id: 'future', seriesId: 'missing', x: 1, y: 2, text: '稍后显示' }],
        }),
      ),
    ).toEqual([{ id: 'future', seriesId: 'missing', x: 1, y: 2, text: '稍后显示' }])
  })

  it.each([
    ['invalid JSON', '{'],
    ['non-object root', '[]'],
    ['unsupported version', JSON.stringify({ version: 2, annotations: [] })],
    ['missing annotation array', JSON.stringify({ version: 1 })],
    [
      'invalid annotation entry',
      JSON.stringify({ version: 1, annotations: [{ id: 'a', seriesId: 's', x: 1 }] }),
    ],
    [
      'non-finite coordinate',
      '{"version":1,"annotations":[{"id":"a","seriesId":"s","x":1e400,"y":2,"text":"a"}]}',
    ],
    [
      'overlong text',
      JSON.stringify({
        version: 1,
        annotations: [{ id: 'a', seriesId: 's', x: 1, y: 2, text: 'a'.repeat(41) }],
      }),
    ],
    [
      'duplicate IDs',
      JSON.stringify({
        version: 1,
        annotations: [
          { id: 'a', seriesId: 's', x: 1, y: 2, text: 'one' },
          { id: 'a', seriesId: 's', x: 2, y: 3, text: 'two' },
        ],
      }),
    ],
  ])('rejects %s without returning partial data', (_label, json) => {
    expect(() => parseWaveformAnnotations(json)).toThrow('Invalid waveform annotation file')
  })

  it('rejects invalid optional fields and serialization input', () => {
    expect(() =>
      parseWaveformAnnotations(
        JSON.stringify({
          version: 1,
          annotations: [
            {
              id: 'a',
              seriesId: 's',
              x: 1,
              y: 2,
              text: 'a',
              labelOffsetX: '12',
            },
          ],
        }),
      ),
    ).toThrow('labelOffsetX')

    expect(() =>
      parseWaveformAnnotations(
        JSON.stringify({
          version: 1,
          annotations: [{ id: 'a', seriesId: 's', x: 1, y: 2, text: 'a', style: [] }],
        }),
      ),
    ).toThrow('style must be an object')

    expect(() =>
      serializeWaveformAnnotations([{ id: 'a', seriesId: 's', x: Number.NaN, y: 2, text: 'a' }]),
    ).toThrow('x must be a finite number')
  })
})
