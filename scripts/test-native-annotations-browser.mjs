import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium, firefox, webkit } from 'playwright'
import { build, preview } from 'vite'

const evidence = resolve('openspec/changes/decouple-waveform-engine-from-vue/evidence')
await mkdir(evidence, { recursive: true })
const outDir = await mkdtemp(join(tmpdir(), 'waveform-native-annotations-'))
await build({
  build: { outDir, rolldownOptions: { input: resolve('tests/browser/native-gestures.html') } },
})
const server = await preview({ build: { outDir }, preview: { port: 5198, strictPort: true } })
const report = {
  startedAt: new Date().toISOString(),
  node: process.version,
  scope:
    '第 8.1 阶段：SVG 标注布局、受控拖拽/回传、重投影、隐藏和菜单删除的 Vue/native 对照；编辑器与标注动画另行验收',
  browsers: [],
}
function comparable(value) {
  if (typeof value === 'number') return Number(value.toPrecision(12))
  if (Array.isArray(value)) return value.map(comparable)
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, comparable(item)]))
  return value
}
async function snapshot(page, stage) {
  const value = await page.evaluate(() => globalThis.nativeGesturesProbe.annotationSnapshot())
  assert.deepEqual(
    comparable(value.native),
    comparable(value.vue),
    `${stage}: annotation geometry/style`,
  )
  assert.deepEqual(
    value.nativeAnnotationEvents,
    value.vueAnnotationEvents,
    `${stage}: parameter tuples`,
  )
  return value
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
          const annotations = ['a', 'b'].map((id, index) => ({
            id: `note-${id}`,
            seriesId: id,
            x: 5,
            y: index + 1,
            text: `通道 ${id} 中文标注`,
            style: {
              borderColor: '#123456',
              textColor: '#654321',
              backgroundColor: 'rgba(255, 200, 100, 0.5)',
            },
          }))
          await page.evaluate(
            ({ width, displayMode, annotations }) =>
              globalThis.nativeGesturesProbe.setup(width, displayMode, {
                annotations,
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
                        { x: 5, y: index + 1 },
                        { x: 10, y: 0 },
                      ],
                    },
                  })),
                },
              }),
            { width, displayMode, annotations },
          )
          const initial = await snapshot(page, 'initial')
          for (const id of ['native', 'vue']) {
            const rect = await page
              .locator(`#${id} [data-annotation-id="note-b"] rect`)
              .boundingBox()
            assert.ok(rect)
            const x = rect.x + rect.width / 2,
              y = rect.y + rect.height / 2
            await page.mouse.move(x, y)
            await page.mouse.down()
            await page.mouse.move(x + 20, y + 12, { steps: 4 })
            await page.mouse.up()
          }
          await page.evaluate(() => globalThis.nativeGesturesProbe.settle())
          const requested = await snapshot(page, 'drag request and preview')
          const replacement = requested.nativeAnnotationEvents['update:annotations'][0][0]
          assert.equal(replacement[1].labelOffsetX, 20)
          assert.equal(replacement[1].labelOffsetY, 12)
          assert.equal(requested.nativeAnnotationEvents['annotation-update'], undefined)
          await page.evaluate(
            (annotations) => globalThis.nativeGesturesProbe.patch({ annotations }),
            replacement,
          )
          const acknowledged = await snapshot(page, 'acknowledged offsets')
          await page.evaluate(() => globalThis.nativeGesturesProbe.domain([2, 8]))
          const projected = await snapshot(page, 'viewport reprojection')
          await page.evaluate(() =>
            globalThis.nativeGesturesProbe.patch({ hiddenSeriesIds: ['b'] }),
          )
          assert.equal((await snapshot(page, 'hidden series')).native.length, 1)
          await page.evaluate(() => globalThis.nativeGesturesProbe.patch({ hiddenSeriesIds: [] }))
          for (const id of ['native', 'vue']) {
            await page
              .locator(`#${id} [data-annotation-id="note-b"] rect`)
              .click({ button: 'right' })
            await page.locator(`#${id} .waveform-annotation-context-menu button`).nth(1).click()
          }
          await page.evaluate(() => globalThis.nativeGesturesProbe.settle())
          const deleted = await snapshot(page, 'controlled delete request')
          assert.equal(deleted.native.length, 2)
          const last = deleted.nativeAnnotationEvents['update:annotations'].at(-1)[0]
          assert.equal(last.length, 1)
          assert.deepEqual(deleted.nativeAnnotationEvents['annotation-delete'], [[replacement[1]]])
          await page.evaluate(
            (annotations) => globalThis.nativeGesturesProbe.patch({ annotations }),
            last,
          )
          const final = await snapshot(page, 'delete acknowledged')
          assert.equal(final.native.length, 1)
          await page.mouse.move(0, 0)
          await page.screenshot({
            path: join(evidence, `native-annotations-${name}-${width}-${displayMode}.png`),
          })
          result.probes.push({
            width,
            displayMode,
            initial,
            requested,
            acknowledged,
            projected,
            deleted,
            final,
          })
          await page.evaluate(() => globalThis.nativeGesturesProbe.dispose())
          assert.equal(
            await page.locator('.waveform-chart, .waveform-annotation-context-menu').count(),
            0,
          )
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
    join(evidence, 'native-annotations-browser.json'),
    JSON.stringify(report, null, 2) + '\n',
  )
}
assert.equal(
  failed,
  false,
  'Native annotation acceptance failed; see evidence/native-annotations-browser.json',
)
