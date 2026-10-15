import { chromium, firefox, webkit } from 'playwright'
import { build, preview } from 'vite'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const evidence = resolve('openspec/changes/decouple-waveform-engine-from-vue/evidence')
await mkdir(evidence, { recursive: true })
const outDir = await mkdtemp(join(tmpdir(), 'waveform-native-animation-'))
await build({
  build: {
    outDir,
    rolldownOptions: { input: resolve('tests/browser/native-animation-instance.html') },
  },
})
const server = await preview({ build: { outDir }, preview: { port: 5192, strictPort: true } })
const report = { startedAt: new Date().toISOString(), browsers: [] }
let failed = false
try {
  for (const [name, driver] of Object.entries({ chromium, firefox, webkit })) {
    let browser
    const result = { name, errors: [], probes: [] }
    try {
      browser = await driver.launch()
      result.version = browser.version()
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
      page.on('pageerror', (error) => result.errors.push(error.message))
      await page.goto('http://localhost:5192/tests/browser/native-animation-instance.html')
      await page.waitForFunction(() => !!globalThis.nativeAnimationInstanceProbe)
      for (const width of [1200, 360]) {
        result.probes.push(
          await page.evaluate(
            (width) => globalThis.nativeAnimationInstanceProbe(width, false),
            width,
          ),
        )
      }
      await page.emulateMedia({ reducedMotion: 'reduce' })
      result.probes.push(
        await page.evaluate(() => globalThis.nativeAnimationInstanceProbe(360, true)),
      )
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
  await writeFile(
    join(evidence, 'native-animation-instance-browser.json'),
    JSON.stringify(report, null, 2),
  )
  await new Promise((resolve, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : resolve())),
  )
}
console.log(JSON.stringify(report, null, 2))
if (failed) process.exitCode = 1
