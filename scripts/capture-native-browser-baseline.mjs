import { chromium } from 'playwright'
import { build, preview } from 'vite'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir, cpus, platform, arch } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const evidence = resolve('openspec/changes/decouple-waveform-engine-from-vue/evidence')
await mkdir(evidence, { recursive: true })
const outDir = await mkdtemp(join(tmpdir(), 'waveform-native-baseline-'))
await build({
  build: {
    outDir,
    rolldownOptions: { input: resolve('tests/browser/native-migration-baseline.html') },
  },
})
const server = await preview({ build: { outDir }, preview: { port: 5189, strictPort: true } })
const browser = await chromium.launch({
  args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.setDefaultTimeout(30000)
const percentile = (values, fraction) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1]
const report = {
  startedAt: new Date().toISOString(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  node: process.version,
  browser: browser.version(),
  environment: { platform: platform(), arch: arch(), cpu: cpus()[0]?.model },
  buildMode: 'production',
  measurement: 'setup/data generation excluded; stable SVG export barrier and two RAFs included',
  rawTotalPointCap: 100000,
  capReason:
    'Retain the existing default rawPointLimit-sized resource envelope for full SVG paths.',
  warmups: 3,
  runs: 10,
  scenarios: [],
  skipped: [],
  errors: [],
}
page.on('pageerror', (error) => report.errors.push(error.message))
const save = () =>
  writeFile(join(evidence, 'browser-baseline.json'), JSON.stringify(report, null, 2))
try {
  await page.goto('http://localhost:5189/tests/browser/native-migration-baseline.html')
  await page.waitForFunction(() => !!globalThis.waveformMigrationBaseline)
  for (const width of [1200, 360]) {
    const visual = {
      width,
      height: width === 360 ? 400 : 720,
      series: 2,
      pointsPerSeries: 1000,
      sampling: 'auto',
      animationEnabled: false,
    }
    await page.evaluate((s) => globalThis.waveformMigrationBaseline.mount(s), visual)
    await page.locator('#benchmark').screenshot({ path: join(evidence, `baseline-${width}.png`) })
  }
  for (const series of [1, 8]) {
    for (const pointsPerSeries of [10000, 100000, 1000000]) {
      for (const sampling of ['raw', 'auto']) {
        for (const animationEnabled of [false, true]) {
          const scenario = {
            width: 1200,
            height: 720,
            series,
            pointsPerSeries,
            sampling,
            animationEnabled,
          }
          if (sampling === 'raw' && series * pointsPerSeries > report.rawTotalPointCap) {
            report.skipped.push({ ...scenario, reason: report.capReason })
            continue
          }
          for (let i = 0; i < report.warmups; i++)
            await page.evaluate((s) => globalThis.waveformMigrationBaseline.measure(s), scenario)
          const runs = []
          for (let i = 0; i < report.runs; i++)
            runs.push(
              await page.evaluate((s) => globalThis.waveformMigrationBaseline.measure(s), scenario),
            )
          report.scenarios.push({
            ...scenario,
            runs,
            mount: {
              median: percentile(
                runs.map((r) => r.mountMs),
                0.5,
              ),
              p95: percentile(
                runs.map((r) => r.mountMs),
                0.95,
              ),
            },
            update: {
              median: percentile(
                runs.map((r) => r.updateMs),
                0.5,
              ),
              p95: percentile(
                runs.map((r) => r.updateMs),
                0.95,
              ),
            },
          })
          await save()
          console.log(
            `Baseline: ${series} x ${pointsPerSeries}, ${sampling}, animation ${animationEnabled}`,
          )
        }
      }
    }
  }
  const cycleScenario = {
    width: 1200,
    height: 720,
    series: 1,
    pointsPerSeries: 10000,
    sampling: 'auto',
    animationEnabled: false,
  }
  await page.evaluate((s) => globalThis.waveformMigrationBaseline.mount(s), cycleScenario)
  report.viewportMs = await page.evaluate(() => globalThis.waveformMigrationBaseline.viewport())
  report.cycles = []
  for (let i = 0; i < 30; i++) {
    await page.evaluate((s) => globalThis.waveformMigrationBaseline.mount(s), cycleScenario)
    report.cycles.push(await page.evaluate(() => globalThis.waveformMigrationBaseline.unmount()))
  }
  report.finishedAt = new Date().toISOString()
  await save()
} finally {
  await save()
  await browser.close()
  await new Promise((resolve, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : resolve())),
  )
}
