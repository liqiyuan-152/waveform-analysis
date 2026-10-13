import { describe, expect, it } from 'vitest'
import { Animator, WaveformAnimationController } from '@/index'
import { createAnimationTestScheduler } from '@tests/support/animationScheduler'

describe.each(['manager', 'controller'] as const)('terminal %s handles', (owner) => {
  it.each(['finish', 'abort', 'natural', 'replace', 'synchronous'] as const)(
    'keeps its %s state without rescheduling a live peer',
    (termination) => {
      const fake = createAnimationTestScheduler()
      const animator = new Animator(fake.scheduler)
      const controller = new WaveformAnimationController({ animator, commitFinalState: () => {} })
      const key = { kind: 'custom', id: 'old', scope: 'update' } as const
      const register = (duration: number) =>
        owner === 'manager'
          ? animator.animate({ duration, force: true }, 'old')
          : controller.animate(key, { duration, force: true })
      const handle = register(termination === 'synchronous' ? 0 : 100)
      const id = handle.id
      if (termination === 'finish') handle.finish()
      if (termination === 'abort') handle.abort()
      if (termination === 'natural') {
        fake.advance(100)
        fake.flushFrame()
      }
      if (termination === 'replace') register(0)
      const state = termination === 'abort' || termination === 'replace' ? 'ABORTED' : 'FINISHED'
      expect(handle.state).toBe(state)
      const peer = animator.animate({ duration: 1000, force: true }, 'peer')
      const requested = fake.requestedFrames
      const cancelled = fake.cancelledFrames
      handle.pause()
      handle.resume()
      handle.finish()
      handle.abort()
      expect(handle.id).toBe(id)
      expect(handle.state).toBe(state)
      expect(fake.requestedFrames).toBe(requested)
      expect(fake.cancelledFrames).toBe(cancelled)
      expect(animator.getAnimationCount()).toBe(1)
      peer.finish()
      expect(peer.state).toBe('FINISHED')
      expect(fake.pendingFrames).toBe(0)
    },
  )
})
