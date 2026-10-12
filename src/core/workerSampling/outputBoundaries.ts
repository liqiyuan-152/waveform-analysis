import type { WaveformPointRange } from '../waveformPointSource'
import type { WorkerSamplingOutput } from './protocol'
import { datasetLength, datasetXAt, type StoredDataset } from './repositoryDataset'

export function addOutputBoundaries(
  output: WorkerSamplingOutput,
  range: WaveformPointRange,
  dataset: StoredDataset,
): WorkerSamplingOutput {
  const length = datasetLength(dataset)
  if (range.start === range.end && (range.start === 0 || range.end === length)) return output
  const prefix = range.start > 0 ? [range.start - 1] : []
  const suffix = range.end < length ? [range.end] : []
  if (output.kind === 'source-indexes') {
    const values = Array.from(output.sourceIndexes)
    return {
      kind: 'source-indexes',
      sourceIndexes: Uint32Array.from([...prefix, ...values, ...suffix]),
    }
  }
  const x = Array.from(output.x)
  const y = Array.from(output.y)
  if (prefix.length) {
    x.unshift(datasetXAt(dataset, prefix[0]!))
    y.unshift(dataset.y[prefix[0]!]!)
  }
  if (suffix.length) {
    x.push(datasetXAt(dataset, suffix[0]!))
    y.push(dataset.y[suffix[0]!]!)
  }
  return { kind: 'aggregates', x: Float64Array.from(x), y: Float64Array.from(y) }
}
