import { chromium } from 'playwright'
import { animationBrowserServer } from './animation-browser-server.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { animationBuildInputs } from './animation-build-inputs.mjs'

const output = new URL('../openspec/changes/add-animation-system/evidence/', import.meta.url)
await mkdir(output, { recursive: true })
const buildInputs = animationBuildInputs()
const server = await animationBrowserServer(5177)
const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] })
const percentile = (values, p) =>
  [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * p)]
const workers = Number(process.env.ANIMATION_BENCHMARK_WORKERS ?? 1)
const report = {
  started: new Date().toISOString(),
  browser: browser.version(),
  buildMode: server.buildMode,
  buildInputsSha256: buildInputs.sha256,
  buildInputFiles: buildInputs.files,
  environment: {
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpu: os.cpus()[0]?.model,
    logicalCpus: os.cpus().length,
    ramBytes: os.totalmem(),
    headless: true,
    concurrentPages: workers,
  },
  sampling: { mode: 'auto', maxPointCount: 1200 },
  warmups: 3,
  recordedRuns: 10,
  minimumObservationMs: 2100,
  refresh: [],
  scenarios: [],
  visual: [],
  errors: [],
  benchmarkEnginesNotRun: ['Firefox', 'Safari', 'Edge', 'iOS Safari', 'Android Chrome'],
  memoryNote:
    'CDP collectGarbage + JS heap samples; excludes native/SVG/GPU allocations and is not proof of leak absence.',
}
const outputName = process.env.ANIMATION_BENCHMARK_OUTPUT ?? 'browser-results.json'
const save = () => writeFile(new URL(outputName, output), JSON.stringify(report, null, 2))
const matrix = []
for (const [width, height] of [
  [1280, 720],
  [360, 300],
])
  for (const series of [1, 8])
    for (const points of [1000, 10000, 100000, 199999, 200000, 200001])
      for (const mode of ['static', 'enter', 'compatible', 'crossfade'])
        if (
          !process.env.ANIMATION_BENCHMARK_SERIES ||
          series === Number(process.env.ANIMATION_BENCHMARK_SERIES)
        )
          if (
            !process.env.ANIMATION_BENCHMARK_POINTS ||
            process.env.ANIMATION_BENCHMARK_POINTS.split(',').map(Number).includes(points)
          )
            matrix.push({ width, height, series, points, mode })
let index = 0
try {
  await Promise.all(
    Array.from({ length: workers }, async (_, worker) => {
      const page = await browser.newPage({
        viewport: { width: 1400, height: 900 },
        reducedMotion: 'no-preference',
      })
      page.on('pageerror', (error) => report.errors.push({ worker, message: error.message }))
      await page.goto('http://localhost:5177/tests/browser/animation.html')
      await page.waitForFunction(() => !!globalThis.animationBenchmark)
      const refresh = await page.evaluate(() => globalThis.animationBenchmark.refresh())
      report.refresh.push({
        worker,
        hz: 1000 / percentile(refresh, 0.5),
        p95Ms: percentile(refresh, 0.95),
      })
      const cdp = await page.context().newCDPSession(page)
      while (index < matrix.length) {
        const scenario = matrix[index++]
        for (let i = 0; i < 3; i++)
          await page.evaluate((s) => globalThis.animationBenchmark.observe(s), scenario)
        const runs = []
        for (let i = 0; i < 10; i++) {
          const result = await page.evaluate(
            (s) => globalThis.animationBenchmark.observe(s),
            scenario,
          )
          runs.push({
            fps: (result.intervals.length * 1000) / result.elapsed,
            p50Ms: percentile(result.intervals, 0.5),
            p95Ms: percentile(result.intervals, 0.95),
            p99Ms: percentile(result.intervals, 0.99),
            longFrames: result.intervals.filter((v) => v > 50).length,
            elapsedMs: result.elapsed,
            frames: result.intervals.length,
            displayedCoordinates: result.displayedCoordinates,
            activeAfterObservation: result.activeAfterObservation,
            maxActiveTasks: result.maxActiveTasks,
          })
        }
        report.scenarios.push({ ...scenario, worker, runs })
        await save()
        console.log(
          `${report.scenarios.length}/${matrix.length}: ${scenario.width}x${scenario.height}, ${scenario.series} series, ${scenario.points} points, ${scenario.mode}`,
        )
      }
      await cdp.send('HeapProfiler.collectGarbage')
      const before = await cdp.send('Runtime.getHeapUsage')
      const resources = await page.evaluate(() =>
        globalThis.animationBenchmark.cycles({
          width: 1280,
          height: 720,
          series: 8,
          points: 10000,
          mode: 'enter',
        }),
      )
      await cdp.send('HeapProfiler.collectGarbage')
      const after = await cdp.send('Runtime.getHeapUsage')
      report.refresh.find((record) => record.worker === worker).memoryCycles = {
        before,
        after,
        resources,
        cycles: 20,
      }
      await page.close()
    }),
  )
  for (const [width, height] of [
    [1280, 900],
    [360, 700],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } })
    await page.goto('http://localhost:5177/#/animation')
    await page.getByRole('heading', { name: '波形动画', exact: true }).waitFor()
    await page.getByRole('button', { name: '增删标注', exact: true }).click()
    await page.waitForSelector('.waveform-annotation')
    await page.getByRole('button', { name: '更新振幅', exact: true }).click()
    await page.waitForTimeout(1500)
    await page.waitForFunction(() => {
      const annotation = globalThis.document.querySelector('.waveform-annotation')
      const label = annotation?.querySelector('.waveform-annotation__box')?.parentElement
      return (
        Number(annotation?.getAttribute('opacity')) === 1 &&
        label?.getAttribute('transform')?.includes('scale(1)')
      )
    })
    const screenshotPrefix =
      outputName === 'browser-results.json' ? '' : `${outputName.replace(/\.json$/, '')}-`
    const screenshot = `${screenshotPrefix}demo-${width}.png`
    await page.screenshot({ path: new URL(screenshot, output).pathname, fullPage: true })
    report.visual.push({
      width,
      height,
      screenshot,
      annotation: await page.locator('.waveform-annotation').count(),
      annotationSettled: true,
    })
    await page.close()
  }
  report.finished = new Date().toISOString()
  await save()
  if (report.errors.length)
    throw new Error(`${report.errors.length} browser errors; inspect evidence`)
} finally {
  await save()
  await browser.close()
  await server.close()
}
