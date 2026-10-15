/* global document */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium, firefox, webkit } from 'playwright'
import { build, preview } from 'vite'

const evidence = resolve('openspec/changes/decouple-waveform-engine-from-vue/evidence')
await mkdir(evidence, { recursive: true })
const outDir = await mkdtemp(join(tmpdir(), 'waveform-native-gestures-'))
await build({
  build: { outDir, rolldownOptions: { input: resolve('tests/browser/native-gestures.html') } },
})
const server = await preview({ build: { outDir }, preview: { port: 5194, strictPort: true } })
const report = {
  startedAt: new Date().toISOString(),
  node: process.version,
  scope: '滚轮/框选/Space 平移及加载回调/远程空响应恢复，Vue 原生事件与状态对照；不包含 hover/标注',
  browsers: [],
}
function comparable(value) {
  if (typeof value === 'number') return Number(value.toPrecision(11))
  if (Array.isArray(value)) return value.map(comparable)
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, comparable(child)]))
  return value
}
async function parity(page, stage, originalSpan = 10) {
  const value = await page.evaluate(() => globalThis.nativeGesturesProbe.snapshot())
  const widths = await page
    .locator('.waveform-chart__overlay')
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().width))
  // Native OS pointer coordinates are rounded by Firefox; permit at most one CSS pixel
  // against the original span. Unit tests compare deterministic inputs exactly.
  const tolerance = originalSpan / Math.min(...widths) + 1e-10
  function close(actual, expected) {
    if (typeof actual === 'number' && typeof expected === 'number') {
      assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `${stage}: ${actual} != ${expected} (1px ${tolerance})`,
      )
      return
    }
    if (Array.isArray(actual) && Array.isArray(expected)) {
      assert.equal(actual.length, expected.length, `${stage} tuple count`)
      actual.forEach((item, index) => close(item, expected[index]))
      return
    }
    if (actual && expected && typeof actual === 'object' && typeof expected === 'object') {
      assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), `${stage} keys`)
      for (const key of Object.keys(actual)) close(actual[key], expected[key])
      return
    }
    assert.deepEqual(actual, expected, `${stage} protocol`)
  }
  try {
    close(comparable(value.native), comparable(value.vue))
    close(comparable(value.nativeEvents), comparable(value.vueEvents))
  } catch (error) {
    ;(report.failures ??= []).push({ stage, value, widths })
    throw error
  }
  value.browserPointerTolerance = tolerance
  return value
}
async function drag(page, id, start, end, space = false) {
  const box = await page.locator(`#${id} .waveform-chart__overlay`).first().boundingBox()
  assert.ok(box && box.width > 0)
  const y = box.y + box.height / 2
  await page.mouse.move(box.x + box.width * start, y)
  if (space) await page.keyboard.down('Space')
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * end, y, { steps: 4 })
  await page.mouse.up()
  if (space) await page.keyboard.up('Space')
}
let failed = false
try {
  for (const [name, driver] of Object.entries({ webkit, chromium, firefox })) {
    let browser
    const result = { name, probes: [], errors: [] }
    try {
      browser = await driver.launch()
      result.version = browser.version()
      const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
      page.on('pageerror', (error) => result.errors.push(error.message))
      await page.goto('http://localhost:5194/tests/browser/native-gestures.html')
      await page.waitForFunction(() => !!globalThis.nativeGesturesProbe)
      for (const width of [1200, 360])
        for (const displayMode of ['independent', 'separated', 'compact']) {
          await page.evaluate(
            ({ width, displayMode }) => globalThis.nativeGesturesProbe.setup(width, displayMode),
            { width, displayMode },
          )
          for (const id of ['native', 'vue']) {
            const box = await page.locator(`#${id} .waveform-chart__overlay`).first().boundingBox()
            assert.ok(box)
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
            await page.mouse.wheel(0, -100)
            // Allow platform input delivery and the 200ms gesture debounce to complete.
            await page.waitForTimeout(300)
            await page
              .waitForFunction(
                (id) =>
                  globalThis.nativeGesturesProbe.snapshot()[`${id}Events`]['zoom-end']?.length ===
                  1,
                id,
                { timeout: 3000, polling: 100 },
              )
              .catch(async (error) => {
                result.inputFailure = {
                  width,
                  displayMode,
                  id,
                  box,
                  snapshot: await page.evaluate(() => globalThis.nativeGesturesProbe.snapshot()),
                  hit: await page.evaluate(
                    ({ x, y }) => document.elementFromPoint(x, y)?.outerHTML,
                    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
                  ),
                }
                throw error
              })
          }
          await page.evaluate(() => globalThis.nativeGesturesProbe.settle())
          await parity(page, 'wheel')
          for (const id of ['native', 'vue']) await drag(page, id, 0.25, 0.75)
          await page.evaluate(() => globalThis.nativeGesturesProbe.settle())
          await parity(page, 'box')
          // Keep pan away from a data boundary. Only the active chart receives temporary Space mode.
          for (const id of ['native', 'vue']) await drag(page, id, 0.5, 0.6, true)
          await page.evaluate(() => globalThis.nativeGesturesProbe.settle())
          const state = await parity(page, 'pan')
          assert.equal(state.nativeEvents['pan-end'].length, 1)
          await page.locator('#native').screenshot({
            path: join(evidence, `native-gesture-${name}-${displayMode}-${width}.png`),
          })
          result.probes.push({ width, displayMode, state })
          await page.evaluate(
            ({ width, displayMode }) => globalThis.nativeGesturesProbe.remote(width, displayMode),
            { width, displayMode },
          )
          for (const id of ['native', 'vue']) {
            const box = await page.locator(`#${id} .waveform-chart__overlay`).first().boundingBox()
            assert.ok(box)
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
            await page.mouse.wheel(0, -100)
            await page.waitForTimeout(300)
            await page.waitForFunction(
              (id) =>
                globalThis.nativeGesturesProbe.snapshot()[`${id}Events`]['zoom-end']?.length === 1,
              id,
              { timeout: 3000, polling: 100 },
            )
          }
          const loaded = await parity(page, 'intent load/reorder', 100)
          assert.equal(loaded.nativeEvents['zoom-end'].length, 1)
          for (const count of [0, 1, 3, 0]) {
            await page.evaluate(
              (count) =>
                globalThis.nativeGesturesProbe.patch({
                  data: globalThis.nativeGesturesProbe.windowData(40, count, ['b', 'a']),
                }),
              count,
            )
            const restored = await parity(page, `remote response ${count}`, 100)
            assert.deepEqual(
              restored.native.targets.map((target) => target.viewport.xDomain),
              loaded.native.targets.map((target) => target.viewport.xDomain),
            )
            assert.equal(restored.nativeEvents['zoom-end'].length, 1)
          }
          for (const id of ['native', 'vue']) await drag(page, id, 0.5, 0.6, true)
          await page.evaluate(() => globalThis.nativeGesturesProbe.settle())
          const remoteState = await parity(page, 'remote empty pan', 100)
          assert.equal(remoteState.nativeEvents['pan-end'].length, 1)
          result.probes.push({ width, displayMode, kind: 'remote-rebind', state: remoteState })
        }
      await page.evaluate(() => globalThis.nativeGesturesProbe.dispose())
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
  await writeFile(join(evidence, 'native-gestures-browser.json'), JSON.stringify(report, null, 2))
  await new Promise((done, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : done())),
  )
}
console.log(JSON.stringify(report, null, 2))
if (failed) process.exitCode = 1
