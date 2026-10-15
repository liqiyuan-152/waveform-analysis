import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium, firefox, webkit } from 'playwright'
import { build, preview } from 'vite'

const evidence = resolve('openspec/changes/decouple-waveform-engine-from-vue/evidence')
await mkdir(evidence, { recursive: true })
const outDir = await mkdtemp(join(tmpdir(), 'waveform-native-floating-'))
await build({
  build: { outDir, rolldownOptions: { input: resolve('tests/browser/native-floating.html') } },
})
const server = await preview({ build: { outDir }, preview: { port: 5200, strictPort: true } })
const report = { startedAt: new Date().toISOString(), node: process.version, browsers: [] }
let failed = false
try {
  for (const [name, driver] of Object.entries({ chromium, firefox, webkit })) {
    let browser
    const result = { name, probes: [], errors: [] }
    try {
      browser = await driver.launch()
      result.version = browser.version()
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
      page.on('pageerror', (error) => result.errors.push(error.message))
      await page.goto('http://localhost:5200/tests/browser/native-floating.html')
      await page.waitForFunction(() => !!globalThis.nativeFloatingProbe)
      for (const width of [1200, 360]) {
        await page.setViewportSize({ width: width === 360 ? 390 : 1280, height: 900 })
        await page.evaluate((width) => globalThis.nativeFloatingProbe.setup(width), width)
        const annotation = page.locator('#chart-0 .waveform-annotation')
        await annotation.focus()
        await annotation.press('Shift+F10')
        assert.equal(
          await page
            .locator('#chart-0 [role="menuitem"]')
            .first()
            .evaluate((node) => node === node.ownerDocument.activeElement),
          true,
        )
        await page.keyboard.press('ArrowDown')
        assert.equal(
          await page
            .locator('#chart-0 [role="menuitem"]')
            .nth(1)
            .evaluate((node) => node === node.ownerDocument.activeElement),
          true,
        )
        await page.keyboard.press('Home')
        await page.keyboard.press('Escape')
        assert.equal(await page.locator('[role="menu"]').count(), 0)
        assert.equal(
          await annotation.evaluate((node) => node === node.ownerDocument.activeElement),
          true,
        )
        await annotation.press('Enter')
        await page.keyboard.press('Enter')
        await page.locator('dialog[open]').evaluate((node) => {
          node.dataset.owner = 'native-0'
        })
        const dialog = page.locator('dialog[data-owner="native-0"]')
        assert.equal(
          await dialog
            .locator('textarea')
            .evaluate((node) => node === node.ownerDocument.activeElement),
          true,
        )
        const first = dialog.locator('.waveform-modal__close'),
          last = dialog.locator('.waveform-modal__button--primary')
        await last.focus()
        await page.keyboard.press('Tab')
        assert.equal(
          await first.evaluate((node) => node === node.ownerDocument.activeElement),
          true,
        )
        await page.keyboard.press('Shift+Tab')
        assert.equal(await last.evaluate((node) => node === node.ownerDocument.activeElement), true)
        await dialog.locator('textarea').fill('')
        await dialog
          .locator('.waveform-modal__button:not(.waveform-modal__button--primary)')
          .focus()
        await page.keyboard.press('Tab')
        assert.equal(
          await first.evaluate((node) => node === node.ownerDocument.activeElement),
          true,
        )
        await dialog.locator('textarea').fill('浮层验收')
        await page.locator('#outside').evaluate((node) => node.focus())
        assert.equal(
          await dialog
            .locator('textarea')
            .evaluate((node) => node === node.ownerDocument.activeElement),
          true,
        )
        await dialog.screenshot({ path: join(evidence, `native-floating-${name}-${width}.png`) })
        const field = dialog.locator('[aria-label="标注文字色精确值"]')
        await field.focus()
        await page.evaluate(() => globalThis.nativeFloatingProbe.open(1))
        let state = await page.evaluate(() => globalThis.nativeFloatingProbe.state())
        assert.deepEqual(state.dialogs, ['native-0', 'native-1'])
        assert.equal(state.focus.owner, 'native-1')
        await page.keyboard.press('Escape')
        state = await page.evaluate(() => globalThis.nativeFloatingProbe.state())
        assert.deepEqual(state.dialogs, ['native-0'])
        assert.equal(state.focus.label, '标注文字色精确值')
        await page.evaluate(() => globalThis.nativeFloatingProbe.openVue())
        state = await page.evaluate(() => globalThis.nativeFloatingProbe.state())
        assert.deepEqual(state.dialogs, ['native-0', 'vue'])
        const vueDialog = page.locator('dialog[data-owner="vue"]')
        await vueDialog.locator('.vc-color-wrap').first().click()
        const popup = vueDialog.locator('.waveform-modal__popups input').first()
        try {
          await popup.waitFor({ state: 'visible', timeout: 5000 })
        } catch (error) {
          throw new Error(
            `${error}: ${await vueDialog.locator('.waveform-modal__popups').innerHTML()}`,
            { cause: error },
          )
        }
        await popup.focus()
        await page.keyboard.press('Escape')
        await page.evaluate(() => globalThis.nativeFloatingProbe.settle())
        state = await page.evaluate(() => globalThis.nativeFloatingProbe.state())
        assert.deepEqual(state.dialogs, ['native-0', 'vue'])
        assert.equal(state.focus.owner, 'vue')
        await page.keyboard.press('Escape')
        await page.evaluate(() => globalThis.nativeFloatingProbe.settle())
        state = await page.evaluate(() => globalThis.nativeFloatingProbe.state())
        assert.deepEqual(state.dialogs, ['native-0'])
        assert.equal(state.focus.label, '标注文字色精确值')
        await page.evaluate(() => globalThis.nativeFloatingProbe.open(1))
        await page.evaluate(() => globalThis.nativeFloatingProbe.disposeChart(0))
        state = await page.evaluate(() => globalThis.nativeFloatingProbe.state())
        assert.deepEqual(state.dialogs, ['native-1'])
        assert.equal(state.focus.owner, 'native-1')
        assert.equal(state.overflow, 'hidden')
        await page.keyboard.press('Escape')
        state = await page.evaluate(() => globalThis.nativeFloatingProbe.state())
        assert.deepEqual(state.dialogs, [])
        assert.equal(state.overflowX, 'hidden')
        assert.equal(state.overflowY, 'scroll')
        assert.equal(state.overflowXPriority, 'important')
        assert.equal(state.overflowYPriority, 'important')
        assert.equal(state.padding, '7px')
        assert.equal(state.paddingPriority, 'important')
        assert.equal(state.requests, 0)
        result.probes.push({ width, final: state })
        await page.evaluate(() => globalThis.nativeFloatingProbe.dispose())
        assert.equal(await page.locator('dialog, [role="menu"], .waveform-chart').count(), 0)
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
    join(evidence, 'native-floating-browser.json'),
    JSON.stringify(report, null, 2) + '\n',
  )
}
assert.equal(
  failed,
  false,
  'Native floating acceptance failed; see evidence/native-floating-browser.json',
)
