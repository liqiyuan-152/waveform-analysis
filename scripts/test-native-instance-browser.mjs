import { chromium, firefox, webkit } from 'playwright'
import { build, preview } from 'vite'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const evidence = resolve('openspec/changes/decouple-waveform-engine-from-vue/evidence')
await mkdir(evidence, { recursive: true })
const outDir = await mkdtemp(join(tmpdir(), 'waveform-native-smoke-'))
await build({
  build: {
    outDir,
    rolldownOptions: { input: resolve('tests/browser/native-instance-smoke.html') },
  },
})
const server = await preview({ build: { outDir }, preview: { port: 5190, strictPort: true } })
const report = {
  startedAt: new Date().toISOString(),
  node: process.version,
  scope: '基础实例/SVG/PNG/尺寸/销毁；未验证完整迁移功能',
  browsers: [],
}
let failed = false
try {
  for (const [name, driver] of Object.entries({ chromium, firefox, webkit })) {
    let browser
    const result = { name, errors: [] }
    try {
      browser = await driver.launch()
      result.version = browser.version()
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
      page.on('pageerror', (error) => result.errors.push(error.message))
      await page.goto('http://localhost:5190/tests/browser/native-instance-smoke.html')
      await page.waitForFunction(() => !!globalThis.nativeInstanceSmoke)
      await page.evaluate(() => globalThis.nativeInstanceSmoke.stable())
      await page
        .locator('#chart')
        .screenshot({ path: join(evidence, `native-basic-${name}-1200.png`) })
      await page.evaluate(() => globalThis.nativeInstanceSmoke.resize(360))
      await page
        .locator('#chart')
        .screenshot({ path: join(evidence, `native-basic-${name}-360.png`) })
      result.operations = await page.evaluate(() => globalThis.nativeInstanceSmoke.exercise())
      result.lifecycle = await page.evaluate(() => globalThis.nativeInstanceSmoke.cycles())
      result.sampling = await page.evaluate(() => globalThis.nativeInstanceSmoke.samplingProbe())
      result.pagination = []
      for (const layoutPreset of ['default', 'edge-compact']) {
        for (const width of [1200, 360]) {
          result.pagination.push(
            await page.evaluate(
              ({ width, layoutPreset }) =>
                globalThis.nativeInstanceSmoke.pagination(width, layoutPreset),
              { width, layoutPreset },
            ),
          )
          await page
            .locator('#chart')
            .screenshot({
              path: join(evidence, `native-pagination-${name}-${layoutPreset}-${width}.png`),
            })
        }
      }
      result.visualLayers = []
      for (const width of [1200, 360]) {
        result.visualLayers.push(
          await page.evaluate((width) => globalThis.nativeInstanceSmoke.visual(width), width),
        )
        await page
          .locator('#chart')
          .screenshot({ path: join(evidence, `native-layers-${name}-${width}.png`) })
      }
      if (result.errors.length) throw new Error(result.errors.join('; '))
      result.status = 'passed'
    } catch (error) {
      result.status = 'failed'
      result.reason = String(error)
      failed = true
    } finally {
      await browser?.close()
    }
    report.browsers.push(result)
  }
} finally {
  report.finishedAt = new Date().toISOString()
  await writeFile(join(evidence, 'native-instance-browser.json'), JSON.stringify(report, null, 2))
  await new Promise((resolve, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : resolve())),
  )
}
console.log(JSON.stringify(report, null, 2))
if (failed) process.exitCode = 1
