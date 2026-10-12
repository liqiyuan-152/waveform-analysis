import { prepareWaveformSeries } from '../src/components/core/useWaveformData'
import { createWorkerSamplingClient } from '../src/components/core/workerSamplingClient'
import type { SingleWaveformData, WaveformData } from '../src/types'

function input(kind: string, count: number, channels: number): WaveformData {
  return {
    kind: 'series',
    series: Array.from({ length: channels }, (_, channel) => {
      const y = (i: number) =>
        Math.sin(i * 0.017 + channel) + ((i * 16807) % 2147483647) / 2147483647
      const data: SingleWaveformData =
        kind === 'points'
          ? {
              kind: 'points',
              points: Array.from({ length: count }, (_, i) => ({ x: i / 1000, y: y(i) })),
            }
          : kind === 'typed-points'
            ? {
                kind: 'typed-points',
                x: Float64Array.from({ length: count }, (_, i) => i / 1000),
                y: Float32Array.from({ length: count }, (_, i) => y(i)),
              }
            : {
                kind: 'typed-samples',
                values: Float32Array.from({ length: count }, (_, i) => y(i)),
                sampleRate: 1000,
              }
      return { id: `s${channel}`, name: `Channel ${channel}`, data }
    }),
  }
}
function heap() {
  return (
    (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ??
    null
  )
}
export async function runDataSourceBaseline(onProgress: (value: unknown) => void) {
  const results = []
  for (const kind of ['points', 'typed-points', 'typed-samples'])
    for (const count of [100_000, 1_000_000])
      for (const channels of [1, 10]) {
        const rounds = []
        for (let round = 0; round < 7; round++) {
          await new Promise((resolve) => setTimeout(resolve, 50))
          const data = input(kind, count, channels)
          const memory: { at: number; heap: number | null; stage: string }[] = []
          const capture = (stage = 'interval') =>
            memory.push({ at: performance.now(), heap: heap(), stage })
          const timer = round === 6 ? setInterval(capture, 10) : undefined
          if (round === 6) capture('before-prepare')
          const start = performance.now()
          const prepared = prepareWaveformSeries(data)
          const prepareMs = performance.now() - start
          if (round === 6) capture('after-prepare')
          const client = createWorkerSamplingClient()
          let requestId = 0
          let packMs = 0
          const registrations = []
          for (const series of prepared) {
            const packingStart = performance.now()
            const dataset = series.source.toWorkerDataset()
            packMs += performance.now() - packingStart
            const sent = performance.now()
            registrations.push(
              client
                .send({
                  type: 'register-dataset',
                  requestId: ++requestId,
                  datasetId: series.id,
                  revision: 0,
                  dataset,
                })
                .then(() => performance.now() - sent),
            )
          }
          try {
            const registrationMs = await Promise.all(registrations)
            if (round === 6) capture('after-register')
            const sent = performance.now()
            const response = await client.send({
              type: 'sample-viewport',
              requestId: ++requestId,
              series: prepared.map((series) => ({
                seriesId: series.id,
                datasetId: series.id,
                revision: 1,
                xDomain: [0, (count - 1) / 1000],
                plotWidth: 1000,
                mode: 'wasm',
                strategy: 'peak',
                maxPointCount: 1000,
              })),
            })
            const samplingMs = performance.now() - sent
            if (round === 6) capture('after-sample')
            const heaps = memory.flatMap((item) => (item.heap === null ? [] : [item.heap]))
            rounds.push({
              round,
              prepareMs,
              packMs,
              registrationMs,
              samplingMs,
              memorySamples: memory,
              sampleHeapHighWater: heaps.length ? Math.max(...heaps) : null,
              maxSampleIntervalMs: Math.max(...memory.slice(1).map((m, i) => m.at - memory[i]!.at)),
              workerHeap: null,
              wasmMemory: null,
              totalBufferBytes: null,
              inputBufferBytes:
                kind === 'points' ? 0 : count * channels * (kind === 'typed-points' ? 12 : 4),
              backends:
                response.type === 'sample-viewport-response'
                  ? response.results.map((r) => r.diagnostics.backend)
                  : [],
            })
          } finally {
            clearInterval(timer)
            client.dispose()
          }
          onProgress({ kind, count, channels, round })
        }
        results.push({
          kind,
          count,
          channels,
          cold: rounds[0],
          rounds: rounds.slice(1, 6),
          memory: rounds[6],
        })
      }
  return {
    environment: navigator.userAgent,
    limitations: [
      'Main-thread heap is sampled; synchronous work can delay 10ms timer.',
      'Worker heap, WASM memory and total owned buffers unavailable; no total-memory peak claim.',
      'First sampling includes each fresh Worker WASM initialization.',
    ],
    results,
  }
}
