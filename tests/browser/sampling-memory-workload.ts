import { init } from '@/native'
import type { WaveformData, WaveformSeries } from '@/types/data'
import type { WorkerSamplingRequest, WorkerSamplingResponse } from '@/core/workerSampling'
import { WorkerSamplingRepository } from '@/core/workerSampling/repository'

interface Workload {
  points: number
  series: number
  instances: number
  input: 'objects' | 'typed' | 'samples'
  transfer: boolean
}
function input(scenario: Workload, phase: number): WaveformData {
  const series: WaveformSeries[] = Array.from({ length: scenario.series }, (_, channel) => {
    const y = Float64Array.from({ length: scenario.points }, (_, i) =>
      Math.sin(i / 50 + channel + phase),
    )
    const data: WaveformSeries['data'] =
      scenario.input === 'samples'
        ? { kind: 'typed-samples', values: y, sampleRate: 1000 }
        : scenario.input === 'typed'
          ? { kind: 'typed-points', x: Float64Array.from(y, (_, i) => i / 1000), y }
          : { kind: 'points', points: Array.from(y, (y, i) => ({ x: i / 1000, y })) }
    return { id: `s${channel}`, name: `S${channel}`, data }
  })
  return { kind: 'series', series }
}
function buffers(request: WorkerSamplingRequest): ArrayBuffer[] {
  if (request.type !== 'register-dataset' && request.type !== 'replace-dataset') return []
  const data = request.dataset
  if (!data || data.kind === 'points') return []
  const columns = data.kind === 'typed' ? [data.x, data.y] : [data.values, data.sourceIndexes]
  return [...new Set(columns.filter((v) => v !== undefined).map((v) => v.buffer as ArrayBuffer))]
}

/** Isolated benchmark: transfer only a cloned outgoing message, retaining the real recovery snapshot. */
export async function measureSamplingMemory(scenario: Workload) {
  const source = input(scenario, 0)
  const replacement = input(scenario, 0.5)
  const original = Worker.prototype.postMessage
  const snapshots = new Set<ArrayBuffer>()
  const workers = new Map<Worker, Map<string, number>>()
  let outgoingBytes = 0
  let detachedOutgoing = 0
  const repositories = new Set<WorkerSamplingRepository>()
  const mainHeapCheckpoints: Array<number | null> = []
  const checkpoint = () =>
    mainHeapCheckpoints.push(
      (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
        ?.usedJSHeapSize ?? null,
    )
  const restore = WorkerSamplingRepository.prototype.restoreDataset
  WorkerSamplingRepository.prototype.restoreDataset = function (...args) {
    restore.apply(this, args)
    repositories.add(this)
  }
  Worker.prototype.postMessage = function (request: WorkerSamplingRequest, ...rest: unknown[]) {
    if (request.type === 'register-dataset' || request.type === 'replace-dataset') {
      const datasets = workers.get(this) ?? new Map<string, number>()
      datasets.set(
        request.datasetId,
        request.type === 'register-dataset' ? 1 : request.revision + 1,
      )
      workers.set(this, datasets)
      const current = buffers(request)
      current.forEach((buffer) => snapshots.add(buffer))
      if (scenario.transfer && current.length) {
        const outgoing = structuredClone(request)
        const owned = buffers(outgoing)
        outgoingBytes += owned.reduce((total, buffer) => total + buffer.byteLength, 0)
        Reflect.apply(original, this, [outgoing, owned])
        detachedOutgoing += owned.filter((buffer) => buffer.byteLength === 0).length
        return
      }
    }
    if (request.type === 'dispose-dataset') workers.get(this)?.delete(request.datasetId)
    if (request.type === 'dispose-all') workers.get(this)?.clear()
    Reflect.apply(original, this, [request, ...rest])
  }
  const hosts = Array.from({ length: scenario.instances }, () => {
    const host = document.createElement('div')
    document.body.append(host)
    return host
  })
  const charts: ReturnType<typeof init>[] = []
  let metricsId = -10000
  const workerMetrics = () =>
    Promise.all(
      [...workers].flatMap(([worker, datasets]) =>
        [...datasets].map(
          ([datasetId, revision]) =>
            new Promise<WorkerSamplingResponse>((resolve, reject) => {
              const requestId = metricsId--
              const timeout = setTimeout(() => {
                worker.removeEventListener('message', receive)
                reject(new Error('Metrics deadline'))
              }, 10000)
              const receive = (event: MessageEvent<WorkerSamplingResponse>) => {
                if (event.data.requestId !== requestId) return
                clearTimeout(timeout)
                worker.removeEventListener('message', receive)
                resolve(event.data)
              }
              worker.addEventListener('message', receive)
              Reflect.apply(original, worker, [
                { type: 'get-dataset-metrics', requestId, datasetId, revision },
              ])
            }),
        ),
      ),
    )
  const stable = () => Promise.all(charts.map((chart) => chart.exportImage({ format: 'svg' })))
  try {
    const start = performance.now()
    for (const host of hosts)
      charts.push(
        init(host, {
          data: source,
          width: 800,
          height: 480,
          animationEnabled: false,
          rendering: { sampling: { mode: 'auto', maxPointCount: 1000, strategy: 'minmax' } },
          grid: { rowCount: scenario.series, columnCount: 1 },
        }),
      )
    await stable()
    const coldMs = performance.now() - start
    checkpoint()
    const update = performance.now()
    charts.forEach((chart) => chart.setOption({ data: replacement }))
    await stable()
    const replacementMs = performance.now() - update
    checkpoint()
    const metrics = await workerMetrics()
    const failure = performance.now()
    for (const worker of workers.keys()) {
      worker.addEventListener('error', (event) => event.preventDefault(), { once: true })
      worker.dispatchEvent(
        new ErrorEvent('error', { cancelable: true, message: 'memory benchmark fault' }),
      )
    }
    charts.forEach((chart) =>
      chart.setOption({
        rendering: { sampling: { mode: 'auto', strategy: 'minmax', maxPointCount: 900 } },
      }),
    )
    await stable()
    const recoveryMs = performance.now() - failure
    checkpoint()
    if ([...snapshots].some((buffer) => buffer.byteLength === 0))
      throw new Error('Recovery snapshot detached')
    for (const data of [source, replacement]) {
      if (data.kind !== 'series') continue
      for (const series of data.series) {
        if (series.data.kind === 'typed-samples' && !series.data.values.byteLength)
          throw new Error('Consumer detached')
        if (
          series.data.kind === 'typed-points' &&
          (!series.data.x.byteLength || !series.data.y.byteLength)
        )
          throw new Error('Consumer detached')
      }
    }
    return {
      coldMs,
      replacementMs,
      recoveryMs,
      metrics,
      fallbackResources: [...repositories].map((repository) => repository.resourceMetrics),
      mainHeapCheckpoints,
      snapshotBytesAcrossRun: [...snapshots].reduce(
        (total, buffer) => total + buffer.byteLength,
        0,
      ),
      outgoingBytes,
      detachedOutgoing,
      consumerIntact: true,
      recoveryIntact: true,
      note: 'Benchmark retains snapshot references to verify ownership; bytes across run are not simultaneous production residency. Worker metrics report indexes, not total WASM memory.',
    }
  } finally {
    charts.forEach((chart) => chart.dispose())
    hosts.forEach((host) => host.remove())
    Worker.prototype.postMessage = original
    WorkerSamplingRepository.prototype.restoreDataset = restore
  }
}
