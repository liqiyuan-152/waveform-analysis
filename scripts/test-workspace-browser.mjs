/* global document, getComputedStyle */
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

// Run against an isolated validation checkout: HMR probes temporarily edit its sources.
const [url, checkout] = process.argv.slice(2)
const routesOnly = process.argv.includes('--routes-only')
if (!url || !checkout || resolve(checkout) === process.cwd()) {
  throw new Error('Usage: node scripts/test-workspace-browser.mjs URL ISOLATED_CHECKOUT')
}
const evidence = resolve('openspec/changes/project-optimization-2024/evidence')
mkdirSync(evidence, { recursive: true })
const result = { url, checkout, startedAt: new Date().toISOString(), routes: [], hmr: [] }
const browser = await chromium.launch()
const originals = new Map()
const page = await browser.newPage()
const errors = []
let navigations = 0
page.on('framenavigated', (frame) => {
  if (frame === page.mainFrame()) navigations++
})
page.on('pageerror', (error) => errors.push(error.message))
const workers = []
page.on('worker', (worker) => workers.push(worker.url()))
async function eventually(check) {
  const deadline = Date.now() + 60000
  while (Date.now() < deadline) {
    if (await check()) return
    await new Promise((done) => setTimeout(done, 500))
  }
  throw new Error('Timed out waiting for automatic update')
}
function edit(file, transform) {
  const path = resolve(checkout, file)
  const original = readFileSync(path, 'utf8')
  if (!originals.has(path)) originals.set(path, original)
  const changed = transform(original)
  assert.notEqual(changed, original)
  writeFileSync(path, changed)
}
async function probe(name, file, transform, check, requireHmr = false) {
  const before = navigations
  edit(file, transform)
  await eventually(check)
  if (requireHmr) assert.equal(navigations, before, `${name} should use HMR without navigation`)
  result.hmr.push({
    name,
    passed: true,
    withoutManualReload: true,
    automaticNavigations: navigations - before,
  })
  const path = resolve(checkout, file)
  writeFileSync(path, originals.get(path))
}
try {
  for (const width of [1200, 360]) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of ['/', '/fixed-y-domain', '/animation', '/wasm-sampling']) {
      await page.goto(`${url}/#${route}`)
      await page.locator('.waveform-chart__overlay').first().waitFor()
      await page.waitForFunction(() =>
        [...document.querySelectorAll('.waveform-chart__line')].some(
          (node) => (node.getAttribute('d')?.length ?? 0) > 20,
        ),
      )
      if (route === '/wasm-sampling') {
        await page.waitForFunction(() =>
          [...document.querySelectorAll('[data-label="后端"]')].every(
            (node) => node.textContent.trim() === 'wasm',
          ),
        )
      }
      if (route === '/animation') {
        // Let the entering presentation settle before issuing the next controlled change.
        await page.waitForTimeout(1500)
        await page.getByRole('button', { name: '增删标注', exact: true }).click()
        await page.locator('.waveform-annotation__box').first().waitFor()
        await page.getByRole('button', { name: '更新振幅', exact: true }).click()
        await page.waitForTimeout(1500)
        await page.getByRole('button', { name: '改变点数', exact: true }).click()
      }
      if (route === '/') {
        const command = async (name) => {
          await page.locator('.waveform-chart__overlay').first().hover()
          const toggle = page.getByRole('button', { name: '图表工具', exact: true })
          if (
            (await toggle.isVisible()) &&
            (await toggle.getAttribute('aria-expanded')) === 'false'
          )
            await toggle.click()
          await page.getByRole('button', { name, exact: true }).click()
        }
        const endpoints = () => page.locator('.waveform-chart__axis-endpoint').allTextContents()
        const initial = await endpoints()
        await command('放大')
        await eventually(async () => JSON.stringify(await endpoints()) !== JSON.stringify(initial))
        const zoomed = await endpoints()
        await command('平移')
        const overlay = page.locator('.waveform-chart__overlay').first()
        const bounds = await overlay.boundingBox()
        await page.mouse.move(bounds.x + bounds.width * 0.55, bounds.y + bounds.height * 0.6)
        await page.mouse.down()
        await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + bounds.height * 0.6, {
          steps: 8,
        })
        await page.mouse.up()
        await eventually(async () => JSON.stringify(await endpoints()) !== JSON.stringify(zoomed))
        await command('重置')
        await command('注解')
        await overlay.click({ position: { x: bounds.width * 0.5, y: bounds.height * 0.65 } })
        await page.getByRole('spinbutton', { name: '标注横轴时间' }).fill('0')
        await page.getByLabel('标注文本').fill('workspace browser note')
        await page.getByRole('button', { name: '保存标注', exact: true }).click()
        await page.locator('dialog').waitFor({ state: 'detached' })
        await page.locator('.waveform-annotation__box').first().waitFor()
        await command('导出图片')
        const download = page.waitForEvent('download')
        await page.getByRole('button', { name: '下载 SVG', exact: true }).click()
        const image = await download
        assert.equal(await image.failure(), null)
        await image.saveAs(resolve(evidence, `workspace-export-${width}.svg`))
        result.routes.push({
          route,
          width,
          interactions: ['zoom', 'pan', 'reset', 'annotation', 'SVG export'],
          passed: true,
        })
        await page.getByRole('button', { name: '下一页', exact: true }).click()
        await eventually(
          async () => (await page.locator('button[aria-current="page"]').textContent()) === '2',
        )
        await page.getByRole('button', { name: '上一页', exact: true }).click()
        await page.waitForFunction(
          () => document.querySelector('button[aria-current="page"]')?.textContent === '1',
        )
      }
      await page.waitForTimeout(1500)
      const screenshot = `${routesOnly ? 'preview' : 'workspace'}-${route === '/' ? 'main' : route.slice(1)}-${width}.png`
      await page.screenshot({ path: resolve(evidence, screenshot), fullPage: true })
      result.routes.push({ route, width, screenshot, passed: true })
    }
  }
  if (routesOnly) {
    assert.deepEqual(errors, [])
    result.passed = true
  } else {
    await page.setViewportSize({ width: 1200, height: 900 })
    await page.goto(url)
    await page.locator('.waveform-chart-host').first().waitFor()
    await probe(
      'demo TypeScript',
      'demo-app/src/demo/toolbarOptions.ts',
      (text) => text.replace("export: '导出图片'", "export: 'HMR TypeScript probe'"),
      async () => (await page.getByText('HMR TypeScript probe', { exact: true }).count()) > 0,
    )
    await probe(
      'demo Vue',
      'demo-app/src/DemoRouterApp.vue',
      (text) => text.replace('>Waveform Analysis<', '>HMR Vue probe<'),
      async () => (await page.locator('.demo-shell__brand').textContent()) === 'HMR Vue probe',
      true,
    )
    await probe(
      'library Vue',
      'src/adapters/vue/WaveformChart.vue',
      (text) => text.replace('ref="host"', 'ref="host" data-workspace-hmr="passed"'),
      async () => (await page.locator('[data-workspace-hmr="passed"]').count()) > 0,
    )
    await probe(
      'library CSS and native copy',
      'src/styles/native.css',
      (text) => `${text}\n.waveform-chart-host { outline: 7px solid rgb(12, 34, 56); }\n`,
      async () => {
        const applied = await page
          .locator('.waveform-chart-host')
          .first()
          .evaluate((node) => getComputedStyle(node).outlineWidth === '7px')
        const css = readFileSync(resolve(checkout, 'dist/style.css'), 'utf8')
        return applied && css === readFileSync(resolve(checkout, 'dist/native/style.css'), 'utf8')
      },
    )
    await probe(
      'library declarations',
      'src/types/controls.ts',
      (text) => `${text}\nexport type WorkspaceHmrProbe = 'passed'\n`,
      async () =>
        readFileSync(resolve(checkout, 'dist/types/types/controls.d.ts'), 'utf8').includes(
          'WorkspaceHmrProbe',
        ),
    )
    await eventually(
      async () =>
        !readFileSync(resolve(checkout, 'dist/types/types/controls.d.ts'), 'utf8').includes(
          'WorkspaceHmrProbe',
        ),
    )
    assert.ok(
      readFileSync(resolve(checkout, 'dist/types/core/wasmSampling.d.ts'), 'utf8').includes(
        '../wasm/waveform_sampling_wasm',
      ),
    )
    assert.deepEqual(errors, [])
    result.workers = workers
    result.pageErrors = errors
    result.passed = true
  }
} catch (error) {
  result.error = error.stack
  process.exitCode = 1
} finally {
  for (const [path, original] of originals) writeFileSync(path, original)
  result.finishedAt = new Date().toISOString()
  writeFileSync(
    resolve(evidence, routesOnly ? 'workspace-preview-browser.json' : 'workspace-browser.json'),
    `${JSON.stringify(result, null, 2)}\n`,
  )
  await browser.close()
}
console.log(JSON.stringify(result, null, 2))
