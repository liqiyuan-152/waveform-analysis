import { WorkerSamplingClient } from '@/sampling/WorkerSamplingClient'
import { WorkerSamplingRepository } from '@/core/workerSampling'
import type { WorkerSamplingRequest, WorkerSamplingResponse } from '@/core/workerSampling'
import { scaleLinear } from 'd3'
import { seriesGeometry } from '@/rendering/geometry/seriesGeometry'
import type { TrackLayout, TrackSeriesPath } from '@/components/core/types'

function heap() {
  return (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
    ?.usedJSHeapSize
}

class AcknowledgingWorker {
  static latest: AcknowledgingWorker
  onmessage: ((event: { data: WorkerSamplingResponse }) => void) | null = null
  onerror: ((event: { message: string }) => void) | null = null
  onmessageerror: (() => void) | null = null
  constructor() {
    AcknowledgingWorker.latest = this
  }
  postMessage(request: WorkerSamplingRequest) {
    if (request.type === 'register-dataset' || request.type === 'replace-dataset')
      this.onmessage?.({
        data: {
          type: 'dataset-response',
          datasetId: request.datasetId,
          requestId: request.requestId,
          revision: request.type === 'register-dataset' ? 1 : request.revision + 1,
          status: 'ok',
        },
      })
  }
  terminate() {}
}

export async function recovery() {
  const rows = []
  for (const revision of [1, 1000]) {
    const samples = []
    for (let run = -5; run < 5; run++) {
      const client = new WorkerSamplingClient({
        Worker: AcknowledgingWorker as unknown as typeof Worker,
      })
      const values = Float64Array.from({ length: 100_000 }, (_, i) => Math.sin(i))
      const dataset = { kind: 'samples' as const, values, sampleRate: 1000, startTime: 0 }
      await client.send({
        type: 'register-dataset',
        requestId: 1,
        datasetId: 'a',
        revision: 0,
        dataset,
      })
      for (let i = 1; i < revision; i++)
        await client.send({
          type: 'replace-dataset',
          requestId: i + 1,
          datasetId: 'a',
          revision: i,
          dataset,
        })
      const original = WorkerSamplingRepository.prototype.restoreDataset
      let preparations = 0
      WorkerSamplingRepository.prototype.restoreDataset = function (...args) {
        preparations++
        return original.apply(this, args)
      }
      try {
        const beforeHeap = heap(),
          start = performance.now()
        const fault = AcknowledgingWorker.latest.onerror!
        fault({ message: 'measured fault' })
        const durationMs = performance.now() - start,
          afterHeap = heap()
        fault({ message: 'duplicate fault' })
        const metrics = await client.send({
          type: 'get-dataset-metrics',
          datasetId: 'a',
          revision,
          requestId: 2000,
        })
        const next = await client.send({
          type: 'replace-dataset',
          datasetId: 'a',
          revision,
          requestId: 2001,
          dataset,
        })
        if (
          metrics.type !== 'dataset-response' ||
          metrics.status !== 'ok' ||
          next.type !== 'dataset-response' ||
          next.revision !== revision + 1 ||
          preparations !== 1
        )
          throw new Error('Recovery version or preparation count mismatch')
        if (run >= 0)
          samples.push({
            durationMs,
            preparations,
            beforeHeap,
            afterHeap,
            postRecoveryRevision: next.revision,
          })
      } finally {
        WorkerSamplingRepository.prototype.restoreDataset = original
        client.dispose()
      }
    }
    rows.push({ revision, points: 100_000, samples })
  }
  return rows
}

export async function transport() {
  const rows = []
  for (const count of [100_000, 1_000_000]) {
    const consumer = Float64Array.from({ length: count }, (_, i) => i)
    const privateSource = consumer.slice()
    for (const transfer of [false, true]) {
      const worker = new Worker(new URL('./transfer-probe.ts', import.meta.url), { type: 'module' })
      const samples = []
      try {
        for (let run = -5; run < 5; run++) {
          const beforeHeap = heap(),
            start = performance.now()
          // This snapshot must remain available to the local recovery repository.
          const fallbackSnapshot = privateSource.slice()
          const outgoing = transfer ? fallbackSnapshot.slice() : fallbackSnapshot
          const response = new Promise<number>((resolve, reject) => {
            worker.onmessage = (event: MessageEvent<number>) => resolve(event.data)
            worker.onerror = (event) => reject(new Error(event.message))
          })
          const postStart = performance.now()
          worker.postMessage(outgoing, transfer ? [outgoing.buffer] : [])
          const postMs = performance.now() - postStart
          const checksum = await response
          if (
            checksum !== count - 1 ||
            consumer.byteLength !== count * 8 ||
            fallbackSnapshot.byteLength !== count * 8
          )
            throw new Error('Transfer candidate detached input/fallback or changed output')
          if (run >= 0)
            samples.push({
              totalMs: performance.now() - start,
              postMs,
              beforeHeap,
              afterHeap: heap(),
              consumerBytes: consumer.byteLength,
              fallbackBytes: fallbackSnapshot.byteLength,
              outgoingDetached: outgoing.byteLength === 0,
            })
        }
      } finally {
        worker.terminate()
      }
      rows.push({ count, transfer, samples })
    }
  }
  return rows
}

export function geometryCandidate() {
  const points = Array.from({ length: 1200 }, (_, i) => ({ x: i, y: Math.sin(i), error: 0.2 }))
  const track = { xScale: scaleLinear().domain([0, 1200]).range([0, 1200]) } as TrackLayout
  const path = {
    series: { pointType: 'circle', errorBar: { capWidth: 4 } },
    pointRenderPoints: points,
    errorBarRenderPoints: points,
    yScale: scaleLinear().domain([-2, 2]).range([400, 0]),
  } as TrackSeriesPath
  const rows = []
  for (const animation of [false, true])
    for (const cached of [false, true]) {
      const samples = []
      for (let run = -5; run < 5; run++) {
        let previousPoints: typeof points | undefined
        let previousGeometry: ReturnType<typeof seriesGeometry> | undefined
        let encodings = 0,
          bytes = 0
        const start = performance.now()
        for (let i = 0; i < 100; i++) {
          // Probe fresh frame collections, including generation cost in both candidates.
          // Production can also mutate projection buffers in place: identity alone is unsafe.
          // This experiment caches only the last geometry; it is not a production cache.
          const current = animation ? points.map((p) => ({ ...p, y: p.y + i / 100 })) : points
          const next = { ...path, pointRenderPoints: current, errorBarRenderPoints: current }
          if (!cached || previousPoints !== current) {
            previousGeometry = seriesGeometry(next, track)
            previousPoints = current
            encodings++
          }
          bytes +=
            (previousGeometry!.pointPath?.length ?? 0) +
            (previousGeometry!.errorBarPath?.length ?? 0)
        }
        if (run >= 0) samples.push({ durationMs: performance.now() - start, encodings, bytes })
      }
      rows.push({ animation, cached, samples })
    }
  return rows
}
