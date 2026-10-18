import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, firefox, webkit } from 'playwright'
import { tmpdir, cpus, platform, arch } from 'node:os'
import { evaluateHoverTiming } from './browser-performance.mjs'
import { animationBuildInputs } from './animation-build-inputs.mjs'
import { animationBrowserServer } from './animation-browser-server.mjs'

const evidence =
  process.env.WAVEFORM_BROWSER_EVIDENCE_DIR ?? (await mkdtemp(`${tmpdir()}/waveform-regression-`))
await mkdir(evidence, { recursive: true })
const name = process.env.WAVEFORM_BROWSER ?? 'chromium'
// macOS WebKit follows the system's text-fields-only Tab preference; Option-Tab includes buttons.
const tabKey = name === 'webkit' && platform() === 'darwin' ? 'Alt+Tab' : 'Tab'
const backTabKey = name === 'webkit' && platform() === 'darwin' ? 'Alt+Shift+Tab' : 'Shift+Tab'
const driver = { chromium, firefox, webkit }[name]
if (!driver) throw new Error(`Unsupported browser: ${name}`)
const server = await animationBrowserServer(
  5210,
  {
    quality: resolve('tests/browser/update-quality.html'),
  },
  { benchmark: false },
)
let browser
const budgets = JSON.parse(
  await readFile(new URL('./browser-performance-budgets.json', import.meta.url), 'utf8'),
)
const report = {
  budgetVersion: budgets.version,
  budgetMode: process.env.WAVEFORM_MEASURE_BASELINE ? 'measurement-only' : 'enforced',
  name,
  node: process.version,
  source: animationBuildInputs().sha256,
  environment: { platform: platform(), arch: arch(), cpu: cpus()[0]?.model },
  buildMode: server.buildMode,
  cases: [],
  errors: [],
  assistiveTechnology: '真实屏幕阅读器未验证；仅检查本次引擎的可访问性树及真实键盘输入。',
  limitations: '结果仅适用于本次实际引擎；真实 Safari/iOS/辅助技术未验证。',
}
try {
  browser = await driver.launch()
  report.browser = browser.version()
  const page = await browser.newPage()
  page.setDefaultTimeout(30_000)
  page.on('pageerror', (error) => report.errors.push(error.message))
  await page.goto('http://localhost:5210/tests/browser/update-quality.html')
  await page.waitForFunction(() => !!globalThis.updateQuality)
  for (const vue of [false, true])
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 800 })
      await page.evaluate(
        ({ vue, width }) => globalThis.updateQuality.startInteractive(vue, width),
        { vue, width },
      )
      const hover = []
      for (const movingX of [false, true]) {
        const run = () =>
          page.evaluate(
            (movingX) => globalThis.updateQuality.interactive.measureHover(movingX),
            movingX,
          )
        const measured = await run()
        if (!process.env.WAVEFORM_MEASURE_BASELINE) {
          const budget = budgets.budgets[`${name}/${vue}/${width}/${movingX}`]
          const failure = evaluateHoverTiming(measured, budget)
          if (failure) {
            measured.retest = await run()
            assert.equal(evaluateHoverTiming(measured.retest, budget), undefined, failure)
          }
        }
        hover.push(measured)
      }
      assert.equal(await page.locator('[role=tooltip]').count(), 1)
      if (!process.env.WAVEFORM_MEASURE_BASELINE) {
        assert.equal(hover[0].createdNodes, 0, 'Stable hover must reuse nodes')
        assert.equal(hover[0].measurements, 0, 'Stable hover must reuse measured size')
        assert.equal(hover[1].createdNodes, 0, 'Changing points must reuse nodes')
      }
      await page.screenshot({ path: `${evidence}/hover-${vue ? 'vue' : 'native'}-${width}.png` })
      const first = page.getByRole('button', { name: '隐藏曲线 通道 A', exact: true })
      const second = page.getByRole('button', { name: '隐藏曲线 通道 B', exact: true })
      assert.equal(await first.count(), 1)
      assert.equal(await first.locator('..').getAttribute('role'), 'listitem')
      const accessibility = await page.locator('svg.waveform-chart__svg').ariaSnapshot()
      assert.match(accessibility, /button.*隐藏曲线 通道 A/)
      await first.focus()
      await page.keyboard.press(tabKey)
      assert(await second.evaluate((node) => node === node.ownerDocument.activeElement))
      await page.keyboard.press(backTabKey)
      await page.keyboard.press('Enter')
      assert.deepEqual(await page.evaluate(() => globalThis.updateQuality.interactive.requests()), [
        ['a'],
      ])
      assert.equal(await first.getAttribute('aria-pressed'), 'true')
      await page.evaluate(() =>
        globalThis.updateQuality.interactive.patch({ hiddenSeriesIds: ['a'] }),
      )
      assert(
        await page
          .getByRole('button', { name: '显示曲线 通道 A', exact: true })
          .evaluate((node) => node === node.ownerDocument.activeElement),
      )
      await page.keyboard.press('Space')
      assert.deepEqual(await page.evaluate(() => globalThis.updateQuality.interactive.requests()), [
        ['a'],
        [],
      ])
      await page.evaluate(() => globalThis.updateQuality.interactive.patch({ hiddenSeriesIds: [] }))
      await first.click()
      assert.deepEqual(await page.evaluate(() => globalThis.updateQuality.interactive.requests()), [
        ['a'],
        [],
        ['a'],
      ])
      await page.evaluate(() =>
        globalThis.updateQuality.interactive.patch({
          legend: { interactive: false, position: 'top' },
        }),
      )
      const disabled = page.locator('.waveform-chart__legend-item').first()
      assert(await disabled.isDisabled())
      assert.equal(await disabled.getAttribute('aria-pressed'), null)
      await page.evaluate(() =>
        globalThis.updateQuality.interactive.patch({
          legend: { interactive: true, position: 'top' },
        }),
      )
      const overlay = page.locator('.waveform-chart__overlay').first()
      let box = await overlay.boundingBox()
      assert(box)
      const span = () =>
        page.evaluate(() => {
          const d = globalThis.updateQuality.interactive.state().targets[0].viewport.xDomain
          return d[1] - d[0]
        })
      const initialSpan = await span()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.wheel(0, -200)
      await page.waitForFunction((original) => {
        const d = globalThis.updateQuality.interactive.state().targets[0].viewport.xDomain
        return d[1] - d[0] < original
      }, initialSpan)
      await page.evaluate(() => globalThis.updateQuality.interactive.svg())
      await page.evaluate(() =>
        globalThis.updateQuality.interactive.patch({ interactionMode: 'pan' }),
      )
      const beforePan = await page.evaluate(
        () => globalThis.updateQuality.interactive.state().targets[0].viewport.xDomain,
      )
      box = await overlay.boundingBox()
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5)
      await page.evaluate(() =>
        globalThis.updateQuality.interactive.patch({ lineColor: '#ff0000' }),
      )
      await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5)
      await page.mouse.up()
      await page.evaluate(() => globalThis.updateQuality.interactive.svg())
      assert.notDeepEqual(
        await page.evaluate(
          () => globalThis.updateQuality.interactive.state().targets[0].viewport.xDomain,
        ),
        beforePan,
      )
      await page.evaluate(async () => {
        globalThis.updateQuality.interactive.reset()
        await globalThis.updateQuality.interactive.svg()
      })
      await page.evaluate(() =>
        globalThis.updateQuality.interactive.patch({ interactionMode: 'zoom' }),
      )
      box = await overlay.boundingBox()
      await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.5)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5)
      await page.mouse.up()
      await page.evaluate(() => globalThis.updateQuality.interactive.svg())
      assert((await span()) < initialSpan)
      await page.evaluate(async () => {
        globalThis.updateQuality.interactive.reset()
        await globalThis.updateQuality.interactive.svg()
      })
      await page.locator('.waveform-annotation__box').first().click({ button: 'right' })
      await page.locator('.waveform-annotation-context-menu button').first().click()
      const draft = page.locator('dialog textarea')
      await draft.fill('浏览器未保存草稿')
      await draft.evaluate((node) => {
        node.focus()
        node.setSelectionRange(2, 5)
      })
      await page.evaluate(() =>
        globalThis.updateQuality.interactive.patch({ lineColor: '#00aa00' }),
      )
      assert.equal(await draft.inputValue(), '浏览器未保存草稿')
      assert.deepEqual(
        await draft.evaluate((node) => [
          node.selectionStart,
          node.selectionEnd,
          node === node.ownerDocument.activeElement,
        ]),
        [2, 5, true],
      )
      await page.keyboard.press('Escape')
      await page.locator('dialog').waitFor({ state: 'hidden' })
      const svg = await page.evaluate(() => globalThis.updateQuality.interactive.svg())
      assert.match(svg, /#00aa00/)
      assert((await page.evaluate(() => globalThis.updateQuality.interactive.pngSize())) > 100)
      const screenshot = `${vue ? 'vue' : 'native'}-${width}.png`
      await page.screenshot({ path: `${evidence}/${screenshot}` })
      const animationCompletions = await page.evaluate(async () => {
        let completed = 0
        await globalThis.updateQuality.interactive.patch({
          animationEnabled: true,
          animationUpdate: { duration: 120, onComplete: () => completed++ },
          data: {
            kind: 'series',
            series: ['a', 'b'].map((id, index) => ({
              id,
              name: `通道 ${id.toUpperCase()}`,
              trackId: 'group',
              data: {
                kind: 'samples',
                sampleRate: 1000,
                values: Array.from({ length: 10000 }, (_, i) => Math.sin(i / 50) + index + 1),
              },
            })),
          },
        })
        return completed
      })
      assert(animationCompletions > 0)
      await page.evaluate(async () => {
        globalThis.updateQuality.loseTransport()
        await globalThis.updateQuality.interactive.patch({
          rendering: { sampling: { mode: 'auto', autoThreshold: 100, maxPointCount: 900 } },
        })
      })
      assert.match(await page.evaluate(() => globalThis.updateQuality.interactive.svg()), /<svg/)
      await page.evaluate(() =>
        globalThis.updateQuality.interactive.patch({
          animationEnabled: false,
          data: {
            kind: 'series',
            series: [0, 1, 2].map((index) => ({
              id: `page-${index}`,
              name: `分页 ${index}`,
              data: { kind: 'samples', sampleRate: 1, values: [1, 2, 1] },
            })),
          },
        }),
      )
      await page.getByRole('button', { name: '下一页', exact: true }).click()
      await page.evaluate(() => globalThis.updateQuality.interactive.svg())
      assert.equal(await page.locator('[aria-current="page"]').textContent(), '2')
      report.cases.push({
        vue,
        width,
        hover,
        animationCompletions,
        recovery: true,
        pagination: true,
        keyboard: `${tabKey}/${backTabKey}/Enter/Space`,
        focusRetained: true,
        controlledVisibility: true,
        wheel: true,
        panWithColor: true,
        box: true,
        annotationDraft: true,
        svg: true,
        png: true,
        accessibility,
        screenshot,
      })
      await page.evaluate(() => globalThis.updateQuality.interactive.dispose())
      assert.equal(await page.locator('svg.waveform-chart__svg').count(), 0)
      assert.equal(await page.locator('[role=tooltip]').count(), 0)
    }
  assert.deepEqual(report.errors, [])
} catch (error) {
  report.failure = String(error)
  throw error
} finally {
  await writeFile(`${evidence}/browser-verification.json`, JSON.stringify(report, null, 2) + '\n')
  await browser?.close()
  await server.close()
}

console.log(`Browser regression passed (${name}); evidence: ${evidence}`)
