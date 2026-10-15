import { chromium } from 'playwright'
import { build, preview } from 'vite'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'

const evidence = resolve('openspec/changes/decouple-waveform-engine-from-vue/evidence')
const outDir = await mkdtemp(join(tmpdir(), 'waveform-pagination-parity-'))
await build({
  build: {
    outDir,
    rolldownOptions: { input: resolve('tests/browser/native-pagination-parity.html') },
  },
})
const server = await preview({ build: { outDir }, preview: { port: 5192, strictPort: true } })
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.goto('http://localhost:5192/tests/browser/native-pagination-parity.html')
  await page.waitForFunction(() => !!globalThis.paginationParity)
  const results = []
  for (const preset of ['default', 'edge-compact']) {
    const result = await page.evaluate(
      (preset) => globalThis.paginationParity.compare(preset),
      preset,
    )
    for (const layer of ['label', 'pagination', 'svg']) {
      for (const metric of ['x', 'y', 'width', 'height']) {
        assert.ok(
          Math.abs(result.vue[layer][metric] - result.native[layer][metric]) <= 1,
          `${preset}/${layer}/${metric} differs by more than 1 CSS pixel`,
        )
      }
    }
    assert.equal(result.vue.overlap, result.native.overlap)
    results.push(result)
    await page.screenshot({ path: join(evidence, `pagination-parity-${preset}-360.png`) })
  }
  await writeFile(
    join(evidence, 'pagination-visual-parity.json'),
    JSON.stringify(
      {
        browser: browser.version(),
        results,
      },
      null,
      2,
    ),
  )
  console.log(JSON.stringify(results, null, 2))
} finally {
  await browser.close()
  await new Promise((resolve, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : resolve())),
  )
}
