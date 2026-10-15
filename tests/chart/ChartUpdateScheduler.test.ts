import { describe, expect, it, vi } from 'vitest'
import { ChartEventEmitter } from '@/chart/ChartEventEmitter'
import { ChartUpdateScheduler, type ChartUpdatePhases } from '@/chart/ChartUpdateScheduler'

function harness(withMicrotasks = false) {
  let sequence = 0
  const callbacks = new Map<number, () => void>()
  const microtasks: (() => void)[] = []
  const phases: ChartUpdatePhases = {
    data: vi.fn(),
    layout: vi.fn(),
    sampling: vi.fn(),
    view: vi.fn(() => true),
    isStable: vi.fn(() => true),
  }
  const events = new ChartEventEmitter()
  const scheduler = new ChartUpdateScheduler(
    {
      request: (callback) => {
        callbacks.set(++sequence, callback)
        return sequence
      },
      cancel: (id) => callbacks.delete(id),
      microtask: withMicrotasks ? (callback) => microtasks.push(callback) : undefined,
    },
    phases,
    events,
  )
  function frame() {
    const queued = Array.from(callbacks.values())
    callbacks.clear()
    queued.forEach((callback) => callback())
  }
  const microtask = () => microtasks.splice(0).forEach((callback) => callback())
  return { scheduler, phases, events, callbacks, frame, microtask }
}

describe('native update scheduling', () => {
  it('coalesces settled sampling in a microtask and cancels the redundant frame', () => {
    const { scheduler, events, callbacks, microtask } = harness(true)
    const rendered = vi.fn()
    const finished = vi.fn()
    events.on('rendered', rendered)
    events.on('finished', finished)
    scheduler.invalidate('data')
    scheduler.refresh('layout', true)
    scheduler.refresh('layout', true)
    expect(rendered).not.toHaveBeenCalled()
    expect(callbacks.size).toBe(1)
    microtask()
    expect(callbacks.size).toBe(0)
    expect(rendered).toHaveBeenCalledExactlyOnceWith({ revision: 1 })
    expect(finished).toHaveBeenCalledExactlyOnceWith({ revision: 1 })
  })

  it('keeps animation/font work on frames and ignores queued microtasks after disposal', () => {
    const { scheduler, phases, events, callbacks, microtask, frame } = harness(true)
    const rendered = vi.fn()
    events.on('rendered', rendered)
    phases.isStable = () => false
    scheduler.invalidate('data')
    scheduler.refresh('layout', true)
    microtask()
    expect(callbacks.size).toBe(1)
    expect(rendered).not.toHaveBeenCalled()
    frame()
    expect(rendered).toHaveBeenCalledOnce()
    phases.isStable = () => true
    scheduler.refresh('layout', true)
    scheduler.dispose()
    microtask()
    expect(callbacks.size).toBe(0)
    expect(rendered).toHaveBeenCalledOnce()
  })

  it('notifies export barriers after the flush releases its running flag and cleans subscriptions', () => {
    const { scheduler, phases, frame } = harness()
    const observed: boolean[] = []
    const cancel = scheduler.onFrameSettled(() => observed.push(scheduler.isStable()))
    phases.isStable = () => false
    scheduler.invalidate('layout')
    frame()
    phases.isStable = () => true
    scheduler.refresh()
    frame()
    expect(observed).toEqual([false, true])
    cancel()
    scheduler.refresh()
    frame()
    expect(observed).toHaveLength(2)
    scheduler.dispose()
    scheduler.onFrameSettled(() => observed.push(true))
    scheduler.refresh()
    frame()
    expect(observed).toHaveLength(2)
  })

  it('defers new barrier subscribers and skips subscribers cancelled during notification', () => {
    const { scheduler, frame } = harness()
    const added = vi.fn()
    const cancelled = vi.fn()
    let removeCancelled = () => {}
    const cancel = scheduler.onFrameSettled(() => {
      scheduler.onFrameSettled(added)
      removeCancelled()
    })
    removeCancelled = scheduler.onFrameSettled(cancelled)
    scheduler.invalidate('view')
    frame()
    expect(added).not.toHaveBeenCalled()
    expect(cancelled).not.toHaveBeenCalled()
    cancel()
    scheduler.refresh()
    frame()
    expect(added).toHaveBeenCalledOnce()
  })

  it('merges changes in stage order and finishes each effective revision once', () => {
    const { scheduler, phases, events, callbacks, frame } = harness()
    const order: string[] = []
    for (const stage of ['data', 'layout', 'sampling'] as const)
      phases[stage] = () => order.push(stage)
    phases.view = () => {
      order.push('view')
      return true
    }
    const rendered = vi.fn()
    const finished = vi.fn()
    events.on('rendered', rendered)
    events.on('finished', finished)
    scheduler.invalidate('data')
    scheduler.invalidate('layout')
    scheduler.invalidate('view')
    expect(callbacks.size).toBe(1)
    expect(scheduler.isStable()).toBe(false)
    frame()
    expect(order).toEqual(['data', 'layout', 'sampling', 'view'])
    expect(rendered).toHaveBeenCalledExactlyOnceWith({ revision: 3 })
    expect(finished).toHaveBeenCalledExactlyOnceWith({ revision: 3 })
    expect(scheduler.isStable()).toBe(true)
    scheduler.refresh()
    frame()
    expect(rendered).toHaveBeenCalledTimes(2)
    expect(finished).toHaveBeenCalledOnce()
  })

  it('defers reentrant updates and never finishes the superseded rendered revision', () => {
    const { scheduler, events, callbacks, frame } = harness()
    const finished = vi.fn()
    const revisions: number[] = []
    events.on('rendered', ({ revision }) => {
      revisions.push(revision)
      if (revision === 1) scheduler.invalidate('layout')
    })
    events.on('finished', finished)
    scheduler.invalidate('data')
    frame()
    expect(revisions).toEqual([1])
    expect(finished).not.toHaveBeenCalled()
    expect(callbacks.size).toBe(1)
    frame()
    expect(revisions).toEqual([1, 2])
    expect(finished).toHaveBeenCalledExactlyOnceWith({ revision: 2 })
  })

  it('pauses zero-size completion and waits for sampling/animation stability', () => {
    const { scheduler, phases, events, frame } = harness()
    const rendered = vi.fn()
    const finished = vi.fn()
    events.on('rendered', rendered)
    events.on('finished', finished)
    phases.view = () => false
    scheduler.invalidate('layout')
    frame()
    expect(rendered).not.toHaveBeenCalled()
    expect(finished).not.toHaveBeenCalled()
    expect(scheduler.isStable()).toBe(false)
    phases.view = () => true
    phases.isStable = () => false
    scheduler.refresh('layout')
    frame()
    expect(rendered).toHaveBeenCalledOnce()
    expect(finished).not.toHaveBeenCalled()
    phases.isStable = () => true
    scheduler.refresh()
    frame()
    expect(finished).toHaveBeenCalledExactlyOnceWith({ revision: 1 })
  })

  it('cancels queued work and stops notifications when disposed by a listener', () => {
    const { scheduler, events, callbacks, frame } = harness()
    const finished = vi.fn()
    events.on('rendered', () => scheduler.dispose())
    events.on('finished', finished)
    scheduler.invalidate('view')
    frame()
    expect(finished).not.toHaveBeenCalled()
    scheduler.invalidate('data')
    expect(callbacks.size).toBe(0)
    expect(scheduler.isStable()).toBe(false)
  })
})
