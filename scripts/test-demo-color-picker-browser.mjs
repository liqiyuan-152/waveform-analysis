/* global document */
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium, firefox, webkit } from 'playwright'
import { createServer } from 'vite'

const evidence = '/tmp/waveform-demo-color-picker'
await mkdir(evidence, { recursive: true })
const server = await createServer({
  configFile: 'demo-app/vite.config.ts',
  server: { port: 5210, strictPort: true },
})
await server.listen()
try {
  for (const [name, driver] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await driver.launch()
    try {
      for (const width of [1280, 360]) {
        const page = await browser.newPage({ viewport: { width, height: 900 } })
        await page.addInitScript(() => {
          localStorage.setItem('color-history', '["rgb(255, 0, 0)"]')
        })
        await page.goto('http://localhost:5210/')
        await page.waitForSelector('.vc-color-wrap', { state: 'attached' })
        if (width === 360) await page.getByRole('button', { name: '控制面板', exact: true }).click()
        const sidebar = page.locator('.control-panel')
        const pickers = sidebar.locator('.vc-color-wrap')
        assert.equal(await pickers.count(), 7)
        assert.equal(await sidebar.locator('.waveform-color-input').count(), 0)
        for (let index = 0; index < 7; index++) {
          const trigger = await pickers.nth(index).boundingBox()
          assert.equal(trigger.width, 24)
          assert.equal(trigger.height, 24)
          await pickers.nth(index).click()
          const panel = page.locator('.vc-chrome-colorPicker:visible')
          await panel.waitFor()
          const preview = panel.locator('.vc-current-color')
          const sliders = await panel.locator('.chrome-controls').boundingBox()
          const swatch = await preview.boundingBox()
          const inputs = await panel.locator('.vc-display').boundingBox()
          assert.ok(Math.abs(swatch.y - sliders.y) < 1)
          assert.ok(swatch.x >= sliders.x + sliders.width + 8)
          assert.ok(swatch.y + swatch.height <= inputs.y)
          assert.equal(swatch.width, 28)
          assert.equal(swatch.height, 28)
          assert.equal(await panel.locator('.vc-colorPicker__record').count(), 0)
          const bounds = await page.locator('.vc-colorpicker:visible').boundingBox()
          assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width)
          await panel.locator('.vc-color-input input').fill('63478a')
          await page.waitForFunction(
            () =>
              document.querySelector('.vc-current-color .color-cube')?.style.background ===
              'rgb(99, 71, 138)',
          )
          if (index === 5 || index === 6) {
            const variant = index === 6 ? 'alpha' : 'opaque'
            await panel.screenshot({ path: `${evidence}/${name}-${width}-${variant}.png` })
            await page.screenshot({ path: `${evidence}/${name}-${width}-${variant}-sidebar.png` })
          }
          await panel.locator('.vc-input-toggle').click()
          const switched = await preview.boundingBox()
          assert.equal(switched.x, swatch.x)
          assert.equal(switched.y, swatch.y)
          await sidebar.locator('h2').first().click()
        }
        console.log(
          `${name} ${width}px: 7 vue3-colorpicker previews aligned right; HEX/RGBA passed`,
        )
        await page.close()
      }
    } finally {
      await browser.close()
    }
  }
} finally {
  await server.close()
}
