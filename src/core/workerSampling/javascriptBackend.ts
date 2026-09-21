import { sampleWaveformReferenceValues } from '../samplingReferenceValues'
import type { WorkerSamplingBackend, WorkerSamplingBackendRequest } from './protocol'

/** The phase 3 fallback backend. A future WASM backend implements the same narrow interface. */
export const javascriptSamplingBackend: WorkerSamplingBackend = {
  kind: 'javascript',
  sample(request: WorkerSamplingBackendRequest) {
    return sampleWaveformReferenceValues(
      request.x,
      request.y,
      request.strategy,
      request.targetPointCount,
    )
  },
}
