import { monitorBrowserRss } from './browser-process-memory.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { cpus, platform, arch } from 'node:os'
import { chromium } from 'playwright'
import { animationBrowserServer } from './animation-browser-server.mjs'
import { animationBuildInputs } from './animation-build-inputs.mjs'
const measureRss = process.argv.includes('--rss')
const filename = measureRss ? 'sampling-memory-rss.json' : 'sampling-memory.json'
const evidence = process.argv[2]
if (!evidence) throw new Error('Supply evidence directory')
await mkdir(evidence, { recursive: true })
const server = await animationBrowserServer(
  5212,
  { quality: resolve('tests/browser/update-quality.html') },
  { benchmark: false },
)
let browser
const report = {
  rssScope: measureRss
    ? 'Sum of this Chromium browser process RSS sampled every ~50ms and at boundaries. Includes renderer/Worker/WASM resident pages; shared pages can be counted repeatedly. Observed sampled maximum, not exact physical peak; harness snapshot retention is identical in both variants.'
    : 'Not sampled',
  source: animationBuildInputs().sha256,
  node: process.version,
  environment: { platform: platform(), arch: arch(), cpu: cpus()[0]?.model },
  warmups: 5,
  runs: 20,
  memoryScope:
    'Main thread JS heap checkpoints and post-disposal CDP heap, explicit transport buffers and Worker index metrics. Does not measure full process/WASM/GPU peak. Harness retains snapshots until each cycle ends to check no detach.',
  scenarios: [],
  errors: [],
}
try {
  browser = await chromium.launch({ args: ['--enable-precise-memory-info'] })
  report.browser = browser.version()
  const page = await browser.newPage()
  const cdp = await page.context().newCDPSession(page)
  page.on('pageerror', (error) => report.errors.push(error.message))
  await page.goto('http://localhost:5212/tests/browser/update-quality.html')
  await page.waitForFunction(() => !!globalThis.updateQuality)
  const scenarios = [
    ...['objects', 'typed', 'samples'].flatMap((input) =>
      [100_000, 1_000_000].map((points) => ({ input, points, series: 1, instances: 1 })),
    ),
    { input: 'objects', points: 100_000, series: 8, instances: 1 },
    { input: 'typed', points: 100_000, series: 8, instances: 2 },
    { input: 'samples', points: 1_000_000, series: 8, instances: 1 },
    { input: 'samples', points: 1_000_000, series: 1, instances: 2 },
  ]
  for (const scenario of scenarios.filter(
    (scenario) =>
      !measureRss ||
      (scenario.points === 1_000_000 &&
        scenario.instances === 1 &&
        (scenario.input === 'typed' || (scenario.input === 'samples' && scenario.series === 8))),
  ))
    for (const transfer of scenario.input === 'objects' ? [false] : [false, true]) {
      const entry = { ...scenario, transfer, runs: [] }
      report.scenarios.push(entry)
      for (let run = -5; run < 20; run++) {
        await cdp.send('HeapProfiler.collectGarbage')
        const stopRss = measureRss ? await monitorBrowserRss(browser) : undefined
        let measured, rss
        try {
          measured = await page.evaluate((s) => globalThis.updateQuality.measureSamplingMemory(s), {
            ...scenario,
            transfer,
          })
        } finally {
          rss = await stopRss?.()
        }
        if (rss) measured.rss = rss
        await cdp.send('HeapProfiler.collectGarbage')
        const afterDisposal = await cdp.send('Runtime.getHeapUsage')
        if (run >= 0) entry.runs.push({ ...measured, afterDisposal })
      }
      await writeFile(`${evidence}/${filename}`, JSON.stringify(report, null, 2) + '\n')
      console.log(
        `Measured ${scenario.input} ${scenario.points}x${scenario.series}x${scenario.instances}, transfer=${transfer}`,
      )
    }
  if (report.errors.length) throw new Error(report.errors.join('\n'))
} finally {
  await writeFile(`${evidence}/${filename}`, JSON.stringify(report, null, 2) + '\n')
  await browser?.close()
  await server.close()
}
