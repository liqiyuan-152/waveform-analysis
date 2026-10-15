import { describe, expect, it, vi } from 'vitest'
import { ChartEventEmitter } from '@/chart/ChartEventEmitter'
import { ChartResources } from '@/chart/ChartResources'

describe('instance event and resource ownership', () => {
  it('preserves tuples, de-duplicates, and protects new subscriptions from old handles', () => {
    const events = new ChartEventEmitter()
    const handler = vi.fn()
    const cancel = events.on('page-change', handler)
    events.on('page-change', handler)
    events.emit('page-change', 2, 5)
    expect(handler).toHaveBeenCalledExactlyOnceWith(2, 5)
    events.off('page-change', handler)
    events.on('page-change', handler)
    cancel()
    events.emit('page-change', 3, 5)
    expect(handler).toHaveBeenCalledTimes(2)
    events.off('page-change')
    events.emit('page-change', 4, 5)
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('takes a dispatch snapshot, isolates errors, and stops on disposal', () => {
    const report = vi.fn()
    const events = new ChartEventEmitter(report)
    const late = vi.fn()
    const second = vi.fn()
    const error = new Error('host callback')
    events.on('page-change', () => {
      events.off('page-change', second)
      events.on('page-change', late)
      throw error
    })
    events.on('page-change', second)
    events.emit('page-change', 1, 3)
    expect(second).toHaveBeenCalledOnce()
    expect(late).not.toHaveBeenCalled()
    expect(report).toHaveBeenCalledWith(error)
    events.off('page-change')
    events.on('page-change', () => events.dispose())
    events.on('page-change', late)
    events.emit('page-change', 1, 3)
    expect(late).not.toHaveBeenCalled()
    expect(() => events.on('page-change', late)).toThrow('disposed')
    expect(() => events.off('page-change')).not.toThrow()
  })

  it('attempts every cleanup in reverse order even after failures, exactly once', () => {
    const report = vi.fn()
    const resources = new ChartResources(report)
    const first = vi.fn()
    const last = vi.fn()
    resources.add(first)
    resources.add(() => {
      throw new Error('failed cleanup')
    })
    resources.add(last)
    resources.dispose()
    resources.dispose()
    expect(first).toHaveBeenCalledOnce()
    expect(last).toHaveBeenCalledOnce()
    expect(report).toHaveBeenCalledOnce()
    expect(last.mock.invocationCallOrder[0]).toBeLessThan(first.mock.invocationCallOrder[0]!)
    const addedAfter = vi.fn()
    resources.add(addedAfter)
    expect(addedAfter).toHaveBeenCalledOnce()
  })

  it('allows a callback to update state and dispatch another event with its own snapshot', () => {
    const events = new ChartEventEmitter()
    const received: number[] = []
    events.on('rendered', ({ revision }) => {
      if (revision === 1) events.emit('rendered', { revision: 2 })
    })
    events.on('rendered', ({ revision }) => received.push(revision))
    events.emit('rendered', { revision: 1 })
    expect(received).toEqual([2, 1])
  })
})
