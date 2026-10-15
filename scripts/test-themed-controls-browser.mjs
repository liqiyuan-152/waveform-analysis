/* global window, document, getComputedStyle, requestAnimationFrame */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, firefox, webkit } from 'playwright'
import { createServer } from 'vite'

const evidence = resolve(
  process.env.WAVEFORM_THEMED_EVIDENCE_DIR ?? '/tmp/waveform-themed-controls',
)
await mkdir(evidence, { recursive: true })
const server = await createServer({ server: { port: 5207, strictPort: true } })
await server.listen()
const report = []
try {
  for (const [name, driver] of Object.entries({ chromium, firefox, webkit }).filter(
    ([name]) =>
      !process.env.WAVEFORM_THEMED_BROWSER || name === process.env.WAVEFORM_THEMED_BROWSER,
  )) {
    const browser = await driver.launch()
    try {
      for (const width of [1200, 360].filter(
        (width) =>
          !process.env.WAVEFORM_THEMED_WIDTH || width === Number(process.env.WAVEFORM_THEMED_WIDTH),
      )) {
        const page = await browser.newPage({ viewport: { width, height: 900 } })
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto('http://localhost:5207/tests/browser/native-themed-controls.html')
        const toggle = page.getByRole('button', { name: '图表工具', exact: true })
        if (width === 360) await toggle.click()
        await page.screenshot({ path: `${evidence}/${name}-${width}-states.png` })
        const target = page.getByRole('combobox', { name: '操作图框' })
        assert.deepEqual(
          await target.evaluate((node) => {
            const style = getComputedStyle(node)
            return [style.height, style.borderRadius, style.fontSize]
          }),
          ['32px', '6px', '14px'],
        )
        await target.hover()
        await page.screenshot({ path: `${evidence}/${name}-${width}-hover.png` })
        await target.focus()
        await page.screenshot({ path: `${evidence}/${name}-${width}-focus.png` })
        await target.click()
        await page.screenshot({ path: `${evidence}/${name}-${width}-select.png` })
        await page.getByRole('option', { name: 'Channel b', exact: true }).click()
        assert.match(await target.textContent(), /Channel b/)
        await target.click()
        await page.keyboard.press('Home')
        await page.keyboard.press('Enter')
        await page.locator('.waveform-annotation__box').click({ button: 'right' })
        await page.getByRole('menuitem', { name: '编辑标注', exact: true }).click()
        const dialog = page.locator('dialog[open]')
        const series = dialog.getByRole('combobox', { name: '选择标注波形' })
        await series.click()
        await page.keyboard.press('Escape')
        assert.equal(await dialog.count(), 1)
        const swatch = dialog.getByRole('button', { name: '标注边框色', exact: true })
        await swatch.click()
        const panel = dialog.locator('.waveform-color-popup')
        await panel.waitFor()
        assert.equal(await panel.evaluate((node) => getComputedStyle(node).padding), '12px')
        const swatchSize = await swatch.boundingBox()
        assert.equal(swatchSize.height, 32)
        assert.ok(swatchSize.width > 32)
        assert.deepEqual(
          await panel.locator('.waveform-color-panel__area').evaluate((node) => {
            const rect = node.getBoundingClientRect()
            return [rect.width, rect.height]
          }),
          [234, 160],
        )
        assert.equal(
          await panel
            .locator('.waveform-color-panel__format')
            .evaluate((node) => node.getBoundingClientRect().height),
          24,
        )
        const bounds = await panel.boundingBox()
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width)
        const hittable = await panel.evaluate((node) => {
          const rect = node.getBoundingClientRect()
          return node.contains(document.elementFromPoint(rect.x + 20, rect.y + 20))
        })
        assert.equal(hittable, true)
        const alpha = panel.getByLabel('标注边框色透明度', { exact: true })
        await alpha.fill('12.3456')
        assert.equal(
          await panel.getByLabel('标注边框色精确值', { exact: true }).inputValue(),
          '123456',
        )
        const format = panel.getByRole('combobox', { name: '标注边框色颜色格式' })
        await format.click()
        await page.getByRole('option', { name: 'RGB', exact: true }).click()
        assert.equal(await panel.count(), 1)
        await format.click()
        await page.getByRole('option', { name: 'HEX', exact: true }).click()
        await panel.getByLabel('标注边框色精确值', { exact: true }).fill('#')
        assert.equal(await dialog.getByRole('button', { name: '保存标注' }).isDisabled(), true)
        await panel.getByLabel('标注边框色精确值', { exact: true }).fill('#12345600')
        const area = panel.getByRole('slider', { name: '标注边框色饱和度和明度' })
        await area.focus()
        await page.keyboard.press('ArrowRight')
        await page.keyboard.press('ArrowUp')
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        )
        const box = await area.boundingBox()
        await page.mouse.move(box.x + 30, box.y + 30)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.4)
        await page.mouse.up()
        if (name === 'chromium' && width === 360) {
          const touchBox = await area.boundingBox()
          const touch = await page.context().newCDPSession(page)
          await touch.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: touchBox.x + 10, y: touchBox.y + 10 }],
          })
          await touch.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [
              { x: touchBox.x + touchBox.width * 0.75, y: touchBox.y + touchBox.height * 0.5 },
            ],
          })
          await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
          assert.ok(
            Math.abs(Number(await area.getAttribute('aria-valuenow')) - 75) <= 1,
            JSON.stringify({
              value: await area.getAttribute('aria-valuenow'),
              before: box,
              after: await area.boundingBox(),
            }),
          )
          await touch.detach()
        }
        await alpha.fill('12.3456')
        await page.screenshot({ path: `${evidence}/${name}-${width}-color.png` })
        await format.click()
        await page.keyboard.press('Escape')
        assert.equal(await panel.count(), 1)
        await page.keyboard.press('Escape')
        assert.equal(await panel.count(), 0)
        assert.equal(
          await swatch.evaluate((node) => node === node.ownerDocument.activeElement),
          true,
        )
        assert.equal(await dialog.count(), 1)
        await swatch.click()
        await panel.getByLabel('标注边框色精确值', { exact: true }).fill('not a color')
        await page.keyboard.press('Escape')
        assert.equal(await dialog.getByRole('button', { name: '保存标注' }).isDisabled(), true)
        await swatch.click()
        await panel
          .getByLabel('标注边框色精确值', { exact: true })
          .fill('rgba(18.25, 52.5, 86.75, 0.123456)')
        await dialog.getByLabel('标注文本', { exact: true }).fill('保存验证')
        await dialog.getByRole('button', { name: '保存标注', exact: true }).click()
        await dialog.waitFor({ state: 'detached' })
        const result = await page.evaluate(() => ({
          replacements: window.themedControls.replacements,
          gestures: window.themedControls.gestures(),
        }))
        assert.equal(
          result.replacements[0][0].style.borderColor,
          'rgba(18.25, 52.5, 86.75, 0.123456)',
        )
        assert.equal(result.gestures, 0)
        await page.evaluate(() => window.themedControls.dispose())
        assert.equal(await page.locator('.waveform-popup, dialog').count(), 0)
        assert.deepEqual(errors, [])
        report.push({ browser: name, width, bounds, native: 'passed' })
        // The production Vue adapter must render the same native controls under global antd CSS.
        await page.goto('http://localhost:5207/')
        await page.locator('.waveform-chart__overlay').first().waitFor()
        const demoToggle = page.getByRole('button', { name: '图表工具', exact: true })
        if (await demoToggle.isVisible()) {
          await demoToggle.focus()
          await demoToggle.click()
        }
        const demoTarget = page.getByRole('combobox', { name: '操作图框' })
        await demoTarget.focus()
        await demoTarget.press('Enter')
        await page.getByRole('listbox', { name: '操作图框' }).waitFor()
        await page.screenshot({ path: `${evidence}/${name}-${width}-demo.png` })
        await page.keyboard.press('Escape')
        await page.locator('[data-command="annotate"]').click()
        if (await demoToggle.isVisible()) {
          await demoToggle.focus()
          await demoToggle.click()
        }
        await page
          .locator('.waveform-chart__overlay')
          .first()
          .click({ position: { x: 50, y: 40 } })
        await page.getByRole('button', { name: '标注文字色', exact: true }).click()
        await page.locator('.waveform-color-popup').waitFor()
        await page.screenshot({ path: `${evidence}/${name}-${width}-demo-color.png` })
        await page.keyboard.press('Escape')
        await page.keyboard.press('Escape')
        assert.deepEqual(errors, [])
        report.at(-1).demo = 'passed'
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
