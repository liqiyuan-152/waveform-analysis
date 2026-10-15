import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { build, preview } from 'vite'
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir, cpus, platform, arch } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const pilot = process.argv.includes('--pilot')
const diagnostic = process.argv.includes('--diagnostic')
const animationProbe = process.argv.includes('--animation-probe')
const denseProbe = process.argv.includes('--dense-probe')
const largeProbe = process.argv.includes('--large-probe')
const rawUpdateProbe = process.argv.includes('--raw-update-probe')
const smallRawProbe = process.argv.includes('--small-raw-probe')
const traceGc = process.argv.includes('--trace-gc')
const collectBetweenRuns = process.argv.includes('--collect-between-runs')
const snapshot = createHash('sha256')
const snapshotFiles = [
  ...execFileSync(
    'rg',
    [
      '--files',
      'src',
      'tests/support',
      'tests/browser',
      'tests/fixtures/legacy',
      'scripts',
      'wasm/src',
    ],
    {
      encoding: 'utf8',
    },
  )
    .trim()
    .split('\n'),
  'package.json',
  'pnpm-lock.yaml',
  'vite.config.ts',
  'wasm/Cargo.lock',
  'wasm/Cargo.toml',
].sort()
for (const path of snapshotFiles) {
  snapshot
    .update(path)
    .update('\0')
    .update(await readFile(path))
    .update('\0')
}
const evidence = resolve('openspec/changes/decouple-waveform-engine-from-vue/evidence')
await mkdir(evidence, { recursive: true })
const output = join(
  evidence,
  smallRawProbe
    ? 'native-performance-small-raw-probe.json'
    : rawUpdateProbe
      ? 'native-performance-raw-update-probe.json'
      : largeProbe
        ? diagnostic
          ? 'native-performance-large-diagnostic.json'
          : traceGc
            ? 'native-performance-large-profile.json'
            : 'native-performance-large-probe.json'
        : denseProbe
          ? 'native-performance-dense-probe.json'
          : animationProbe
            ? 'native-performance-animation-probe.json'
            : diagnostic
              ? 'native-performance-diagnostic.json'
              : pilot
                ? 'native-performance-pilot.json'
                : 'native-performance.json',
)
const outDir = await mkdtemp(join(tmpdir(), 'waveform-native-performance-'))
await build({
  build: {
    outDir,
    rolldownOptions: { input: resolve('tests/browser/native-migration-baseline.html') },
  },
})
const assetHashes = {}
async function hashBuild(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    const key = `${prefix}${entry.name}`
    if (entry.isDirectory()) await hashBuild(path, `${key}/`)
    else
      assetHashes[key] = createHash('sha256')
        .update(await readFile(path))
        .digest('hex')
  }
}
await hashBuild(outDir)
const server = await preview({ build: { outDir }, preview: { port: 5198, strictPort: true } })
const browser = await chromium.launch({
  args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const traceEvents = []
const tracing = traceGc ? await page.context().newCDPSession(page) : undefined
if (tracing) {
  tracing.on('Tracing.dataCollected', ({ value }) => traceEvents.push(...value))
  await tracing.send('Tracing.start', {
    categories: 'devtools.timeline,v8,blink.user_timing,disabled-by-default-v8.gc',
    transferMode: 'ReportEvents',
  })
}
const percentile = (values, fraction) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1]
const summary = (values) => ({ median: percentile(values, 0.5), p95: percentile(values, 0.95) })
const report = {
  startedAt: new Date().toISOString(),
  status: 'running',
  pilot,
  diagnostic,
  animationProbe,
  largeProbe,
  rawUpdateProbe,
  smallRawProbe,
  traceGc,
  collectBetweenRuns,
  sampleIsolation: collectBetweenRuns
    ? 'Both engines release benchmark-owned data and force GC after disposal, outside all timed metrics; then yield two RAFs for browser teardown.'
    : 'Continuous page without explicit between-run collection.',
  chartOptions: {
    title: '波形迁移基线',
    frameNumber: '001',
    initializationAnimations: false,
    animationWorkload: '100ms data update; both engines must complete the animation',
    animationThreshold: 10000000,
    animationDuration: 100,
  },
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  worktreeSha256: snapshot.digest('hex'),
  snapshotFiles,
  assetHashes,
  node: process.version,
  browser: browser.version(),
  environment: { platform: platform(), arch: arch(), cpu: cpus()[0]?.model },
  buildMode: 'production; same fixture and data generator; typed Float64 samples',
  measurement:
    'data generation excluded; initial RAF and stable SVG export barrier included; trailing paint RAF retained outside timed interval to avoid phase-dependent idle time; all 100 viewport RAFs timed',
  rawTotalPointCap: 100000,
  capReason:
    'Both engines share the original default rawPointLimit resource envelope (100000 total SVG points). Larger raw cases are explicitly resource-capped for both engines; auto sampling still measures every requested size.',
  warmups: diagnostic ? 0 : 3,
  runs: diagnostic ? 1 : 10,
  viewportOperationsPerRun: 100,
  scenarios: [],
  capped: [],
  regressions: [],
  errors: [],
}
page.on('pageerror', (error) => report.errors.push(error.message))
const save = () => writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
function summarize(runs) {
  return {
    mount: summary(runs.map((run) => run.mountMs)),
    update: summary(runs.map((run) => run.updateMs)),
    viewportTotal: summary(runs.map((run) => run.viewport.reduce((sum, value) => sum + value, 0))),
    viewportFrame: summary(runs.flatMap((run) => run.viewport)),
  }
}
const scenarios = []
for (const series of [1, 8])
  for (const pointsPerSeries of [10000, 100000, 1000000])
    for (const sampling of ['raw', 'auto'])
      for (const animationEnabled of [false, true]) {
        const scenario = {
          width: 1200,
          height: 720,
          series,
          pointsPerSeries,
          sampling,
          animationEnabled,
          animationWorkload: 'update',
        }
        if (smallRawProbe) {
          if (series !== 1 || pointsPerSeries !== 10000 || sampling !== 'raw' || animationEnabled)
            continue
        } else if (rawUpdateProbe) {
          if (!(
            ((series === 1 && pointsPerSeries === 100000) ||
              (series === 8 && pointsPerSeries === 10000)) &&
            sampling === 'raw' &&
            !animationEnabled
          ))
            continue
        } else if (largeProbe) {
          if (series !== 8 || pointsPerSeries < 100000 || sampling !== 'auto') continue
        } else if (
          (pilot || diagnostic || animationProbe || denseProbe) &&
          !(
            series === (denseProbe ? 8 : 1) &&
            pointsPerSeries === 10000 &&
            sampling === (animationProbe || denseProbe ? 'raw' : 'auto') &&
            animationEnabled === animationProbe
          )
        )
          continue
        if (sampling === 'raw' && series * pointsPerSeries > report.rawTotalPointCap)
          report.capped.push({ ...scenario, legacy: 'resource-cap', native: 'resource-cap' })
        else scenarios.push(scenario)
      }
try {
  await page.goto('http://localhost:5198/tests/browser/native-migration-baseline.html')
  await page.waitForFunction(() => !!globalThis.waveformMigrationBaseline)
  for (const scenario of scenarios) {
    const entry = { ...scenario, legacy: { runs: [] }, native: { runs: [] } }
    report.scenarios.push(entry)
    for (let sample = -report.warmups; sample < report.runs; sample++) {
      // Alternate engine order to reduce systematic warm-machine/order bias.
      for (const engine of sample % 2 === 0 ? ['legacy', 'native'] : ['native', 'legacy']) {
        if (tracing)
          await page.evaluate(
            (name) => performance.mark(name),
            `waveform-profile:${scenario.pointsPerSeries}:${scenario.animationEnabled}:${sample}:${engine}`,
          )
        const run = await page.evaluate(
          async (scenario) => {
            const api = globalThis.waveformMigrationBaseline
            const measurement = await api.measure(scenario)
            const viewport = await api.viewport()
            const cleanup = api.unmount()
            return { ...measurement, viewport, cleanup }
          },
          { ...scenario, engine },
        )
        assert.equal(run.viewport.length, report.viewportOperationsPerRun)
        assert.equal(run.cleanup.elements, 0)
        assert.equal(run.cleanup.animationTasks, 0)
        if (scenario.animationEnabled) {
          assert.ok(
            run.animationCompletions.update > 0,
            `${engine}: configured update animation did not complete`,
          )
        }
        assert.equal(run.animationCompletions.enter, 0, `${engine}: initialization must be static`)
        if (sample >= 0) entry[engine].runs.push(run)
        if (collectBetweenRuns)
          await page.evaluate(async () => {
            if (typeof globalThis.gc !== 'function') throw new Error('Explicit GC is unavailable')
            globalThis.gc()
            await new Promise((resolve) => globalThis.requestAnimationFrame(resolve))
            await new Promise((resolve) => globalThis.requestAnimationFrame(resolve))
          })
      }
      await save()
    }
    for (const engine of ['legacy', 'native']) entry[engine].summary = summarize(entry[engine].runs)
    for (const metric of Object.keys(entry.legacy.summary))
      for (const statistic of ['median', 'p95']) {
        const before = entry.legacy.summary[metric][statistic]
        const after = entry.native.summary[metric][statistic]
        if (after > before * 1.2 && after - before > 5)
          report.regressions.push({
            scenario,
            metric,
            statistic,
            before,
            after,
            difference: after - before,
          })
      }
    await save()
    console.log(
      `Measured ${scenario.series} × ${scenario.pointsPerSeries}, ${scenario.sampling}, animation=${scenario.animationEnabled}; regressions=${report.regressions.length}`,
    )
  }
  report.status = report.errors.length || report.regressions.length ? 'failed' : 'passed'
} catch (error) {
  report.status = 'failed'
  report.errors.push(String(error))
  throw error
} finally {
  report.finishedAt = new Date().toISOString()
  await save()
  if (tracing) {
    const completed = new Promise((resolve) => tracing.once('Tracing.tracingComplete', resolve))
    await tracing.send('Tracing.end')
    await completed
    await writeFile(
      join(evidence, 'native-performance-gc-trace.json'),
      JSON.stringify({
        scope: 'Diagnostic trace: user timing markers, top-level GC, metadata and events >20ms.',
        traceEvents: traceEvents.filter(
          (event) =>
            event.ph === 'M' ||
            event.name?.startsWith('waveform-profile:') ||
            ['MajorGC', 'MinorGC'].includes(event.name) ||
            event.dur > 20000,
        ),
      }),
    )
  }
  await browser.close()
  await new Promise((resolve, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : resolve())),
  )
}
console.log(`Performance ${report.status}: ${output}`)
if (report.status !== 'passed') process.exitCode = 1
