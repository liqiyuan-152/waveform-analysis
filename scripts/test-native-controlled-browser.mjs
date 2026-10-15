import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium, firefox, webkit } from 'playwright'
import { build, preview } from 'vite'

const evidence = resolve('openspec/changes/decouple-waveform-engine-from-vue/evidence')
await mkdir(evidence, { recursive: true })
const outDir = await mkdtemp(join(tmpdir(), 'waveform-native-controlled-'))
await build({
  build: { outDir, rolldownOptions: { input: resolve('tests/browser/native-gestures.html') } },
})
const server = await preview({ build: { outDir }, preview: { port: 5198, strictPort: true } })
const report = {
  startedAt: new Date().toISOString(),
  node: process.version,
  scope:
    '受控模式与图例请求/回传、稳定 ID 重排、API 命令生命周期及有效控制状态通知的 Vue/native 对照；原生工具栏接入由第 8 阶段验收',
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
  const value = await page.evaluate(() => globalThis.nativeGesturesProbe.controlSnapshot())
  assert.deepEqual(comparable(value.native), comparable(value.vue), `${stage}: control snapshot`)
  assert.deepEqual(
    comparable(value.nativeEvents),
    comparable(value.vueEvents),
    `${stage}: gesture/command protocol`,
  )
  assert.deepEqual(
    comparable(value.nativeControlEvents),
    comparable(value.vueControlEvents),
    `${stage}: controlled/state protocol`,
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
          await page.evaluate(
            ({ width, displayMode }) =>
              globalThis.nativeGesturesProbe.setup(width, displayMode, {
                interactionMode: 'zoom',
                hiddenSeriesIds: ['b', 'absent'],
                legend: { interactive: true },
                overlayMode: 'multi-axis',
                data: {
                  kind: 'series',
                  series: ['a', 'b'].map((id, index) => ({
                    id,
                    trackId: 'group',
                    name: id,
                    data: {
                      kind: 'points',
                      points: Array.from({ length: 101 }, (_, i) => ({
                        x: i / 10,
                        y: (index + 1) * i,
                      })),
                    },
                  })),
                },
              }),
            { width, displayMode },
          )
          const initial = await snapshot(page, 'initial')
          assert.equal(initial.native.mode, 'zoom')
          assert.deepEqual(initial.nativeControlEvents, {})
          for (const id of ['native', 'vue'])
            await page.locator(`#${id} .waveform-chart__legend-item`).first().click()
          await page.evaluate(() => globalThis.nativeGesturesProbe.settle())
          const requested = await snapshot(page, 'visibility request')
          assert.deepEqual(requested.native, initial.native)
          assert.deepEqual(requested.nativeControlEvents['update:hidden-series-ids'], [
            [['b', 'absent', 'a']],
          ])
          assert.equal(requested.nativeControlEvents['control-state-change'], undefined)
          for (const id of ['native', 'vue'])
            assert.equal(
              await page
                .locator(`#${id} .waveform-chart__legend-item`)
                .first()
                .getAttribute('aria-pressed'),
              'true',
            )
          const modeRequest = await page.evaluate(() => globalThis.nativeGesturesProbe.mode('pan'))
          assert.deepEqual(modeRequest.native, modeRequest.vue)
          assert.equal(modeRequest.native.status, 'requested')
          const unchanged = await snapshot(page, 'mode request')
          assert.equal(unchanged.native.mode, 'zoom')
          assert.equal(unchanged.nativeControlEvents['control-state-change'], undefined)
          await page.evaluate(() =>
            globalThis.nativeGesturesProbe.patch({
              interactionMode: 'pan',
              hiddenSeriesIds: ['a'],
            }),
          )
          const acknowledged = await snapshot(page, 'host acknowledgement')
          assert.equal(acknowledged.native.mode, 'pan')
          assert.deepEqual(acknowledged.nativeControlEvents['interaction-mode-change'], [['pan']])
          assert.equal(acknowledged.nativeControlEvents['control-state-change'].length, 1)
          for (const id of ['native', 'vue'])
            assert.equal(
              await page
                .locator(`#${id} .waveform-chart__legend-item`)
                .last()
                .getAttribute('aria-pressed'),
              'true',
            )
          await page.evaluate(() => {
            const input = globalThis.nativeGesturesProbe.windowData(0, 101, ['b', 'a'])
            input.series.forEach((series) => {
              series.trackId = 'group'
            })
            return globalThis.nativeGesturesProbe.patch({ data: input })
          })
          await snapshot(page, 'reordered data')
          for (const id of ['native', 'vue'])
            assert.equal(
              await page
                .locator(`#${id} .waveform-chart__legend-item`)
                .first()
                .getAttribute('aria-pressed'),
              'true',
            )
          for (const type of ['zoom-in', 'zoom-out', 'fit', 'reset']) {
            const result = await page.evaluate(
              (type) => globalThis.nativeGesturesProbe.command(type),
              type,
            )
            assert.deepEqual(
              comparable(result.native),
              comparable(result.vue),
              `${name}/${displayMode}/${type}: result`,
            )
            await snapshot(page, type)
          }
          const final = await snapshot(page, 'final')
          await page.screenshot({
            path: join(evidence, `native-controlled-${name}-${width}-${displayMode}.png`),
          })
          result.probes.push({ width, displayMode, initial, requested, acknowledged, final })
          await page.evaluate(() => globalThis.nativeGesturesProbe.dispose())
          assert.equal(await page.locator('.waveform-chart').count(), 0)
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
    join(evidence, 'native-controlled-browser.json'),
    JSON.stringify(report, null, 2) + '\n',
  )
}
assert.equal(
  failed,
  false,
  'Native controlled-state acceptance failed; see evidence/native-controlled-browser.json',
)
