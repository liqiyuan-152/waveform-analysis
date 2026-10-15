import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium, firefox, webkit } from 'playwright'
import { build, preview } from 'vite'

const evidence = resolve('openspec/changes/decouple-waveform-engine-from-vue/evidence')
await mkdir(evidence, { recursive: true })
const outDir = await mkdtemp(join(tmpdir(), 'waveform-native-export-'))
await build({
  build: { outDir, rolldownOptions: { input: resolve('tests/browser/native-export.html') } },
})
const server = await preview({ build: { outDir }, preview: { port: 5203, strictPort: true } })
const report = { startedAt: new Date().toISOString(), browsers: [] }
let failed = false
try {
  for (const [name, driver] of Object.entries({ chromium, firefox, webkit })) {
    let browser
    const result = { name, probes: [], errors: [] }
    try {
      browser = await driver.launch()
      result.version = browser.version()
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
      page.on('pageerror', (error) => result.errors.push(error.message))
      let downloads = 0
      page.on('download', () => downloads++)
      await page.goto('http://localhost:5203/tests/browser/native-export.html')
      await page.waitForFunction(() => !!globalThis.nativeExportProbe)
      for (const width of [1200, 360]) {
        await page.setViewportSize({ width: width === 360 ? 390 : 1280, height: 800 })
        for (const displayMode of ['independent', 'separated', 'compact']) {
          await page.evaluate(
            ({ width, displayMode }) => globalThis.nativeExportProbe.setup(width, displayMode),
            { width, displayMode },
          )
          const snapshot = await page.evaluate(() => globalThis.nativeExportProbe.api())
          assert.equal(snapshot.contentWidth, width - 2)
          assert.equal(snapshot.contentHeight, 418)
          assert.equal(snapshot.width, snapshot.contentWidth * 2)
          assert.equal(snapshot.height, snapshot.contentHeight * 2)
          assert.ok(snapshot.colored > 1000)
          assert.equal(downloads, 0, 'instance API must not download')
          assert.equal(await page.evaluate(() => globalThis.nativeExportProbe.resourceCount()), 0)
          const standalone = await browser.newPage({ viewport: { width: width + 30, height: 460 } })
          await standalone.goto(
            `data:image/svg+xml;base64,${Buffer.from(snapshot.svg).toString('base64')}`,
          )
          assert.equal(
            await standalone
              .locator(
                'foreignObject, button, .waveform-chart__overlay, .waveform-chart__hover-layer',
              )
              .count(),
            0,
          )
          assert.ok((await standalone.locator('svg').first().textContent()).includes('中文标题'))
          assert.ok((await standalone.locator('svg').first().textContent()).includes('中文标注'))
          assert.ok(
            (await standalone.locator('.waveform-export-legend').allTextContents())
              .join('')
              .includes('通道a'),
          )
          assert.equal(
            await standalone.locator('.waveform-chart__series[data-series-id="b"]').count(),
            0,
          )
          assert.equal(await standalone.locator('svg').first().getAttribute('height'), '418')
          await standalone.screenshot({
            path: join(evidence, `native-export-${name}-${width}-${displayMode}.png`),
          })
          await writeFile(
            join(evidence, `native-export-${name}-${width}-${displayMode}.svg`),
            snapshot.svg,
          )
          await writeFile(
            join(evidence, `native-export-${name}-${width}-${displayMode}-output.png`),
            Buffer.from(snapshot.png, 'base64'),
          )
          await standalone.close()
          result.probes.push({
            width,
            displayMode,
            widthPx: snapshot.width,
            heightPx: snapshot.height,
            coloredPixels: snapshot.colored,
            standaloneSvg: true,
          })
        }
      }
      await page.evaluate(() => globalThis.nativeExportProbe.setup(1200, 'independent'))
      await page.evaluate(() => globalThis.nativeExportProbe.failNextPng())
      await page.locator('[data-command="export"]').click()
      await page.getByRole('button', { name: '下载 PNG', exact: true }).click()
      await page.waitForFunction(
        () => globalThis.document.querySelector('[role="status"]')?.textContent === '图片编码失败',
      )
      assert.equal(await page.locator('[data-command="export"]').isEnabled(), true)
      assert.equal(await page.evaluate(() => globalThis.nativeExportProbe.resourceCount()), 0)
      for (const format of ['SVG', 'PNG']) {
        await page.locator('[data-command="export"]').click()
        const downloaded = page.waitForEvent('download')
        await page.getByRole('button', { name: `下载 ${format}`, exact: true }).click()
        const download = await downloaded
        assert.equal(download.suggestedFilename(), `waveform.${format.toLowerCase()}`)
        assert.equal(await download.failure(), null)
        await page.waitForFunction(
          () => !globalThis.document.querySelector('[data-command="export"]').disabled,
        )
      }
      assert.equal(downloads, 2)
      assert.equal(await page.evaluate(() => globalThis.nativeExportProbe.resourceCount()), 0)
      await page.evaluate(() => globalThis.nativeExportProbe.dispose())
      assert.equal(await page.locator('#chart').evaluate((host) => host.childElementCount), 0)
      assert.deepEqual(result.errors, [])
      result.downloadRetry = true
      result.pass = true
    } catch (error) {
      failed = true
      result.failure = error.stack
    } finally {
      await browser?.close()
    }
    report.browsers.push(result)
  }
} finally {
  await server.httpServer.close()
  report.finishedAt = new Date().toISOString()
  await writeFile(join(evidence, 'native-export-browser.json'), JSON.stringify(report, null, 2))
}
console.log(JSON.stringify(report, null, 2))
if (failed) process.exitCode = 1
