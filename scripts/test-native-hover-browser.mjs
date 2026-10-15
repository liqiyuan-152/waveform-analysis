/* global document */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { chromium, firefox, webkit } from 'playwright'
import { build, preview } from 'vite'

const evidence = resolve('openspec/changes/decouple-waveform-engine-from-vue/evidence')
await mkdir(evidence, { recursive: true })
const outDir = await mkdtemp(join(tmpdir(), 'waveform-native-hover-'))
await build({
  build: { outDir, rolldownOptions: { input: resolve('tests/browser/native-gestures.html') } },
})
const server = await preview({ build: { outDir }, preview: { port: 5197, strictPort: true } })
const report = {
  startedAt: new Date().toISOString(),
  node: process.version,
  scope:
    '真实鼠标 hover、端点、隐藏、显示开关、跨实例离开、长名称定位和 Vue/native 对照；触摸由单元测试覆盖',
  browsers: [],
}
let failed = false
try {
  for (const [name, driver] of Object.entries({ chromium, firefox, webkit })) {
    const result = { name, probes: [], errors: [] }
    let browser
    try {
      browser = await driver.launch()
      result.version = browser.version()
      const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
      page.on('pageerror', (error) => result.errors.push(error.message))
      await page.goto('http://localhost:5197/tests/browser/native-gestures.html')
      await page.waitForFunction(() => !!globalThis.nativeGesturesProbe)
      for (const width of [1200, 360])
        for (const mode of ['independent', 'separated', 'compact']) {
          await page.evaluate(
            ({ width, mode }) => globalThis.nativeGesturesProbe.hoverSetup(width, mode),
            { width, mode },
          )
          const groups = []
          for (const ratio of [0.05, 0.5, 0.95]) {
            const pair = []
            for (const id of ['native', 'vue']) {
              const overlay = page.locator(`#${id} .waveform-chart__overlay`).first()
              const bounds = await overlay.boundingBox()
              assert.ok(bounds && bounds.width > 0)
              await page.mouse.move(bounds.x + bounds.width * ratio, bounds.y + bounds.height / 2)
              await page.evaluate(() => globalThis.nativeGesturesProbe.settle())
              const value = await page.evaluate(
                (id) => globalThis.nativeGesturesProbe.hoverSnapshot(id),
                id,
              )
              assert.ok(
                value.point && value.values.length > 0,
                `${name}/${mode}/${width}/${ratio}/${id} populated`,
              )
              assert.equal(value.crosshairs, mode === 'independent' ? 1 : 2)
              assert.ok(value.placement && value.placement.left >= 7.5)
              assert.ok(value.placement.right <= value.placement.containerWidth - 7.5)
              assert.ok(value.placement.top >= 7.5)
              assert.ok(value.placement.bottom <= value.placement.containerHeight - 7.5)
              pair.push(value)
            }
            for (const key of ['point', 'labels', 'values', 'crosshairs'])
              assert.deepEqual(
                pair[0][key],
                pair[1][key],
                `${name}/${mode}/${width}/${ratio}/${key}`,
              )
            groups.push({ ratio, pair })
          }
          await page.evaluate(() =>
            globalThis.nativeGesturesProbe.patch({ hiddenSeriesIds: ['b'] }),
          )
          for (const id of ['native', 'vue']) {
            const bounds = await page
              .locator(`#${id} .waveform-chart__overlay`)
              .first()
              .boundingBox()
            await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height / 2)
            await page.evaluate(() => globalThis.nativeGesturesProbe.settle())
            const value = await page.evaluate(
              (id) => globalThis.nativeGesturesProbe.hoverSnapshot(id),
              id,
            )
            assert.equal(value.values.length, 1)
            assert.equal(value.crosshairs, 1)
          }
          await page.evaluate(() => globalThis.nativeGesturesProbe.patch({ showTooltip: false }))
          for (const id of ['native', 'vue']) {
            const bounds = await page
              .locator(`#${id} .waveform-chart__overlay`)
              .first()
              .boundingBox()
            await page.mouse.move(bounds.x + bounds.width * 0.55, bounds.y + bounds.height / 2)
            await page.evaluate(() => globalThis.nativeGesturesProbe.settle())
            const value = await page.evaluate(
              (id) => globalThis.nativeGesturesProbe.hoverSnapshot(id),
              id,
            )
            assert.ok(value.point)
            assert.equal(value.placement, null)
            assert.equal(value.crosshairs, 0)
          }
          await page.mouse.move(1279, 999)
          await page.evaluate(() => globalThis.nativeGesturesProbe.settle())
          for (const id of ['native', 'vue']) {
            const value = await page.evaluate(
              (id) => globalThis.nativeGesturesProbe.hoverSnapshot(id),
              id,
            )
            assert.equal(value.point, null)
            assert.equal(value.placement, null)
          }
          await page.evaluate(() =>
            globalThis.nativeGesturesProbe.patch({ showTooltip: true, hiddenSeriesIds: [] }),
          )
          const bounds = await page
            .locator('#native .waveform-chart__overlay')
            .first()
            .boundingBox()
          await page.mouse.move(bounds.x + bounds.width * 0.95, bounds.y + bounds.height / 2)
          await page.evaluate(() => globalThis.nativeGesturesProbe.settle())
          await page.screenshot({
            path: join(evidence, `native-hover-${name}-${width}-${mode}.png`),
          })
          result.probes.push({ width, mode, groups })
          await page.evaluate(() => globalThis.nativeGesturesProbe.patch({ panXDomain: [-10, 10] }))
          await page.evaluate(() => globalThis.nativeGesturesProbe.domain([5, 6]))
          const remote = []
          let clipped
          for (const id of ['native', 'vue']) {
            const bounds = await page
              .locator(`#${id} .waveform-chart__overlay`)
              .first()
              .boundingBox()
            await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height / 2)
            await page.evaluate(() => globalThis.nativeGesturesProbe.settle())
            const value = await page.evaluate(
              (id) => globalThis.nativeGesturesProbe.hoverSnapshot(id),
              id,
            )
            assert.equal(value.values[0], '(x:1,000 y:3)')
            remote.push(value)
            if (id === 'native') {
              clipped = await page
                .locator('#native .waveform-chart__crosshair')
                .first()
                .evaluate((line) => {
                  const id = line.getAttribute('clip-path').slice(5, -1)
                  return { x: Number(line.getAttribute('x1')), clip: !!document.getElementById(id) }
                })
            }
          }
          assert.deepEqual(remote[0].values, remote[1].values)
          assert.ok(clipped.x < 0 && clipped.clip)
          result.probes.at(-1).remote = { values: remote.map((value) => value.values), clipped }
          await page.evaluate(() => globalThis.nativeGesturesProbe.dispose())
          assert.equal(await page.locator('.waveform-chart').count(), 0)
        }
      assert.deepEqual(result.errors, [])
      result.status = 'passed'
    } catch (error) {
      failed = true
      result.status = 'failed'
      result.error = String(error.stack ?? error)
    } finally {
      await browser?.close()
    }
    report.browsers.push(result)
  }
} finally {
  await server.httpServer.close()
  report.finishedAt = new Date().toISOString()
  await writeFile(
    join(evidence, 'native-hover-browser.json'),
    JSON.stringify(report, null, 2) + '\n',
  )
}
assert.equal(
  failed,
  false,
  'Native hover browser acceptance failed; see evidence/native-hover-browser.json',
)
