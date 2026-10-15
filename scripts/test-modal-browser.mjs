/* global window, document, getComputedStyle */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, firefox, webkit } from 'playwright'
import { createServer } from 'vite'

const evidence = resolve(process.env.WAVEFORM_MODAL_EVIDENCE_DIR ?? '/tmp/waveform-modal')
await mkdir(evidence, { recursive: true })
const server = await createServer({ server: { port: 5214, strictPort: true } })
await server.listen()
const report = []
try {
  for (const [name, driver] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await driver.launch()
    try {
      for (const viewport of [
        { width: 1200, height: 900 },
        { width: 360, height: 800 },
        { width: 360, height: 400 },
      ]) {
        const page = await browser.newPage({ viewport })
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto('http://localhost:5214/tests/browser/native-modal.html')
        const open = page.getByRole('button', { name: '编辑标注', exact: true })
        await open.focus()
        await open.press('Enter')
        const dialog = page.getByRole('dialog')
        const panel = dialog.locator('.waveform-modal__panel')
        const text = dialog.getByRole('textbox', { name: '标注文本', exact: true })
        await page.waitForTimeout(350)
        assert.equal(await text.evaluate((node) => node === document.activeElement), true)
        const metrics = await panel.evaluate((node) => {
          const rect = node.getBoundingClientRect(),
            style = getComputedStyle(node)
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            radius: style.borderRadius,
            padding: style.padding,
            headerBorder: getComputedStyle(node.querySelector('header')).borderBottomWidth,
            footerBorder: getComputedStyle(node.querySelector('footer')).borderTopWidth,
          }
        })
        assert.equal(metrics.width, Math.min(440, viewport.width - 16))
        assert.equal(
          metrics.y,
          (viewport.height <= 700 ? 24 : 100) + (viewport.width <= 767 ? 8 : 0),
        )
        assert.equal(metrics.radius, '2px')
        assert.equal(metrics.padding, '0px')
        assert.equal(metrics.headerBorder, '1px')
        assert.equal(metrics.footerBorder, '1px')
        assert.equal(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth), true)
        const key = `${name}-${viewport.width}x${viewport.height}`
        await page.screenshot({ path: `${evidence}/${key}-default.png` })
        const series = dialog.getByRole('combobox', { name: '选择标注波形' })
        await series.click()
        const option = dialog.getByRole('option', { name: 'Channel b (V)' })
        assert.equal(
          await option.evaluate((node) => {
            const r = node.getBoundingClientRect()
            return node.contains(document.elementFromPoint(r.x + 10, r.y + r.height / 2))
          }),
          true,
        )
        await series.press('ArrowDown')
        await series.press('Tab')
        assert.equal(await series.textContent(), 'Channel b (V)')
        assert.equal(await series.evaluate((node) => node === document.activeElement), true)
        await series.press('Tab')
        assert.equal(await text.evaluate((node) => node === document.activeElement), true)
        const time = dialog.getByRole('spinbutton', { name: '标注横轴时间' })
        await time.fill('9999')
        await text.focus()
        assert.equal(await dialog.getByRole('alert').textContent(), '时间超出当前波形范围')
        assert.equal(await dialog.getByRole('button', { name: '保存标注' }).isDisabled(), true)
        await time.scrollIntoViewIfNeeded()
        await page.screenshot({ path: `${evidence}/${key}-error.png` })
        await time.fill('1000')
        await text.fill('标注验收')
        const swatch = dialog.getByRole('button', { name: '标注边框色', exact: true })
        await swatch.click()
        const popup = dialog.locator('.waveform-color-popup')
        const bounds = await popup.boundingBox()
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width)
        assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= viewport.height)
        assert.equal(
          await popup.evaluate((node) => {
            const r = node.getBoundingClientRect()
            return node.contains(document.elementFromPoint(r.x + 20, r.y + 20))
          }),
          true,
        )
        await page.screenshot({ path: `${evidence}/${key}-color.png` })
        await page.keyboard.press('Escape')
        assert.equal(await popup.count(), 0)
        assert.equal(await swatch.evaluate((node) => node === document.activeElement), true)
        await page.keyboard.press('Escape')
        await dialog.waitFor({ state: 'detached' })
        assert.equal(await open.evaluate((node) => node === document.activeElement), true)
        assert.equal(await page.evaluate(() => window.modalFixture.cancelled()), 1)
        assert.equal(await page.evaluate(() => document.body.style.overflow), '')
        // Empty panel margins must not masquerade as the mask; actual mask clicks dismiss.
        await open.click()
        await panel.click({ position: { x: 5, y: 5 } })
        assert.equal(await dialog.count(), 1)
        await page.mouse.click(2, 2)
        await dialog.waitFor({ state: 'detached' })
        await open.click()
        await page.evaluate(() => window.modalFixture.single(true))
        assert.equal(await series.count(), 1)
        assert.equal(
          await dialog.locator('.waveform-annotation-editor__series-label').isVisible(),
          true,
        )
        const save = dialog.getByRole('button', { name: '保存标注' })
        await save.scrollIntoViewIfNeeded()
        await save.focus()
        await page.keyboard.press('Tab')
        assert.equal(
          await dialog
            .getByRole('button', { name: '关闭', exact: true })
            .evaluate((node) => node === document.activeElement),
          true,
        )
        await text.fill('保存一次')
        await text.press('Control+Enter')
        assert.equal(await dialog.getAttribute('aria-busy'), 'true')
        await page.evaluate(() =>
          document.querySelector('.waveform-modal__button--primary').click(),
        )
        await dialog.waitFor({ state: 'detached' })
        assert.equal(await page.evaluate(() => window.modalFixture.saved.length), 1)
        // A changing dataset is revalidated at the end of the leave transition.
        await open.click()
        await text.press('Control+Enter')
        await page.evaluate(() => window.modalFixture.invalidate())
        await page.waitForTimeout(400)
        assert.equal(await dialog.count(), 1)
        assert.equal(await dialog.getByRole('alert').isVisible(), true)
        assert.equal(await dialog.getAttribute('aria-busy'), null)
        assert.equal(await page.evaluate(() => window.modalFixture.saved.length), 1)
        await page.keyboard.press('Escape')
        await page.evaluate(() => window.modalFixture.dispose())
        await page.waitForTimeout(400)
        assert.equal(await page.locator('dialog, .waveform-popup').count(), 0)
        assert.equal(await page.evaluate(() => window.modalFixture.cancelled()), 2)
        // Reduced motion skips both the animation and deferred close callback.
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await open.click()
        assert.equal(await dialog.getAttribute('data-motion'), null)
        await page.keyboard.press('Escape')
        assert.equal(await page.locator('dialog').count(), 0)
        // Pause a desktop entrance at a known scale so both pointer events hit
        // the same moving target; cancelling on pointerdown would move it away.
        if (viewport.width === 1200) {
          await page.emulateMedia({ reducedMotion: 'no-preference' })
          await open.press('Enter')
          await panel.evaluate((node) => {
            for (const animation of node.getAnimations()) {
              animation.pause()
              animation.currentTime = 75
            }
          })
          const moving = await swatch.boundingBox()
          await page.mouse.click(moving.x + moving.width / 2, moving.y + moving.height / 2)
          await popup.waitFor()
          await page.keyboard.press('Escape')
          await page.keyboard.press('Escape')
          await dialog.waitFor({ state: 'detached' })
        }
        assert.deepEqual(errors, [])
        report.push({ browser: name, ...viewport, status: 'passed', metrics })
        await page.close()
      }
    } finally {
      await browser.close()
    }
  }
} finally {
  await server.close()
  await writeFile(`${evidence}/report.json`, JSON.stringify(report, null, 2))
}
console.log(JSON.stringify(report, null, 2))
