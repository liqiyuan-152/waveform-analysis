/* global document, window */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { preview } from 'vite'
import { chromium } from 'playwright'

const evidence = resolve(process.env.WAVEFORM_EVIDENCE_DIR ?? 'artifacts/unified-demo')
await mkdir(evidence, { recursive: true })
const server = await preview({
  configFile: 'demo-app/vite.config.ts',
  preview: { host: '127.0.0.1', port: 4189 },
})
const browser = await chromium.launch()
const observations = []
try {
  for (const width of [1280, 360]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: 'reduce',
    })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript(`
const pending = new Set(), observers = new Set()
const request = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window)
window.requestAnimationFrame = callback => { const id = request(time => {pending.delete(id);callback(time)}); pending.add(id); return id }
window.cancelAnimationFrame = id => {pending.delete(id);cancel(id)}
const Original = window.ResizeObserver
window.ResizeObserver = class extends Original {
  observe(...args) { observers.add(this); super.observe(...args) }
  disconnect() { observers.delete(this); super.disconnect() }
}
window.chartResources = () => ({frames:pending.size,observers:observers.size})
`)
    for (const route of ['/display', '/components', '/']) {
      await page.goto(server.resolvedUrls.local[0] + '#' + route)
      await page.locator('.waveform-preview svg, .waveform-chart svg').first().waitFor()
      await page.waitForTimeout(1200)
      if (route === '/components') assert.equal(new URL(page.url()).hash, '#/')
      const metrics = await page.evaluate(() => ({
        width: window.innerWidth,
        contentWidth: document.documentElement.scrollWidth,
        svg: document.querySelectorAll('svg').length,
        ids: [...document.querySelectorAll('clipPath[id]')].map((node) => node.id),
      }))
      assert.ok(metrics.contentWidth <= width + 1, `${route}: horizontal overflow at ${width}`)
      assert.equal(new Set(metrics.ids).size, metrics.ids.length, 'Duplicate clip IDs')
      await page.screenshot({
        path: resolve(evidence, `${route === '/' ? 'analysis' : route.slice(1)}-${width}.png`),
        fullPage: true,
      })
      observations.push({ route, width, metrics })
    }
    const navigate = async (route) =>
      page.evaluate((value) => {
        window.location.hash = value
      }, route)
    await navigate('/controls/popup')
    await page.getByRole('button', { name: '打开基本浮层', exact: true }).waitFor()
    const original = await page.evaluate('window.chartResources()')
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: '打开基本浮层', exact: true }).click()
      await page.locator('.waveform-popover').waitFor()
      await navigate('/display')
      await page.locator('.display-demo svg').first().waitFor()
      assert.equal(await page.locator('.waveform-popup').count(), 0)
      await navigate('/')
      await page.locator('.waveform-chart svg').first().waitFor()
      assert.equal(await page.locator('.display-demo').count(), 0)
      await navigate('/controls/popup')
      await page.getByRole('button', { name: '打开基本浮层', exact: true }).waitFor()
    }
    await page.waitForTimeout(1200)
    const final = await page.evaluate('window.chartResources()')
    assert.deepEqual(final, original, 'Route transitions leaked chart resources')
    observations.push({ width, resources: { before: original, after: final } })
    assert.deepEqual(errors, [])
    await page.close()
  }
  await writeFile(resolve(evidence, 'results.json'), JSON.stringify(observations, null, 2) + '\n')
  console.log(
    'Desktop, small viewport, legacy route redirect and repeated route transitions passed',
  )
} finally {
  await browser.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
}
