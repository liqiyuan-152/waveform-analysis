import { afterEach, describe, expect, it, vi } from 'vitest'
import { SamplingSession } from '@/sampling/SamplingSession'

afterEach(() => vi.useRealTimers())
describe('sampling session ownership', () => {
  it('reuses an opted-in transport between generations and terminates it on disposal', () => {
    const client = {
      workerFailureReason: undefined,
      send: vi.fn(),
      reset: vi.fn(),
      dispose: vi.fn(),
    }
    const factory = vi.fn(() => client)
    const session = new SamplingSession(factory, undefined, true)
    session.getClient()
    session.revisions.set('old', 1)
    session.invalidate()
    expect(client.reset).toHaveBeenCalledOnce()
    expect(session.revisions.size).toBe(0)
    expect(session.getClient()).toBe(client)
    expect(factory).toHaveBeenCalledOnce()
    expect(client.dispose).not.toHaveBeenCalled()
    session.dispose()
    session.dispose()
    expect(client.dispose).toHaveBeenCalledOnce()
    expect(client.reset).toHaveBeenCalledOnce()
  })

  it('recreates clients that cannot reset even when reuse is requested', () => {
    const dispose = vi.fn()
    const factory = vi.fn(() => ({ workerFailureReason: undefined, send: vi.fn(), dispose }))
    const session = new SamplingSession(factory, undefined, true)
    const first = session.getClient()
    session.invalidate()
    expect(dispose).toHaveBeenCalledOnce()
    expect(session.getClient()).not.toBe(first)
    session.dispose()
  })

  it('recreates failed transports so a new data generation can recover its Worker', () => {
    const reset = vi.fn()
    const dispose = vi.fn()
    const factory = vi.fn(() => ({
      workerFailureReason: 'load failure',
      send: vi.fn(),
      reset,
      dispose,
    }))
    const session = new SamplingSession(factory, undefined, true)
    const first = session.getClient()
    session.invalidate()
    expect(reset).not.toHaveBeenCalled()
    expect(dispose).toHaveBeenCalledOnce()
    expect(session.getClient()).not.toBe(first)
    session.dispose()
  })
  it('lazily creates one client, cancels timers and all old-generation state, and rejects resurrection', () => {
    vi.useFakeTimers()
    const dispose = vi.fn()
    const factory = vi.fn(() => ({ workerFailureReason: undefined, send: vi.fn(), dispose }))
    const session = new SamplingSession(factory)
    expect(factory).not.toHaveBeenCalled()
    const client = session.getClient()
    expect(session.getClient()).toBe(client)
    session.revisions.set('d', 1)
    session.backendBySeries.set('a', 'wasm')
    session.selectedModeBySeries.set('a', 'sampled')
    session.emittedErrors.add('old')
    const fired = vi.fn()
    session.diagnosticsTimer = session.timers.setTimeout(fired, 100)
    session.autoModeSettleTimer = session.timers.setTimeout(fired, 120)
    session.invalidate()
    vi.runAllTimers()
    expect(fired).not.toHaveBeenCalled()
    expect(dispose).toHaveBeenCalledOnce()
    expect(
      session.revisions.size +
        session.backendBySeries.size +
        session.selectedModeBySeries.size +
        session.emittedErrors.size,
    ).toBe(0)
    expect(session.getClient()).not.toBe(client)
    session.dispose()
    session.dispose()
    expect(dispose).toHaveBeenCalledTimes(2)
    expect(() => session.getClient()).toThrow('disposed')
    expect(session.scheduler.schedule(async () => {})).toBe(0)
  })
})
