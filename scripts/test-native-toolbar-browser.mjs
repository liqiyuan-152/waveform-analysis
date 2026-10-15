import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium, firefox, webkit } from 'playwright'
import { build, preview } from 'vite'

const evidence = resolve('openspec/changes/decouple-waveform-engine-from-vue/evidence')
await mkdir(evidence, { recursive: true })
const outDir = await mkdtemp(join(tmpdir(), 'waveform-native-toolbar-'))
await build({
  build: { outDir, rolldownOptions: { input: resolve('tests/browser/native-gestures.html') } },
})
const server = await preview({ build: { outDir }, preview: { port: 5201, strictPort: true } })
const report = { startedAt: new Date().toISOString(), browsers: [] }
function comparable(value) {
  if (typeof value === 'number') return Number(value.toPrecision(12))
  if (Array.isArray(value)) return value.map(comparable)
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, comparable(item)]))
  return value
}
async function parity(page) {
  const value = await page.evaluate(() => globalThis.nativeGesturesProbe.controlSnapshot())
  for (const key of ['Events', 'ControlEvents'])
    assert.deepEqual(comparable(value[`native${key}`]), comparable(value[`vue${key}`]))
  assert.deepEqual(comparable(value.native), comparable(value.vue))
  return value
}
async function buttons(page, id) {
  return page.locator(`#${id} [role="toolbar"]`).evaluate((root) => ({
    groups: [...root.querySelectorAll('[data-group]')].map((node) => node.dataset.group),
    buttons: [...root.querySelectorAll('[data-command]')].map((node) => ({
      id: node.dataset.command,
      disabled: node.disabled,
      pressed: node.getAttribute('aria-pressed'),
    })),
    targets: [...root.querySelectorAll('select:not([hidden]) option')].map((node) => ({
      value: node.value,
      text: node.textContent,
    })),
  }))
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
      await page.goto('http://localhost:5201/tests/browser/native-gestures.html')
      await page.waitForFunction(() => !!globalThis.nativeGesturesProbe)
      for (const width of [1200, 360])
        for (const displayMode of ['independent', 'separated', 'compact']) {
          await page.setViewportSize({ width: width === 360 ? 390 : 1280, height: 1000 })
          await page.evaluate(
            ({ width, displayMode }) =>
              globalThis.nativeGesturesProbe.setup(width, displayMode, {
                toolbar: { display: 'always', position: 'top-left' },
                pannable: true,
                interactionMode: 'zoom',
                grid: { rowCount: 1, columnCount: 1 },
              }),
            { width, displayMode },
          )
          assert.deepEqual(await buttons(page, 'native'), await buttons(page, 'vue'))
          for (const id of ['native', 'vue'])
            if (width === 360) await page.locator(`#${id} [aria-label="图表工具"]`).click()
          for (const id of ['native', 'vue'])
            await page.locator(`#${id} [data-command="pan"]`).click()
          await page.evaluate(() => globalThis.nativeGesturesProbe.settle())
          await parity(page)
          assert.equal(
            (await buttons(page, 'native')).buttons.find((item) => item.id === 'pan').pressed,
            'false',
          )
          await page.evaluate(() =>
            globalThis.nativeGesturesProbe.patch({ interactionMode: 'pan' }),
          )
          assert.deepEqual(await buttons(page, 'native'), await buttons(page, 'vue'))
          if (displayMode === 'independent')
            for (const id of ['native', 'vue'])
              await page.locator(`#${id} [aria-label="操作图框"]`).selectOption('a')
          for (const id of ['native', 'vue']) {
            const button = page.locator(`#${id} [data-command="zoom-in"]`)
            await button.focus()
            await button.press('Enter')
          }
          await page.evaluate(() => globalThis.nativeGesturesProbe.settle())
          await parity(page)
          assert.equal(
            await page
              .locator('#vue [data-command="zoom-in"]')
              .evaluate((node) => node === node.ownerDocument.activeElement),
            true,
          )
          for (const command of ['zoom-in', 'zoom-out', 'fit', 'reset']) {
            for (const id of ['native', 'vue']) {
              const button = page.locator(`#${id} [data-command="${command}"]`)
              if (await button.isEnabled()) await button.click()
            }
            await page.evaluate(() => globalThis.nativeGesturesProbe.settle())
            await parity(page)
            assert.deepEqual(await buttons(page, 'native'), await buttons(page, 'vue'))
          }
          const bounds = {}
          for (const id of ['native', 'vue']) {
            const toolbar = page.locator(`#${id} [role="toolbar"]`)
            bounds[id] = await toolbar.evaluate((node) => {
              const box = node.getBoundingClientRect(),
                parent = node.closest('.waveform-chart').getBoundingClientRect()
              return {
                width: box.width,
                height: box.height,
                left: box.left - parent.left,
                top: box.top - parent.top,
              }
            })
            await page.locator(`#${id}`).screenshot({
              path: join(evidence, `native-toolbar-${name}-${width}-${displayMode}-${id}.png`),
            })
            await page.locator(`#${id} [data-command="export"]`).click()
            await page.locator(`#${id} [data-command="export"]`).press('Escape')
            assert.equal(await page.locator(`#${id} [aria-label="图片格式"]:visible`).count(), 0)
          }
          for (const key of ['width', 'height', 'left', 'top'])
            assert.ok(
              Math.abs(bounds.native[key] - bounds.vue[key]) <= 1,
              `${key} differs: ${JSON.stringify(bounds)}`,
            )
          if (displayMode === 'independent') {
            for (const id of ['native', 'vue'])
              await page.locator(`#${id} [aria-label="下一页"]`).click()
            await page.evaluate(() => globalThis.nativeGesturesProbe.settle())
            await parity(page)
            assert.deepEqual(await buttons(page, 'native'), await buttons(page, 'vue'))
          }
          result.probes.push({ width, displayMode, bounds, state: await parity(page) })
          await page.evaluate(() => globalThis.nativeGesturesProbe.dispose())
          assert.equal(await page.locator('[role="toolbar"], .waveform-pagination').count(), 0)
        }
      // Real browser touch input, still independent of physical-device acceptance in stage 11.
      const touch = await browser.newContext({
        viewport: { width: 390, height: 900 },
        hasTouch: true,
      })
      const touchPage = await touch.newPage()
      await touchPage.goto('http://localhost:5201/tests/browser/native-gestures.html')
      await touchPage.waitForFunction(() => !!globalThis.nativeGesturesProbe)
      await touchPage.evaluate(() =>
        globalThis.nativeGesturesProbe.setup(360, 'independent', { toolbar: true, pannable: true }),
      )
      await touchPage.locator('#native [aria-label="图表工具"]').tap()
      await touchPage.locator('#native [data-command="pan"]').tap()
      await touchPage.evaluate(() => globalThis.nativeGesturesProbe.settle())
      assert.equal(
        (await buttons(touchPage, 'native')).buttons.find((item) => item.id === 'pan').pressed,
        'true',
      )
      result.touch = 'passed'
      await touch.close()
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
    join(evidence, 'native-toolbar-browser.json'),
    JSON.stringify(report, null, 2) + '\n',
  )
}
assert.equal(
  failed,
  false,
  'Native toolbar acceptance failed; see evidence/native-toolbar-browser.json',
)
