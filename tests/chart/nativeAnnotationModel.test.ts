import { describe, expect, it, vi } from 'vitest'
import { AnnotationModel } from '@/annotation/AnnotationModel'
import { ChartEventEmitter } from '@/chart/ChartEventEmitter'
import type { WaveformAnnotation } from '@/types/chart'
import { serializeWaveformAnnotations, parseWaveformAnnotations } from '@/annotation/serialization'
import * as legacySerialization from '@/components/annotation/serialization'

const original: WaveformAnnotation = {
  id: 'a',
  seriesId: 's',
  x: 0.25,
  y: 2,
  text: '原标注',
  style: { borderColor: '#123456', backgroundColor: 'rgba(1, 2, 3, 0.5)' },
}
function setup() {
  let annotations = [structuredClone(original)]
  const events = new ChartEventEmitter()
  let alive = true
  const model = new AnnotationModel(
    () => annotations,
    events,
    () => alive,
  )
  return {
    model,
    events,
    read: () => annotations,
    acknowledge: (next: WaveformAnnotation[]) => {
      annotations = next
    },
    dispose: () => {
      alive = false
      events.dispose()
    },
  }
}

describe('native controlled annotation model', () => {
  it('requests create/update/delete without changing the controlled source', () => {
    const { model, events, read } = setup()
    const request = vi.fn(),
      create = vi.fn(),
      update = vi.fn(),
      remove = vi.fn()
    events.on('update:annotations', request)
    events.on('annotation-create', create)
    events.on('annotation-update', update)
    events.on('annotation-delete', remove)
    const annotation = { ...original, id: 'b' }
    expect(model.create(annotation)).toBe(true)
    expect(request).toHaveBeenLastCalledWith([original, annotation])
    expect(create).toHaveBeenLastCalledWith(annotation)
    expect(model.update({ ...original, text: '修改' })).toBe(true)
    expect(update).toHaveBeenLastCalledWith({ ...original, text: '修改' }, original)
    expect(model.delete('a')).toBe(true)
    expect(request).toHaveBeenLastCalledWith([])
    expect(remove).toHaveBeenLastCalledWith(original)
    expect(read()).toEqual([original])
  })

  it('supports synchronous acknowledgement and preserves event order/previous snapshots', () => {
    const { model, events, read, acknowledge } = setup()
    const order: string[] = []
    events.on('update:annotations', (annotations) => {
      order.push('request')
      acknowledge(annotations)
    })
    events.on('annotation-update', (annotation, previous) => {
      order.push('update')
      expect(previous).toEqual(original)
      expect(annotation.text).toBe('修改')
      previous.style!.borderColor = 'mutated'
    })
    model.update({ ...original, text: '修改' })
    expect(order).toEqual(['request', 'update'])
    expect(read()[0]).toEqual({ ...original, text: '修改' })
  })

  it('isolates all replacement objects/styles from consumers and subsequent business events', () => {
    const { model, events, read } = setup()
    Object.freeze(read()[0]!.style)
    Object.freeze(read()[0])
    Object.freeze(read())
    const create = vi.fn()
    events.on('annotation-create', create)
    events.on('update:annotations', (annotations) => {
      annotations[0]!.style!.borderColor = 'changed'
      annotations.at(-1)!.text = 'changed'
      annotations.length = 0
    })
    const input = { ...original, id: 'new', style: { ...original.style } }
    model.create(input)
    expect(create).toHaveBeenCalledWith(input)
    expect(read()).toEqual([original])
    const snapshot = model.snapshot()
    snapshot[0]!.style!.borderColor = 'changed'
    expect(model.find('a')).toEqual(original)
  })

  it('moves only label offsets through replacement arrays, without an annotation-update event', () => {
    const { model, events, read } = setup()
    const request = vi.fn(),
      update = vi.fn()
    events.on('update:annotations', request)
    events.on('annotation-update', update)
    expect(model.move('a', 20, -10)).toBe(true)
    expect(request).toHaveBeenCalledWith([{ ...original, labelOffsetX: 20, labelOffsetY: -10 }])
    expect(update).not.toHaveBeenCalled()
    expect(read()).toEqual([original])
  })

  it('drops stale/invalid/duplicate requests without business events', () => {
    const { model, events } = setup()
    const request = vi.fn()
    events.on('update:annotations', request)
    expect(model.create(original)).toBe(false)
    expect(model.create({ ...original, id: 'new', text: ' ' })).toBe(false)
    expect(model.create({ ...original, id: 'new', text: 'x'.repeat(41) })).toBe(false)
    expect(model.update({ ...original, x: NaN })).toBe(false)
    expect(model.update({ ...original, id: 'removed' })).toBe(false)
    expect(model.delete('removed')).toBe(false)
    expect(model.move('removed', 1, 2)).toBe(false)
    expect(model.move('a', Infinity, 2)).toBe(false)
    expect(request).not.toHaveBeenCalled()
  })

  it.each(['create', 'update', 'delete'] as const)(
    'stops %s business notification when the host disposes inside the replacement callback',
    (operation) => {
      const { model, events, dispose } = setup()
      const business = vi.fn()
      events.on(`annotation-${operation}`, business)
      events.on('update:annotations', dispose)
      if (operation === 'create') model.create({ ...original, id: 'b' })
      if (operation === 'update') model.update({ ...original, text: 'new' })
      if (operation === 'delete') model.delete('a')
      expect(business).not.toHaveBeenCalled()
      expect(model.delete('a')).toBe(false)
    },
  )

  it('keeps legacy and native serialization function identity and seconds/alpha/offset roundtrips', () => {
    expect(legacySerialization.serializeWaveformAnnotations).toBe(serializeWaveformAnnotations)
    expect(legacySerialization.parseWaveformAnnotations).toBe(parseWaveformAnnotations)
    const annotation = { ...original, labelOffsetX: 30, labelOffsetY: -8 }
    expect(parseWaveformAnnotations(serializeWaveformAnnotations([annotation]))).toEqual([
      annotation,
    ])
  })
})
