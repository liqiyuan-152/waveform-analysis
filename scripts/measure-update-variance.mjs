import { preview } from 'vite'
import { chromium } from 'playwright'
import { readFile, writeFile } from 'node:fs/promises'

const [baselineDirectory, optimizedDirectory] = process.argv.slice(2)
if (!baselineDirectory || !optimizedDirectory)
  throw new Error('Pass both frozen production directories.')
const browser = await chromium.launch()
const rows = []
try {
  for (const [label, outDir] of [
    ['baseline', baselineDirectory],
    ['optimized', optimizedDirectory],
  ]) {
    const server = await preview({
      configFile: false,
      build: { outDir },
      preview: { port: 5209, strictPort: true },
    })
    try {
      const page = await browser.newPage()
      const cdp = await page.context().newCDPSession(page)
      await page.goto('http://localhost:5209/tests/browser/update-quality.html')
      await page.waitForFunction(() => !!globalThis.updateQuality)
      for (const scenario of [
        { series: 1, points: 1000000, input: 'objects' },
        { series: 8, points: 100000, input: 'objects' },
      ]) {
        const samples = []
        for (let run = -1; run < 10; run++) {
          await cdp.send('HeapProfiler.collectGarbage')
          const sample = await page.evaluate(
            (scenario) => globalThis.updateQuality.measure(scenario),
            scenario,
          )
          if (run >= 0) samples.push(sample)
        }
        rows.push({ label, outDir, scenario, samples })
      }
      await page.close()
    } finally {
      await new Promise((resolve) => server.httpServer.close(resolve))
    }
  }
  const report = JSON.parse(
    await readFile(
      'openspec/changes/optimize-native-waveform-update-and-quality/evidence/optimized.json',
      'utf8',
    ),
  )
  await writeFile(
    'openspec/changes/optimize-native-waveform-update-and-quality/evidence/variance-check.json',
    JSON.stringify(
      {
        browser: browser.version(),
        comparisonSourceHashes: [
          JSON.parse(
            await readFile(
              'openspec/changes/optimize-native-waveform-update-and-quality/evidence/baseline-corrected.json',
              'utf8',
            ),
          ).sourceSha256,
          report.sourceSha256,
        ],
        rows,
      },
      null,
      2,
    ) + '\n',
  )
} finally {
  await browser.close()
}
