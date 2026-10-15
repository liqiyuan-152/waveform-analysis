import { chromium, firefox, webkit } from 'playwright'
import { createServer } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { verifyExampleFeatures, verifyExampleInstances } from './verify-native-example-features.mjs'

const evidence = resolve('openspec/changes/decouple-waveform-engine-from-vue/evidence')
await mkdir(evidence, { recursive: true })
// Development is intentional: React only replays Strict Mode effects in development.
const server = await createServer({ server: { port: 5191, strictPort: true } })
await server.listen()
const report = {
  startedAt: new Date().toISOString(),
  node: process.version,
  mode: 'development; React Strict Mode effect replay enabled',
  scope: '三种 DOM ref 消费者、受控状态、缩放、标注、导出、多实例和生命周期',
  results: [],
}
let failed = false
try {
  for (const [name, driver] of Object.entries({ chromium, firefox, webkit })) {
    let browser
    try {
      browser = await driver.launch()
      for (const framework of ['vanilla', 'react', 'vue']) {
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
        await page.addInitScript(() => {
          const create = URL.createObjectURL.bind(URL)
          const revoke = URL.revokeObjectURL.bind(URL)
          globalThis.exampleObjectUrls = new Set()
          URL.createObjectURL = (blob) => {
            const url = create(blob)
            globalThis.exampleObjectUrls.add(url)
            return url
          }
          URL.revokeObjectURL = (url) => {
            globalThis.exampleObjectUrls.delete(url)
            revoke(url)
          }
        })
        const result = { browser: name, version: browser.version(), framework, errors: [] }
        page.on('pageerror', (error) => result.errors.push(error.message))
        try {
          await page.goto(`http://localhost:5191/examples/${framework}/`)
          await page.waitForFunction(() => globalThis.nativeExample?.snapshot().frames > 0)
          result.initial = await page.evaluate(() => globalThis.nativeExample.snapshot())
          if (result.initial.registered !== 1 || result.initial.roots !== 1)
            throw new Error('Duplicate native chart')
          if (
            framework === 'react' &&
            (result.initial.creates !== 2 || result.initial.disposals !== 1)
          )
            throw new Error('Strict Mode effect replay was not verified')
          await page
            .locator('.example-host')
            .screenshot({ path: join(evidence, `example-${framework}-${name}-desktop.png`) })
          const previous = result.initial.frames
          await page.getByRole('button', { name: '更新回调' }).click()
          await page.getByRole('button', { name: '替换数据' }).click()
          await page.waitForFunction((frames) => {
            // Sampling can commit extra frames for the preceding revision.
            // Wait for the requested callback and data, not any later frame.
            const state = globalThis.nativeExample.snapshot()
            return state.frames > frames && state.callbackVersion === 1 && state.domain?.[0] === 1
          }, previous)
          result.updated = await page.evaluate(() => globalThis.nativeExample.snapshot())
          if (result.updated.callbackVersion !== 1 || result.updated.domain?.[0] !== 1)
            throw new Error('Stale callback or stale data')
          result.features = await verifyExampleFeatures(page)
          await page.setViewportSize({ width: 390, height: 844 })
          await page.getByRole('button', { name: '切换宽度' }).click()
          await page.waitForFunction(() => {
            const host = globalThis.document.querySelector('.example-host')
            const root = host?.querySelector('.waveform-native-chart')
            return (
              host?.getBoundingClientRect().width === 360 &&
              Number(root?.querySelector('svg')?.getAttribute('width')) === root?.clientWidth
            )
          })
          await page
            .locator('.example-host')
            .screenshot({ path: join(evidence, `example-${framework}-${name}-360.png`) })
          await page.getByRole('button', { name: '挂载 / 卸载' }).click()
          await page.waitForFunction(() => globalThis.nativeExample.snapshot().roots === 0)
          result.unmounted = await page.evaluate(() => globalThis.nativeExample.snapshot())
          if (
            result.unmounted.registered !== 0 ||
            result.unmounted.creates !== result.unmounted.disposals
          )
            throw new Error('Unmount residue')
          await page.getByRole('button', { name: '挂载 / 卸载' }).click()
          await page.waitForFunction(
            () =>
              globalThis.nativeExample.snapshot().roots === 1 &&
              globalThis.nativeExample.snapshot().registered === 1,
          )
          result.remounted = await page.evaluate(() => globalThis.nativeExample.snapshot())
          result.instances = await verifyExampleInstances(page)
          if (result.errors.length) throw new Error(result.errors.join('; '))
          result.status = 'passed'
        } catch (error) {
          result.status = 'failed'
          result.reason = String(error)
          failed = true
        } finally {
          await page.close()
        }
        report.results.push(result)
        console.log(
          `${name}/${framework}: ${result.status}${result.reason ? ` — ${result.reason}` : ''}`,
        )
      }
    } catch (error) {
      report.results.push({ browser: name, status: 'failed', reason: String(error) })
      failed = true
    } finally {
      await browser?.close()
    }
  }
} finally {
  report.finishedAt = new Date().toISOString()
  await server.close()
  await writeFile(join(evidence, 'native-examples-browser.json'), JSON.stringify(report, null, 2))
}
console.log(JSON.stringify(report, null, 2))
if (failed) process.exitCode = 1
