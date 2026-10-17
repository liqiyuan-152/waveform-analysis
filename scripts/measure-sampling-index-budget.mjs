import { writeFile } from 'node:fs/promises'
import { createServer } from 'vite'

const output = process.argv[2]
if (!output) throw new Error('Usage: node scripts/measure-sampling-index-budget.mjs output.json')
const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
})
try {
  const { MultiResolutionSamplingIndex } = await server.ssrLoadModule(
    '/src/core/workerSampling/multiresolution.ts',
  )
  const { sampleWaveformReference } = await server.ssrLoadModule('/src/core/samplingReference.ts')
  const points = Array.from({ length: 100_000 }, (_, x) => ({ x, y: Math.sin(x) }))
  const results = []
  for (const strategy of ['minmax', 'sum']) {
    for (const maxBytes of [0, 8 * 1024 * 1024]) {
      const runs = []
      for (let run = 0; run < 25; run++) {
        const index = new MultiResolutionSamplingIndex(points, { maxBytes })
        let allocated = 0
        const originals = { Uint32Array, Float64Array }
        for (const [name, Original] of Object.entries(originals)) {
          globalThis[name] = new Proxy(Original, {
            construct(target, args) {
              const array = Reflect.construct(target, args)
              allocated += array.byteLength
              return array
            },
          })
        }
        const times = []
        try {
          for (let request = 0; request < 2; request++) {
            const started = performance.now()
            void (
              index.sample(request, points.length, strategy, 100) ??
              sampleWaveformReference({
                points: points.slice(request),
                strategy,
                targetPointCount: 100,
              })
            )
            times.push(performance.now() - started)
          }
        } finally {
          Object.assign(globalThis, originals)
        }
        if (run >= 5)
          runs.push({ allocated, retained: index.byteLength, coldMs: times[0], warmMs: times[1] })
        index.dispose()
        if (index.byteLength !== 0) throw new Error('Index was not released')
      }
      const stats = (key) => {
        const values = runs.map((run) => run[key]).sort((a, b) => a - b)
        return {
          median: values[Math.floor(values.length / 2)],
          p95: values[Math.ceil(values.length * 0.95) - 1],
        }
      }
      results.push({
        strategy,
        maxBytes,
        allocated: stats('allocated'),
        retained: stats('retained'),
        coldMs: stats('coldMs'),
        warmMs: stats('warmMs'),
      })
    }
  }
  await writeFile(
    output,
    JSON.stringify(
      {
        node: process.version,
        pointCount: points.length,
        workload: 'x=index,y=sin(index); two requests [0,n),[1,n); target=100',
        warmup: 5,
        measuredRuns: 20,
        allocationScope:
          'Cumulative Uint32Array/Float64Array constructor bytes, not peak residency; includes fallback output',
        results,
      },
      null,
      2,
    ) + '\n',
  )
} finally {
  await server.close()
}
