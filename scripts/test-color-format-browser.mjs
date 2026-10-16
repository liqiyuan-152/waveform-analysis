import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium, firefox, webkit } from 'playwright'
import { createServer } from 'vite'

const evidence = '/tmp/waveform-color-format'
await mkdir(evidence, { recursive: true })
const server = await createServer({ server: { port: 5208, strictPort: true } })
await server.listen()
try {
  for (const [name, driver] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await driver.launch()
    try {
      for (const width of [1200, 360]) {
        const page = await browser.newPage({ viewport: { width, height: 900 } })
        for (const context of ['component', 'demo']) {
          await page.goto(
            `http://localhost:5208/${context === 'component' ? 'tests/browser/native-color-reference.html' : 'demo-app/index.html'}`,
          )
          if (context === 'component') {
            await page.getByRole('button', { name: '颜色', exact: true }).click()
          } else {
            const toggle = page.getByRole('button', { name: '图表工具', exact: true })
            await page.locator('.waveform-chart__overlay').first().waitFor()
            if (await toggle.isVisible()) {
              await toggle.focus()
              await page.keyboard.press('Enter')
            }
            await page.locator('[data-command="annotate"]').focus()
            await page.keyboard.press('Enter')
            if (await toggle.isVisible()) {
              await toggle.focus()
              await page.keyboard.press('Enter')
            }
            await page
              .locator('.waveform-chart__overlay')
              .first()
              .click({ position: { x: 50, y: 40 } })
            await page.getByRole('button', { name: '标注文字色', exact: true }).click()
          }
          const panel = page.locator('.waveform-color-popup')
          const format = panel.getByRole('combobox')
          for (const mode of ['HEX', 'RGB', 'HSB']) {
            await format.click()
            await page.getByRole('option', { name: mode, exact: true }).click()
            const caption = format.locator('span').first()
            assert.equal(await caption.textContent(), mode)
            assert.equal(
              await caption.evaluate((node) => node.scrollWidth <= node.clientWidth),
              true,
              `${name} ${width}px ${context}: ${mode} label must be fully visible`,
            )
            const row = panel.locator('.waveform-color-panel__format')
            assert.equal(
              await row.evaluate((node) => node.scrollWidth <= node.clientWidth),
              true,
              `${name} ${width}px ${context}: ${mode} fields must fit`,
            )
            const bounds = await panel.boundingBox()
            assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width)
            const opacity = panel.getByRole('spinbutton', { name: /透明度$/ })
            await opacity.fill('100')
            await opacity.press('ArrowDown')
            assert.equal(await opacity.inputValue(), '99')
            const down = opacity.locator('..').getByRole('button', { name: '减少数值' })
            await opacity.hover()
            await down.click()
            assert.equal(await opacity.inputValue(), '98')
            await opacity.fill('100')
            await opacity.press('ArrowUp')
            assert.equal(await opacity.inputValue(), '100')
            await format.hover()
            await panel.screenshot({ path: `${evidence}/${name}-${width}-${context}-${mode}.png` })
          }
          console.log(`${name} ${width}px ${context}: HEX/RGB/HSB passed`)
        }
        await page.close()
      }
    } finally {
      await browser.close()
    }
  }
} finally {
  await server.close()
}
