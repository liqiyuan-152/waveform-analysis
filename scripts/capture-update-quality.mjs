import { chromium } from 'playwright'
import { cpus, platform, arch } from 'node:os'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { animationBrowserServer } from './animation-browser-server.mjs'
import { preview } from 'vite'

const label = process.argv[2] ?? 'baseline'
if (!/^[a-z-]+$/.test(label)) throw new Error('报告名称只接受小写字母和连字符')
const output = resolve(
  `openspec/changes/optimize-native-waveform-update-and-quality/evidence/${label}.json`,
)
const files = execFileSync('rg', ['--files', 'src', 'scripts', 'tests/browser'], {
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .sort()
const hash = createHash('sha256')
for (const file of files) hash.update(file).update(await readFile(file))
const frozen = process.env.UPDATE_QUALITY_FROZEN
const previewServer = frozen
  ? await preview({
      configFile: false,
      build: { outDir: frozen },
      preview: { port: 5206, strictPort: true },
    })
  : undefined
const server = previewServer
  ? {
      buildMode: 'production',
      close: () => new Promise((resolve) => previewServer.httpServer.close(resolve)),
    }
  : await animationBrowserServer(5206, { quality: resolve('tests/browser/update-quality.html') })
const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] })
const page = await browser.newPage()
const cdp = await page.context().newCDPSession(page)
const report = {
  label,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceSha256: hash.digest('hex'),
  node: process.version,
  browser: browser.version(),
  environment: { platform: platform(), arch: arch(), cpu: cpus()[0]?.model },
  buildMode: server.buildMode,
  warmups: 5,
  runs: 5,
  scenarios: [],
  errors: [],
  memoryNote:
    'CDP JS 堆快照，不代表进程/ArrayBuffer/WASM/SVG/GPU 峰值；分配量和各线程峰值未观测。数据生成和挂载不计入更新耗时；稳定耗时包含 SVG 导出屏障。',
}
page.on('pageerror', (error) => report.errors.push(error.message))
const summarize = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return {
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    min: sorted[0],
    max: sorted.at(-1),
  }
}
try {
  await page.goto('http://localhost:5206/tests/browser/update-quality.html')
  await page.waitForFunction(() => !!globalThis.updateQuality)
  for (const series of [1, 8])
    for (const points of [100000, 1000000])
      for (const input of ['typed', 'objects']) {
        const scenario = { series, points, input, runs: [], heap: [] }
        report.scenarios.push(scenario)
        for (let i = -report.warmups; i < report.runs; i++) {
          await cdp.send('HeapProfiler.collectGarbage')
          const sample = await page.evaluate((s) => globalThis.updateQuality.measure(s), scenario)
          if (i >= 0) {
            scenario.runs.push(sample)
            scenario.heap.push(await cdp.send('Runtime.getHeapUsage'))
          }
        }
        scenario.summary = Object.fromEntries(
          Object.keys(scenario.runs[0]).map((kind) => [
            kind,
            Object.fromEntries(
              Object.keys(scenario.runs[0][kind]).map((metric) => [
                metric,
                summarize(scenario.runs.map((run) => run[kind][metric])),
              ]),
            ),
          ]),
        )
        await writeFile(output, JSON.stringify(report, null, 2) + '\n')
      }
  for (const name of ['vueUpdate', 'geometry']) {
    const samples = []
    for (let i = -report.warmups; i < report.runs; i++) {
      const sample = await page.evaluate((name) => globalThis.updateQuality[name](), name)
      if (i >= 0) samples.push(sample)
    }
    report[name] = {
      samples,
      summary: Object.fromEntries(
        Object.keys(samples[0]).map((key) => [key, summarize(samples.map((s) => s[key]))]),
      ),
    }
  }
  for (const name of ['recovery', 'transport', 'geometryCandidate'])
    if (await page.evaluate((name) => typeof globalThis.updateQuality[name] === 'function', name))
      report[name] = await page.evaluate((name) => globalThis.updateQuality[name](), name)
  if (report.errors.length) throw new Error(report.errors.join('\n'))
} finally {
  await writeFile(output, JSON.stringify(report, null, 2) + '\n')
  await browser.close()
  await server.close()
}
console.log(output)
