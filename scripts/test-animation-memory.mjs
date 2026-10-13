import { chromium } from 'playwright'
import { animationBrowserServer } from './animation-browser-server.mjs'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { animationBuildInputs } from './animation-build-inputs.mjs'
import os from 'node:os'
import { createHash } from 'node:crypto'

if (process.platform !== 'darwin') throw new Error('This runner requires macOS footprint')
const evidence = new URL(
  `../openspec/changes/add-animation-system/evidence/${process.env.ANIMATION_MEMORY_OUTPUT ?? 'memory-results.json'}`,
  import.meta.url,
)
const buildInputs = animationBuildInputs()
const report = {
  started: new Date().toISOString(),
  methodologyVersion: 4,
  runnerSha256: createHash('sha256')
    .update(readFileSync(new URL(import.meta.url)))
    .digest('hex'),
  buildInputsSha256: buildInputs.sha256,
  buildInputFiles: buildInputs.files,
  buildMode: process.env.ANIMATION_BENCHMARK_BUILD === 'development' ? 'development' : 'production',
  environment: { platform: os.platform(), release: os.release(), cpu: os.cpus()[0].model },
  methodology:
    'Paired fresh-browser runs. Identical data changes with animation enabled/disabled; three static mount/unmount warmups per browser, CDP GC, then unforced physical-footprint samples from measured mount completion through at least duration+100ms and task settlement. No GC occurs inside this observation window. All browser/renderer/GPU/network process IDs from SystemInfo are included. Baseline is each browser after warmup before measurement. Process-attributed native/DOM/GPU-process memory is included; driver/system allocations not attributed to these processes remain outside this measurement. Peak is a sampled peak after mount, not a continuously observed or during-mount maximum. Settled retainedAfterGC and unmounted afterCyclesBeforeGC/afterCycles are recorded for every run separately from peak.',
  scenarios: [],
  errors: [],
}
const trials = Number(process.env.ANIMATION_MEMORY_TRIALS ?? 3)
const widths = (process.env.ANIMATION_MEMORY_WIDTHS ?? '1280,360').split(',').map(Number)
const pointCounts = (process.env.ANIMATION_MEMORY_POINTS ?? '10000,49999').split(',').map(Number)
const modes = (process.env.ANIMATION_MEMORY_MODES ?? 'enter,compatible,crossfade').split(',')
report.trials = trials
const duration = Number(process.env.ANIMATION_MEMORY_DURATION ?? 2000)
report.durationMs = duration
if (process.env.ANIMATION_MEMORY_RESUME === '1') {
  const saved = JSON.parse(readFileSync(evidence, 'utf8'))
  if (
    saved.buildMode !== report.buildMode ||
    saved.methodologyVersion !== report.methodologyVersion ||
    saved.buildInputsSha256 !== report.buildInputsSha256 ||
    saved.runnerSha256 !== report.runnerSha256 ||
    saved.durationMs !== duration ||
    saved.trials !== trials
  )
    throw new Error('Resume requires identical build inputs, build mode, duration and trials')
  Object.assign(report, saved)
}
const server = await animationBrowserServer(5181)
const save = () => writeFileSync(evidence, JSON.stringify(report, null, 2))
async function measure(scenario, enabled) {
  const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] })
  let phase = 'create-page'
  const navigations = [],
    pageErrors = []
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigations.push({ phase, url: frame.url() })
    })
    page.on('pageerror', (error) => pageErrors.push({ phase, message: error.message }))
    page.on('crash', () => pageErrors.push({ phase, message: 'Page crashed' }))
    phase = 'navigate'
    await page.goto('http://localhost:5181/tests/browser/animation.html')
    phase = 'wait-fixture'
    await page.waitForFunction(() => !!globalThis.animationBenchmark)
    const cdp = await page.context().newCDPSession(page)
    const browserCdp = await browser.newBrowserCDPSession()
    async function sample() {
      const { processInfo } = await browserCdp.send('SystemInfo.getProcessInfo')
      const footprintStartedAt = Date.now()
      execFileSync(
        'footprint',
        [
          '--noCategories',
          '-f',
          'bytes',
          '-j',
          '/tmp/animation-footprint-sample.json',
          ...processInfo.map((p) => String(p.id)),
        ],
        { stdio: 'ignore' },
      )
      const native = JSON.parse(readFileSync('/tmp/animation-footprint-sample.json', 'utf8'))
      if (native.errors.length) throw new Error(JSON.stringify(native.errors))
      return {
        footprintStartedAt,
        footprintFinishedAt: Date.now(),
        footprintBytes: native['total footprint'],
        processes: native.processes.map((p) => ({
          pid: p.pid,
          type: processInfo.find((info) => info.id === p.pid)?.type,
          footprintBytes: p.footprint,
        })),
        jsHeap: await cdp.send('Runtime.getHeapUsage'),
        dom: await cdp.send('Memory.getDOMCounters'),
        activeTasks: await page.evaluate(() => globalThis.animationBenchmark.activeTasks()),
      }
    }
    for (let i = 0; i < 3; i++) {
      phase = `warmup-${i + 1}-mount`
      await page.evaluate(
        (s) => globalThis.animationBenchmark.mount({ ...s, enabled: false }),
        scenario,
      )
      phase = `warmup-${i + 1}-unmount`
      await page.evaluate(() => globalThis.animationBenchmark.unmount())
    }
    await cdp.send('HeapProfiler.collectGarbage')
    phase = 'baseline-sample'
    const before = await sample()
    phase = 'measured-mount'
    await page.evaluate((s) => globalThis.animationBenchmark.mount(s), {
      ...scenario,
      enabled,
      duration,
    })
    const samples = []
    const observationStartedAt = Date.now()
    const minimumObservationMs = duration + 100
    while (true) {
      phase = `physical-sample-${samples.length + 1}`
      const current = await sample()
      samples.push(current)
      const elapsed = Date.now() - observationStartedAt
      if (elapsed >= minimumObservationMs && current.activeTasks === 0) break
      if (elapsed > minimumObservationMs + 5000)
        throw new Error('Animation did not settle within the physical observation window')
      await page.waitForTimeout(150)
    }
    const observationMs = Date.now() - observationStartedAt
    if (enabled && !samples.some((s) => s.activeTasks))
      throw new Error('No active animation in memory samples')
    await cdp.send('HeapProfiler.collectGarbage')
    phase = 'retained-gc-sample'
    const retainedAfterGC = await sample()
    phase = 'twenty-cycles'
    const resources = await page.evaluate((s) => globalThis.animationBenchmark.cycles(s), {
      ...scenario,
      enabled,
      duration,
    })
    phase = 'post-cycles-unforced-sample'
    const afterCyclesBeforeGC = await sample()
    await cdp.send('HeapProfiler.collectGarbage')
    phase = 'post-cycles-sample'
    const afterCycles = await sample()
    if (resources.tasks || resources.elements)
      throw new Error('Animation resources survived unmount')
    return {
      browser: browser.version(),
      diagnostics: { navigations, pageErrors },
      before,
      samples,
      retainedAfterGC,
      observationStartedAt,
      minimumObservationMs,
      observationMs,
      peakBytes: Math.max(...samples.map((s) => s.footprintBytes)),
      afterCyclesBeforeGC,
      afterCycles,
      cycles: 20,
      cyclesAnimationEnabled: enabled,
      resources,
    }
  } catch (error) {
    throw Object.assign(error, { measurementDiagnostics: { phase, navigations, pageErrors } })
  } finally {
    await browser.close()
  }
}
async function measuredRun(scenario, enabled) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await measure(scenario, enabled)
    } catch (error) {
      report.errors.push({
        scenario,
        enabled,
        attempt,
        error: String(error),
        diagnostics: error.measurementDiagnostics,
        stack: error.stack,
      })
      save()
      if (attempt === 3) throw error
    }
  }
}
try {
  for (const width of widths)
    for (const points of pointCounts)
      for (const mode of modes) {
        const scenario = { width, height: width === 360 ? 300 : 720, series: 8, points, mode }
        if (
          report.scenarios.some(
            (row) => row.width === width && row.points === points && row.mode === mode,
          )
        )
          continue
        const runs = []
        for (let trial = 0; trial < trials; trial++) {
          const staticRun = await measuredRun(scenario, false)
          const animatedRun = await measuredRun(scenario, true)
          const animationIncrementBytes =
            animatedRun.peakBytes -
            animatedRun.before.footprintBytes -
            (staticRun.peakBytes - staticRun.before.footprintBytes)
          runs.push({ staticRun, animatedRun, animationIncrementBytes })
        }
        report.scenarios.push({
          ...scenario,
          budgetBytes: points <= 10000 ? 10000000 : 20000000,
          runs,
        })
        save()
        console.log(
          `${report.scenarios.length}/${widths.length * pointCounts.length * modes.length}: ${width}, ${points}, ${mode}, deltas ${runs.map((r) => r.animationIncrementBytes).join(', ')}`,
        )
      }
  report.finished = new Date().toISOString()
} finally {
  save()
  await server.close()
}
