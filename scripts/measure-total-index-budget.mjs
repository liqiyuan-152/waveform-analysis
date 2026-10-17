import { writeFile } from 'node:fs/promises'
import { createServer } from 'vite'
const output = process.argv[2]
if (!output) throw new Error('Supply output.json')
const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
})
try {
  const { WorkerSamplingRepository } = await server.ssrLoadModule(
    '/src/core/workerSampling/repository.ts',
  )
  const results = []
  for (const indexMaxBytes of [8 * 1024 * 1024, 1024 * 1024]) {
    const repository = new WorkerSamplingRepository({ indexMaxBytes })
    for (let i = 0; i < 8; i++)
      repository.handle({
        type: 'register-dataset',
        datasetId: `d${i}`,
        requestId: i,
        revision: 0,
        dataset: {
          kind: 'samples',
          sampleRate: 1000,
          startTime: 0,
          values: Float64Array.from({ length: 1_000_000 }, (_, x) => Math.sin(x / 50 + i)),
        },
      })
    const runs = []
    for (let i = 0; i < 29; i++) {
      const viewport = i < 25 ? i : i - 4
      const started = performance.now()
      const response = repository.handle({
        type: 'sample-viewport',
        requestId: 100 + i,
        series: Array.from({ length: 8 }, (_, channel) => ({
          datasetId: `d${channel}`,
          seriesId: `s${channel}`,
          revision: 1,
          mode: 'auto',
          autoThreshold: 0,
          strategy: 'minmax',
          maxPointCount: 1000,
          plotWidth: 800,
          xDomain: [0.1 + viewport / 100, 999.9 - viewport / 100],
        })),
      })
      if (i >= 5)
        runs.push({
          durationMs: performance.now() - started,
          cached: i >= 25,
          cacheHits: response.results.filter((result) => result.diagnostics.cacheHit).length,
        })
    }
    results.push({
      indexMaxBytes,
      instances: 1,
      series: 8,
      points: 1_000_000,
      runs,
      resources: repository.resourceMetrics,
    })
    repository.handle({ type: 'dispose-all', requestId: 999 })
  }
  await writeFile(
    output,
    JSON.stringify(
      {
        node: process.version,
        candidate:
          'Static equal partition of 8MiB instance budget across 8 datasets versus existing 8MiB per dataset; sources retained; 5 warmups/20 distinct measured ranges + 4 cached repeats',
        results,
      },
      null,
      2,
    ) + '\n',
  )
} finally {
  await server.close()
}
