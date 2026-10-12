import { createLatestTaskScheduler } from './latestTaskScheduler'
import { createWorkerSamplingClient, type WorkerSamplingClient } from './workerSamplingClient'
import type { WorkerSamplingDiagnostics } from '../../core/workerSampling'

/** Owns resources for one immutable data reference. Invalidation cancels old work before reuse. */
export function createWaveformSamplingSession() {
  const scheduler = createLatestTaskScheduler()
  const revisions = new Map<string, number>()
  const backendBySeries = new Map<string, WorkerSamplingDiagnostics['backend']>()
  const selectedModeBySeries = new Map<string, 'raw' | 'sampled'>()
  const emittedErrors = new Set<string>()
  const pendingDiagnostics = new Map<string, WorkerSamplingDiagnostics>()
  const session = {
    scheduler,
    revisions,
    backendBySeries,
    selectedModeBySeries,
    emittedErrors,
    pendingDiagnostics,
    client: undefined as WorkerSamplingClient | undefined,
    requestId: 0,
    diagnosticsTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    autoModeSettleTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    hasInitialSamplingRun: false,
    getClient() {
      return (session.client ??= createWorkerSamplingClient())
    },
    invalidate() {
      scheduler.cancelPending()
      clearTimeout(session.diagnosticsTimer)
      clearTimeout(session.autoModeSettleTimer)
      session.diagnosticsTimer = undefined
      session.autoModeSettleTimer = undefined
      session.hasInitialSamplingRun = false
      pendingDiagnostics.clear()
      revisions.clear()
      backendBySeries.clear()
      selectedModeBySeries.clear()
      emittedErrors.clear()
      session.client?.dispose()
      session.client = undefined
    },
    dispose() {
      session.invalidate()
      scheduler.dispose()
    },
  }
  return session
}
