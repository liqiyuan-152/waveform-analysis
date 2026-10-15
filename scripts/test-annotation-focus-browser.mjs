import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium, firefox, webkit } from 'playwright'
import { build, preview } from 'vite'

const evidence = await mkdtemp(join(tmpdir(), 'waveform-annotation-focus-'))
const outDir = join(evidence, 'build')
await build({
  build: {
    outDir,
    rolldownOptions: {
      input: [resolve('tests/browser/native-floating.html'), resolve('index.html')],
    },
  },
})
const server = await preview({ build: { outDir }, preview: { port: 5208, strictPort: true } })
try {
  for (const [name, driver] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await driver.launch()
    try {
      const page = await browser.newPage()
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto('http://localhost:5208/tests/browser/native-floating.html')
      await page.waitForFunction(() => !!globalThis.nativeFloatingProbe)
      for (const width of [1200, 360]) {
        await page.setViewportSize({ width: width === 360 ? 390 : 1280, height: 900 })
        await page.evaluate((width) => globalThis.nativeFloatingProbe.setup(width), width)
        const annotation = page.locator('#chart-0 .waveform-annotation')
        const label = annotation.locator('.waveform-annotation__box')
        const outline = () =>
          annotation.evaluate(
            (node) => node.ownerDocument.defaultView.getComputedStyle(node).outlineStyle,
          )

        // A real pointer context menu must not leave the SVG group's bounding-box outline.
        await label.click({ button: 'right' })
        await page.locator('#chart-0 [role="menuitem"]').last().click()
        await annotation.focus()
        assert.equal(await outline(), 'none', `${name}/${width}: pointer focus outline`)
        await page.screenshot({ path: join(evidence, `${name}-${width}-pointer.png`) })

        // Keep keyboard access, a visible label border and focus restoration after Escape.
        await page.locator('#outside').focus()
        for (let step = 0; step < 40; step++) {
          await page.keyboard.press('Tab')
          if (await annotation.evaluate((node) => node === node.ownerDocument.activeElement)) break
        }
        await annotation.press('Shift+F10')
        assert.equal(await page.locator('#chart-0 [role="menu"]').count(), 1)
        await page.keyboard.press('Escape')
        assert.equal(
          await annotation.evaluate((node) => node === node.ownerDocument.activeElement),
          true,
        )
        assert.equal(await outline(), 'none', `${name}/${width}: keyboard focus outline`)
        assert.equal(
          await label.evaluate(
            (node) => node.ownerDocument.defaultView.getComputedStyle(node).strokeWidth,
          ),
          '3px',
          `${name}/${width}: keyboard focus remains visible on the label`,
        )
        await page.screenshot({ path: join(evidence, `${name}-${width}-keyboard.png`) })
        await page.evaluate(() => globalThis.nativeFloatingProbe.dispose())
        console.log(`${name}/${width}: pointer and keyboard annotation focus passed`)
      }
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 })
        await page.goto('http://localhost:5208/index.html')
        const chart = page.locator('.chart-panel .waveform-chart').first()
        await chart.waitFor()
        await page.evaluate(async () => {
          for (let frame = 0; frame < 4; frame++)
            await new Promise(globalThis.requestAnimationFrame)
        })
        await chart.hover({ position: { x: 10, y: 10 } })
        const tools = chart.getByRole('button', { name: '图表工具', exact: true })
        if (await tools.isVisible()) await tools.click()
        await page.screenshot({ path: join(evidence, `${name}-${width}-demo-before.png`) })
        await chart.getByRole('button', { name: '注解', exact: true }).click()
        const overlay = chart.locator('.waveform-chart__overlay').first()
        const bounds = await overlay.boundingBox()
        assert.ok(bounds)
        await overlay.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } })
        await page.getByRole('textbox', { name: '标注文本', exact: true }).fill('123')
        await page.getByRole('button', { name: '保存标注', exact: true }).click()
        const annotation = chart.locator('.waveform-annotation').first()
        await annotation.locator('rect').click({ button: 'right' })
        await chart.getByRole('menuitem', { name: '取消', exact: true }).click()
        await annotation.focus()
        assert.equal(
          await annotation.evaluate(
            (node) => node.ownerDocument.defaultView.getComputedStyle(node).outlineStyle,
          ),
          'none',
          `${name}/${width}: demo annotation focus outline`,
        )
        await chart.screenshot({ path: join(evidence, `${name}-${width}-demo.png`) })
        console.log(`${name}/${width}: demo annotation context menu passed`)
      }
      assert.deepEqual(errors, [])
    } finally {
      await browser.close()
    }
  }
} finally {
  await server.httpServer.close()
  console.log(`Annotation focus screenshots: ${evidence}`)
}
