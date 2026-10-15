import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium, firefox, webkit } from 'playwright'
import { build, preview } from 'vite'

const evidence = resolve(
  process.env.WAVEFORM_COLORS_EVIDENCE_DIR ??
    'openspec/changes/decouple-waveform-engine-from-vue/evidence',
)
await mkdir(evidence, { recursive: true })
const outDir = await mkdtemp(join(tmpdir(), 'waveform-native-colors-'))
await build({
  build: {
    outDir,
    rolldownOptions: {
      input: [
        resolve('tests/browser/native-gestures.html'),
        resolve('tests/browser/native-annotation-animation.html'),
      ],
    },
  },
})
const server = await preview({ build: { outDir }, preview: { port: 5199, strictPort: true } })
const report = {
  startedAt: new Date().toISOString(),
  node: process.version,
  scope:
    '8.3 原生精确 CSS 色值、alpha、键盘输入、受控保存和标注出现/消失/finished；自绘色板交互与弹层层级另由 test-themed-controls-browser 验证',
  browsers: [],
}
let failed = false
try {
  for (const [name, driver] of Object.entries({ chromium, firefox, webkit })) {
    const result = { name, colors: [], animations: [], errors: [] }
    let browser
    try {
      browser = await driver.launch()
      result.version = browser.version()
      const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
      page.on('pageerror', (error) => result.errors.push(error.message))
      await page.goto('http://localhost:5199/tests/browser/native-gestures.html')
      await page.waitForFunction(() => !!globalThis.nativeGesturesProbe)
      for (const width of [1200, 360])
        for (const displayMode of ['independent', 'separated', 'compact']) {
          await page.setViewportSize({ width: width === 360 ? 390 : 1280, height: 1000 })
          await page.evaluate(
            ({ width, displayMode }) =>
              globalThis.nativeGesturesProbe.setup(width, displayMode, {
                annotations: [
                  {
                    id: 'note',
                    seriesId: 'a',
                    x: 1,
                    y: 1,
                    text: '颜色编辑',
                    style: {
                      borderColor: '#12345678',
                      textColor: 'rebeccapurple',
                      backgroundColor: 'rgba(255, 255, 255, 0.5)',
                    },
                  },
                ],
              }),
            { width, displayMode },
          )
          await page.locator('#native .waveform-annotation__box').click({ button: 'right' })
          await page.locator('#native .waveform-annotation-context-menu button').first().click()
          const dialog = page.locator('dialog[open]')
          await dialog.getByRole('button', { name: '标注边框色', exact: true }).click()
          const border = dialog.locator('[aria-label="标注边框色精确值"]')
          assert.equal(await border.inputValue(), '123456')
          await border.fill('invalid')
          assert.equal(await dialog.locator('.waveform-modal__button--primary').isDisabled(), true)
          await border.fill('#abcdef80')
          await dialog.getByRole('button', { name: '标注背景色', exact: true }).click()
          const alpha = dialog.locator('[aria-label="标注背景色透明度"]')
          await alpha.fill('37')
          await alpha.press('ArrowUp')
          assert.equal(await alpha.inputValue(), '38')
          await alpha.fill('12.3456')
          await dialog.getByRole('button', { name: '标注文字色', exact: true }).click()
          await dialog.getByLabel('标注文字色精确值', { exact: true }).fill('#fedcba')
          await dialog.getByRole('button', { name: '标注边框色', exact: true }).click()
          await border.focus()
          await border.press('Tab')
          assert.equal(
            await border.evaluate((node) =>
              node.ownerDocument.activeElement?.getAttribute('aria-label'),
            ),
            '标注边框色透明度',
          )
          await dialog.screenshot({
            path: join(evidence, `native-colors-${name}-${width}-${displayMode}.png`),
          })
          const bounds = await dialog.boundingBox()
          assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= (width === 360 ? 390 : 1280))
          await dialog.locator('textarea').focus()
          await dialog.locator('textarea').press('Control+Enter')
          assert.equal(await page.locator('dialog[open]').count(), 0)
          const snapshot = await page.evaluate(() =>
            globalThis.nativeGesturesProbe.annotationSnapshot(),
          )
          const replacement = snapshot.nativeAnnotationEvents['update:annotations'][0][0]
          assert.deepEqual(replacement[0].style, {
            borderColor: '#abcdef80',
            textColor: '#fedcba',
            backgroundColor: 'rgba(255, 255, 255, 0.123456)',
          })
          assert.equal(snapshot.native[0].fill, 'rgba(255, 255, 255, 0.5)')
          assert.equal(snapshot.nativeAnnotationEvents['annotation-update'].length, 1)
          await page.evaluate(
            (annotations) => globalThis.nativeGesturesProbe.patch({ annotations }),
            replacement,
          )
          const acknowledged = await page.evaluate(() =>
            globalThis.nativeGesturesProbe.annotationSnapshot(),
          )
          assert.equal(acknowledged.native[0].fill, replacement[0].style.backgroundColor)
          assert.equal(acknowledged.native[0].stroke, replacement[0].style.borderColor)
          assert.equal(acknowledged.vue[0].fill, acknowledged.native[0].fill)
          assert.equal(acknowledged.vue[0].stroke, acknowledged.native[0].stroke)
          await page.evaluate(() => globalThis.nativeGesturesProbe.dispose())
          assert.equal(await page.locator('dialog, .waveform-chart').count(), 0)
          result.colors.push({
            width,
            displayMode,
            savedStyle: replacement[0].style,
            keyboardAlpha: 0.38,
            bounds,
          })
        }
      await page.goto('http://localhost:5199/tests/browser/native-annotation-animation.html')
      await page.waitForFunction(() => !!globalThis.nativeAnnotationAnimationProbe)
      for (const width of [1200, 360])
        for (const displayMode of ['independent', 'separated', 'compact']) {
          await page.setViewportSize({ width: width === 360 ? 390 : 1280, height: 1000 })
          result.animations.push(
            await page.evaluate(
              ({ width, displayMode }) =>
                globalThis.nativeAnnotationAnimationProbe(width, displayMode, false),
              { width, displayMode },
            ),
          )
        }
      await page.emulateMedia({ reducedMotion: 'reduce' })
      result.animations.push(
        await page.evaluate(() => globalThis.nativeAnnotationAnimationProbe(360, 'compact', true)),
      )
      assert.deepEqual(result.errors, [])
      result.status = 'passed'
    } catch (error) {
      failed = true
      result.status = 'failed'
      result.error = String(error.stack ?? error)
    } finally {
      await browser?.close()
    }
    report.browsers.push(result)
  }
} finally {
  await server.httpServer.close()
  report.finishedAt = new Date().toISOString()
  await writeFile(
    join(evidence, 'native-colors-browser.json'),
    JSON.stringify(report, null, 2) + '\n',
  )
}
assert.equal(
  failed,
  false,
  'Native colors acceptance failed; see evidence/native-colors-browser.json',
)
