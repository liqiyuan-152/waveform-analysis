import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium, firefox, webkit } from 'playwright'
import { build, preview } from 'vite'

const evidence = resolve('openspec/changes/decouple-waveform-engine-from-vue/evidence')
await mkdir(evidence, { recursive: true })
const outDir = await mkdtemp(join(tmpdir(), 'waveform-native-editor-'))
await build({
  build: { outDir, rolldownOptions: { input: resolve('tests/browser/native-gestures.html') } },
})
const server = await preview({ build: { outDir }, preview: { port: 5198, strictPort: true } })
const report = {
  startedAt: new Date().toISOString(),
  node: process.version,
  scope:
    '第 8.2 阶段：原生/Vue 标注编辑器的文本/时间校验、步进、系列选择、保存取消、受控创建及回传对照；颜色控件与标注动画仍待 8.3，独立第二列本地时间查询单独验证原生纠正行为',
  browsers: [],
}
function comparable(value, ids = []) {
  if (typeof value === 'number') return Number(value.toPrecision(12))
  if (typeof value === 'string' && ids.includes(value)) return '<created-id>'
  if (Array.isArray(value)) return value.map((item) => comparable(item, ids))
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        key === 'createdAt' ? '<created-at>' : comparable(item, ids),
      ]),
    )
  return value
}
async function snapshot(page, stage) {
  const value = await page.evaluate(() => globalThis.nativeGesturesProbe.annotationSnapshot())
  const ids = [value.nativeAnnotationEvents, value.vueAnnotationEvents].flatMap((events) =>
    (events['annotation-create'] ?? []).map(([annotation]) => annotation.id),
  )
  assert.deepEqual(
    comparable(value.native, ids),
    comparable(value.vue, ids),
    `${stage}: geometry/style`,
  )
  assert.deepEqual(
    comparable(value.nativeAnnotationEvents, ids),
    comparable(value.vueAnnotationEvents, ids),
    `${stage}: exact event tuples`,
  )
  return value
}
async function edit(page, id) {
  await page.locator(`#${id} [data-annotation-id="note"] rect`).click({ button: 'right' })
  await page.locator(`#${id} .waveform-annotation-context-menu button`).first().click()
  const dialog = page.locator('dialog[open]').last()
  await dialog.locator('textarea').waitFor({ state: 'visible' })
  return dialog
}
let failed = false
try {
  for (const [name, driver] of Object.entries({ chromium, firefox, webkit })) {
    const result = { name, probes: [], errors: [] }
    let browser
    try {
      browser = await driver.launch()
      result.version = browser.version()
      const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
      page.on('pageerror', (error) => result.errors.push(error.message))
      await page.goto('http://localhost:5198/tests/browser/native-gestures.html')
      await page.waitForFunction(() => !!globalThis.nativeGesturesProbe)
      for (const width of [1200, 360])
        for (const displayMode of ['independent', 'separated', 'compact']) {
          await page.setViewportSize({ width: width === 360 ? 390 : 1280, height: 1000 })
          const annotation = {
            id: 'note',
            seriesId: 'a',
            x: 1,
            y: 10,
            text: '原文字',
            style: {
              borderColor: 'rgba(22, 119, 255, 0.7)',
              textColor: '#333333',
              backgroundColor: 'rgba(255, 255, 255, 0.5)',
            },
          }
          await page.evaluate(
            ({ width, displayMode, annotation }) =>
              globalThis.nativeGesturesProbe.setup(width, displayMode, {
                interactionMode: 'annotation',
                annotations: [annotation],
                data: {
                  kind: 'series',
                  series: ['a', 'b'].map((id, index) => ({
                    id,
                    name: `通道 ${id}`,
                    trackId: 'group',
                    unit: 'V',
                    data: {
                      kind: 'points',
                      points: [
                        { x: 0, y: index * 100 },
                        { x: 1, y: index ? 150 : 10 },
                        { x: 2, y: index ? 200 : 20 },
                      ],
                    },
                  })),
                },
              }),
            { width, displayMode, annotation },
          )
          const forms = []
          for (const id of ['native', 'vue']) {
            const dialog = await edit(page, id)
            const input = dialog.locator('[aria-label="标注横轴时间"]'),
              text = dialog.locator('textarea')
            assert.equal(await input.inputValue(), '1000.000')
            assert.equal(await text.getAttribute('maxlength'), '40')
            await input.fill('3000')
            await text.click()
            assert.equal(await dialog.locator('[role="alert"]').innerText(), '时间超出当前波形范围')
            assert.equal(
              await dialog.locator('.waveform-modal__button--primary').isDisabled(),
              true,
            )
            await input.fill('1500')
            await input.press('ArrowUp')
            assert.equal(await input.inputValue(), '1500.001')
            await input.press('ArrowDown')
            await text.fill('  修改\n说明  ')
            await dialog.locator('[aria-label="选择标注波形"]').selectOption('b')
            assert.equal(
              await dialog
                .locator('.waveform-annotation-editor__coordinates span code')
                .innerText(),
              '200',
            )
            const values = {
              time: await input.inputValue(),
              text: await text.inputValue(),
              series: await dialog.locator('select').inputValue(),
            }
            forms.push(values)
            await page.screenshot({
              path: join(evidence, `native-editor-${name}-${width}-${displayMode}-${id}.png`),
            })
            await dialog.locator('.waveform-modal__button--primary').click()
            await page.evaluate(() => globalThis.nativeGesturesProbe.settle())
            assert.equal(await page.locator('dialog[open]').count(), 0)
            assert.equal(
              await page.locator(`#${id} .waveform-annotation__text`).textContent(),
              '原文字',
            )
          }
          assert.deepEqual(forms[0], forms[1])
          const edited = await snapshot(page, 'edited request')
          const replacement = edited.nativeAnnotationEvents['update:annotations'][0][0]
          assert.deepEqual(edited.nativeAnnotationEvents['annotation-update'], [
            [{ ...annotation, seriesId: 'b', x: 2, y: 200, text: '修改\n说明' }, annotation],
          ])
          await page.evaluate(
            (annotations) => globalThis.nativeGesturesProbe.patch({ annotations }),
            replacement,
          )
          await snapshot(page, 'edited acknowledged')
          for (const id of ['native', 'vue']) {
            const dialog = await edit(page, id)
            await dialog.locator('textarea').fill('取消的编辑')
            await dialog.locator('[aria-label="关闭"]').click()
          }
          const canceled = await snapshot(page, 'cancel')
          assert.deepEqual(canceled.nativeAnnotationEvents, edited.nativeAnnotationEvents)
          for (const id of ['native', 'vue']) {
            const rect = await page.locator(`#${id} .waveform-chart__overlay`).first().boundingBox()
            assert.ok(rect)
            await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height * 0.95)
            const dialog = page.locator('dialog[open]').last()
            await dialog.locator('textarea').fill('  新标注  ')
            await dialog.locator('.waveform-modal__button--primary').click()
            await page.evaluate(() => globalThis.nativeGesturesProbe.settle())
          }
          const created = await snapshot(page, 'create request')
          assert.equal(created.native.length, 1)
          const next = created.nativeAnnotationEvents['update:annotations'].at(-1)[0]
          assert.equal(next[1].text, '新标注')
          assert.equal(next[1].x, 1)
          assert.equal(next[1].seriesId, 'a')
          await page.evaluate(
            (annotations) => globalThis.nativeGesturesProbe.patch({ annotations }),
            next,
          )
          const final = await snapshot(page, 'create acknowledged')
          assert.equal(final.native.length, 2)
          result.probes.push({ width, displayMode, forms, edited, created, final })
          if (displayMode === 'independent') {
            await page.evaluate(
              ({ width }) =>
                globalThis.nativeGesturesProbe.setup(width, 'independent', {
                  interactionMode: 'annotation',
                  annotations: [],
                  grid: { rowCount: 1, columnCount: 2 },
                  data: {
                    kind: 'series',
                    series: ['a', 'b'].map((id, index) => ({
                      id,
                      name: id,
                      data: {
                        kind: 'points',
                        points: [
                          { x: 0, y: 0 },
                          { x: 1, y: (index + 1) * 10 },
                          { x: 2, y: 0 },
                        ],
                      },
                    })),
                  },
                }),
              { width },
            )
            const rect = await page.locator('#native .waveform-chart__overlay').nth(1).boundingBox()
            await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2)
            const dialog = page.locator('dialog[open]')
            assert.equal(
              await dialog.locator('[aria-label="标注横轴时间"]').inputValue(),
              '1000.000',
            )
            await dialog.locator('textarea').fill('第二列标注')
            await dialog.locator('.waveform-modal__button--primary').click()
            const column = await page.evaluate(() =>
              globalThis.nativeGesturesProbe.annotationSnapshot(),
            )
            assert.equal(column.nativeAnnotationEvents['annotation-create'][0][0].x, 1)
            assert.equal(column.nativeAnnotationEvents['annotation-create'][0][0].seriesId, 'b')
            result.probes.at(-1).independentSecondColumn = column.nativeAnnotationEvents
          }
          await page.evaluate(() => globalThis.nativeGesturesProbe.dispose())
          assert.equal(await page.locator('.waveform-chart, dialog').count(), 0)
        }
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
    join(evidence, 'native-editor-browser.json'),
    JSON.stringify(report, null, 2) + '\n',
  )
}
assert.equal(
  failed,
  false,
  'Native editor acceptance failed; see evidence/native-editor-browser.json',
)
