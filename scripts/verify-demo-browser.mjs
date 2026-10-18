import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { chromium, firefox, webkit } from 'playwright'
import { measureDemoHover } from './browser-hover-metrics.mjs'
import { animationBrowserServer } from './animation-browser-server.mjs'

const evidence =
  process.env.WAVEFORM_BROWSER_EVIDENCE_DIR ?? (await mkdtemp(`${tmpdir()}/waveform-demo-`))
await mkdir(evidence, { recursive: true })
const name = process.env.WAVEFORM_BROWSER ?? 'chromium'
const driver = { chromium, firefox, webkit }[name]
if (!driver) throw new Error(`Unsupported browser: ${name}`)
const server = await animationBrowserServer(5210, {}, { benchmark: false })
const report = { name, cases: [], errors: [] }
let browser
try {
  browser = await driver.launch()
  const page = await browser.newPage()
  page.setDefaultTimeout(30_000)
  page.on('pageerror', (error) => report.errors.push(error.message))
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 800 })
    for (const route of ['/', '/animation', '/wasm-sampling']) {
      await page.goto(`http://localhost:5210/demo-app/index.html#${route}`)
      await page.locator('svg.waveform-chart__svg').first().waitFor()
      if (route === '/animation') {
        await page.getByRole('button', { name: '更新振幅', exact: true }).click()
        await page.getByRole('button', { name: '增删标注', exact: true }).click()
      }
      if (route === '/wasm-sampling') {
        await page.getByText('WASM', { exact: true }).click()
        await page.waitForFunction(() =>
          [...globalThis.document.querySelectorAll('[data-label="后端"]')].every(
            (node) => node.textContent === 'wasm',
          ),
        )
        assert.equal(await page.locator('[data-label="后端"]').count(), 10)
      }
      await page.locator('svg.waveform-chart__svg path').first().waitFor({ state: 'attached' })
      const demoHover = await measureDemoHover(page)
      const screenshot = `demo-${route === '/' ? 'workspace' : route.slice(1)}-${width}.png`
      await page.screenshot({ path: `${evidence}/${screenshot}`, fullPage: true })
      report.cases.push({ demo: route, width, screenshot, demoHover })
    }
  }
  assert.deepEqual(report.errors, [])
} catch (error) {
  report.failure = String(error)
  throw error
} finally {
  await writeFile(
    `${evidence}/demo-browser-verification.json`,
    JSON.stringify(report, null, 2) + '\n',
  )
  await browser?.close()
  await server.close()
}
console.log(`Demo browser regression passed (${name}); evidence: ${evidence}`)
