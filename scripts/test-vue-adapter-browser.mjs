import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium, firefox, webkit } from 'playwright'
import { build, preview } from 'vite'

const evidence = resolve('openspec/changes/decouple-waveform-engine-from-vue/evidence')
await mkdir(evidence, { recursive: true })
const outDir = await mkdtemp(join(tmpdir(), 'waveform-vue-adapter-'))
await build({
  build: { outDir, rolldownOptions: { input: resolve('tests/browser/vue-adapter.html') } },
})
const server = await preview({ build: { outDir }, preview: { port: 5204, strictPort: true } })
const report = { startedAt: new Date().toISOString(), browsers: [] }
function comparable(value) {
  if (typeof value === 'number') return Number(value.toPrecision(12))
  if (Array.isArray(value)) return value.map(comparable)
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, comparable(item)]))
  return value
}
async function parity(page) {
  const values = await page.evaluate(() =>
    ['native', 'vue'].map((id) => globalThis.vueAdapterProbe.snapshot(id)),
  )
  assert.deepEqual(comparable(values[0]), comparable(values[1]))
}
let failed = false
try {
  for (const [name, driver] of Object.entries({ chromium, firefox, webkit })) {
    let browser
    const result = { name, probes: [], errors: [] }
    try {
      browser = await driver.launch()
      result.version = browser.version()
      const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
      page.on('pageerror', (error) => result.errors.push(error.message))
      await page.goto('http://localhost:5204/tests/browser/vue-adapter.html')
      await page.waitForFunction(() => !!globalThis.vueAdapterProbe)
      for (const width of [1200, 360]) {
        await page.setViewportSize({ width: width === 360 ? 390 : 1280, height: 1000 })
        for (const displayMode of ['independent', 'separated', 'compact']) {
          await page.evaluate(
            ({ width, displayMode }) => globalThis.vueAdapterProbe.setup(width, displayMode),
            { width, displayMode },
          )
          await parity(page)
          if (width === 360)
            for (const id of ['native', 'vue'])
              await page.locator(`#${id} [aria-label="图表工具"]`).click()
          for (const id of ['native', 'vue'])
            await page.locator(`#${id} [data-command="pan"]`).click()
          await page.evaluate(() => globalThis.vueAdapterProbe.settle())
          await parity(page)
          assert.equal(
            await page.locator('#vue [data-command="pan"]').getAttribute('aria-pressed'),
            'false',
          )
          await page.evaluate(() => globalThis.vueAdapterProbe.patch({ interactionMode: 'pan' }))
          await parity(page)
          assert.equal(
            await page.locator('#vue [data-command="pan"]').getAttribute('aria-pressed'),
            'true',
          )
          for (const id of ['native', 'vue'])
            await page.locator(`#${id} [data-command="zoom-in"]`).click()
          await page.evaluate(() => globalThis.vueAdapterProbe.settle())
          await parity(page)
          assert.deepEqual(await page.evaluate(() => globalThis.vueAdapterProbe.listenerCalls()), {
            old: 1,
            next: 0,
          })
          await page.evaluate(() => globalThis.vueAdapterProbe.replaceListener())
          for (const id of ['native', 'vue'])
            await page.locator(`#${id} [data-command="zoom-out"]`).click()
          await page.evaluate(() => globalThis.vueAdapterProbe.settle())
          await parity(page)
          assert.deepEqual(await page.evaluate(() => globalThis.vueAdapterProbe.listenerCalls()), {
            old: 1,
            next: 1,
          })
          await page.evaluate(() =>
            globalThis.vueAdapterProbe.patch({ title: undefined, interactionMode: undefined }),
          )
          await parity(page)
          await page.evaluate(() =>
            globalThis.vueAdapterProbe.patch({
              title: { text: '更新后的标题' },
              lineColor: '#dc2626',
            }),
          )
          await parity(page)
          const exported = await page.evaluate(() => globalThis.vueAdapterProbe.export())
          assert.ok(exported.svg.includes('更新后的标题'))
          assert.ok(!exported.svg.includes('foreignObject'))
          await page.screenshot({
            path: join(evidence, `vue-adapter-${name}-${width}-${displayMode}.png`),
          })
          const cleanup = await page.evaluate(() => globalThis.vueAdapterProbe.dispose())
          assert.deepEqual(cleanup, { disposed: true, registered: false, remaining: 0 })
          result.probes.push({ width, displayMode, pass: true })
        }
      }
      assert.deepEqual(result.errors, [])
      result.pass = true
    } catch (error) {
      failed = true
      result.failure = error.stack
    } finally {
      await browser?.close()
    }
    report.browsers.push(result)
  }
} finally {
  await server.httpServer.close()
  report.finishedAt = new Date().toISOString()
  await writeFile(join(evidence, 'vue-adapter-browser.json'), JSON.stringify(report, null, 2))
}
console.log(JSON.stringify(report, null, 2))
if (failed) process.exitCode = 1
