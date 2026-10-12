import { describe, expect, it, vi } from 'vitest'

import { createLatestTaskScheduler } from '@/components/core/latestTaskScheduler'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('createLatestTaskScheduler', () => {
  it('continues latest work after a rejected task without unhandled rejection', async () => {
    const onError = vi.fn()
    const scheduler = createLatestTaskScheduler(onError)
    let reject!: (error: Error) => void
    const first = new Promise<void>((_resolve, fail) => {
      reject = fail
    })
    const calls: string[] = []
    scheduler.schedule(async () => first)
    scheduler.schedule(async () => {
      calls.push('superseded')
    })
    scheduler.schedule(async () => {
      calls.push('latest')
    })
    reject(new Error('cancelled registration'))
    await vi.waitFor(() => expect(calls).toEqual(['latest']))
    expect(onError).not.toHaveBeenCalled()
    scheduler.schedule(async () => {
      throw new Error('current failure')
    })
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce())
    scheduler.dispose()
  })
  it('runs one task at a time and coalesces pending work to the latest task', async () => {
    const scheduler = createLatestTaskScheduler()
    const first = deferred()
    const calls: number[] = []

    scheduler.schedule(async (generation) => {
      calls.push(generation)
      await first.promise
    })
    scheduler.schedule(async (generation) => {
      calls.push(generation)
    })
    const latest = scheduler.schedule(async (generation) => {
      calls.push(generation)
    })

    expect(calls).toEqual([1])
    expect(scheduler.isCurrent(1)).toBe(false)
    expect(scheduler.isCurrent(latest)).toBe(true)
    first.resolve()
    await vi.waitFor(() => expect(calls).toEqual([1, 3]))
    expect(scheduler.metrics).toEqual({ scheduled: 3, coalesced: 1, maxPending: 1 })
  })

  it('invalidates running work and discards pending work on cancellation or disposal', async () => {
    const scheduler = createLatestTaskScheduler()
    const first = deferred()
    const firstGeneration = scheduler.schedule(async () => first.promise)
    scheduler.schedule(async () => undefined)

    scheduler.cancelPending()
    expect(scheduler.isCurrent(firstGeneration)).toBe(false)
    first.resolve()
    await first.promise
    scheduler.dispose()
    expect(scheduler.schedule(async () => undefined)).toBe(0)
  })
})
