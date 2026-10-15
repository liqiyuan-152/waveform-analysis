/* global document, window, getComputedStyle */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, firefox, webkit } from 'playwright'
import { createServer } from 'vite'

const evidence = resolve(
  process.env.WAVEFORM_INPUT_SELECT_EVIDENCE_DIR ?? '/tmp/waveform-input-select',
)
await mkdir(evidence, { recursive: true })
const server = await createServer({ server: { port: 5211, strictPort: true } })
await server.listen()
const report = []
try {
  for (const [name, driver] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await driver.launch()
    try {
      for (const width of [1200, 360]) {
        const page = await browser.newPage({ viewport: { width, height: 800 } })
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto('http://localhost:5211/tests/browser/native-input-select.html')
        const input = page.getByRole('spinbutton', { name: '时间', exact: true })
        const number = page.locator('.waveform-number-input').first()
        const up = number.getByRole('button', { name: '增加时间' })
        const select = page.getByRole('combobox', { name: '波形', exact: true })
        assert.deepEqual(
          await number.evaluate((node) => {
            const style = getComputedStyle(node)
            return [style.height, style.borderRadius, style.fontSize, style.color]
          }),
          ['32px', '6px', '14px', 'rgba(0, 0, 0, 0.88)'],
        )
        assert.equal(await page.getByRole('spinbutton', { name: '禁用数字' }).isDisabled(), true)
        assert.equal(
          await page.getByRole('spinbutton', { name: '只读数字' }).getAttribute('readonly'),
          '',
        )
        await page.screenshot({ path: `${evidence}/${name}-${width}-default.png` })
        await input.hover()
        await page.waitForTimeout(250)
        assert.equal(
          await number
            .locator('.waveform-number-input__steps')
            .evaluate((node) => getComputedStyle(node).width),
          '22px',
        )
        await number.hover()
        await page.waitForTimeout(250)
        await up.hover()
        await page.waitForTimeout(250)
        const buttons = await number
          .locator('button')
          .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height))
        assert.ok(buttons[0] > buttons[1])
        await page.screenshot({ path: `${evidence}/${name}-${width}-number-hover.png` })
        await input.fill('1e-')
        assert.equal(await input.inputValue(), '1e-')
        await input.press('ArrowUp')
        await input.press('Shift+ArrowUp')
        assert.equal(await input.inputValue(), '0.011')
        const box = await up.boundingBox()
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.waitForTimeout(650)
        await page.mouse.up()
        assert.equal(await input.inputValue(), '0.013')
        await page.waitForTimeout(450)
        assert.equal(await input.inputValue(), '0.013')
        await number.hover()
        await page.waitForTimeout(250)
        await up.hover()
        await page.mouse.down()
        await page.mouse.move(300, 650)
        const afterLeave = await input.inputValue()
        await page.waitForTimeout(650)
        await page.mouse.up()
        assert.equal(await input.inputValue(), afterLeave)
        await input.focus()
        await input.hover()
        await page.mouse.wheel(0, 100)
        assert.equal(await input.inputValue(), afterLeave)
        if (name === 'chromium' && width === 360) {
          await input.fill('1')
          await page.waitForTimeout(250)
          const touch = await up.boundingBox()
          const cdp = await page.context().newCDPSession(page)
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: touch.x + touch.width / 2, y: touch.y + touch.height / 2 }],
          })
          await page.waitForTimeout(650)
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
          assert.equal(await input.inputValue(), '1.002')
          await cdp.detach()
        }
        await select.press('ArrowDown')
        assert.equal(
          await page.getByRole('option', { name: 'Channel a' }).getAttribute('aria-selected'),
          'true',
        )
        await select.press('ArrowUp')
        await select.press('Tab')
        assert.equal(await select.textContent(), 'Channel c')
        assert.equal(await select.evaluate((node) => node === document.activeElement), true)
        await select.press('Tab')
        assert.equal(await select.evaluate((node) => node === document.activeElement), false)
        // WebKit follows Safari's default Tab preference, which skips buttons.
        if (name !== 'webkit') {
          assert.equal(
            await page
              .getByRole('combobox', { name: '长标签' })
              .evaluate((node) => node === document.activeElement),
            true,
          )
        }
        await select.click()
        assert.equal(
          await page.getByRole('option', { name: 'Channel c' }).locator('svg').count(),
          0,
        )
        const panel = page.getByRole('listbox')
        const bounds = await panel.boundingBox()
        assert.equal(bounds.width, 240)
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width)
        await page.screenshot({ path: `${evidence}/${name}-${width}-select-open.png` })
        await select.press('Escape')
        await page.getByRole('combobox', { name: '禁用选择' }).click({ force: true })
        assert.equal(await panel.count(), 0)
        assert.equal(await page.evaluate(() => window.nativeInputSelect.gestures()), 0)
        await page.evaluate(() => window.nativeInputSelect.many())
        await select.press('ArrowDown')
        assert.equal((await panel.boundingBox()).height, 264)
        await select.press('End')
        const last = page.getByRole('option', { name: 'Option 49', exact: true })
        assert.ok((await last.boundingBox()).y < (await panel.boundingBox()).y + 264)
        await select.press('Tab')
        assert.equal(await select.textContent(), 'Option 49')
        await number.hover()
        await page.waitForTimeout(250)
        await up.hover()
        await page.mouse.down()
        await page.evaluate(() => window.nativeInputSelect.hide())
        const count = await page.evaluate(() => window.nativeInputSelect.values.length)
        await page.waitForTimeout(650)
        await page.mouse.up()
        assert.equal(await page.evaluate(() => window.nativeInputSelect.values.length), count)
        await page.evaluate(() => window.nativeInputSelect.dispose())
        assert.equal(await page.locator('#controls > *').count(), 0)
        assert.deepEqual(errors, [])
        report.push({ browser: name, width, status: 'passed' })
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
