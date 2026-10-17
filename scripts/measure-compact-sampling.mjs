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
  const count = 1_000_000
  const values = Float64Array.from({ length: count }, (_, i) => Math.sin(i / 50))
  const x = Float64Array.from(values, (_, i) => i / 1000)
  const results = []
  for (const kind of ['typed', 'samples']) {
    for (const budget of [0, 8 * 1024 * 1024]) {
      const runs = []
      for (let run = 0; run < 25; run++) {
        const repository = new WorkerSamplingRepository({
          indexMaxBytes: budget,
          cacheMaxEntries: 0,
        })
        const started = performance.now()
        repository.handle({
          type: 'register-dataset',
          requestId: 1,
          datasetId: 'd',
          revision: 0,
          dataset:
            kind === 'typed'
              ? { kind, x, y: values }
              : { kind, values, sampleRate: 1000, startTime: 0 },
        })
        const registeredMs = performance.now() - started
        const sample = (i) => {
          const start = performance.now()
          const response = repository.handle({
            type: 'sample-viewport',
            requestId: 2 + i,
            series: [
              {
                datasetId: 'd',
                seriesId: 's',
                revision: 1,
                mode: 'auto',
                autoThreshold: 0,
                xDomain: [0.1 + i / 100, 999.9 - i / 100],
                plotWidth: 1000,
                maxPointCount: 1000,
                strategy: 'minmax',
              },
            ],
          })
          if (response.results[0].diagnostics.backend !== 'javascript')
            throw new Error('Expected fallback')
          return performance.now() - start
        }
        const coldMs = sample(0)
        const warmMs = Array.from({ length: 20 }, (_, i) => sample(i + 1))
        if (run >= 5)
          runs.push({ registeredMs, coldMs, warmMs, resources: repository.resourceMetrics })
        repository.handle({ type: 'dispose-all', requestId: 99 })
        if (repository.resourceMetrics.indexBytes !== 0)
          throw new Error('Index retained after disposal')
      }
      results.push({ kind, budget, runs })
    }
  }
  await writeFile(
    output,
    JSON.stringify(
      {
        node: process.version,
        count,
        workload:
          'x=i/1000;y=sin(i/50);target=1000;cache disabled;5 warmups,20 measured datasets;20 distinct warm viewports',
        results,
      },
      null,
      2,
    ) + '\n',
  )
} finally {
  await server.close()
}
