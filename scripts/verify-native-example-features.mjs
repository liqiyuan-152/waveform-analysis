/* global window, document */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

/** Operate the real consumer controls; diagnostics only read public chart state. */
export async function verifyExampleFeatures(page) {
  const chart = page.locator('.example-chart').first()
  const readDomain = () =>
    page.evaluate(() => window.nativeExample.snapshot().charts[0].targets[0].viewport.xDomain)
  const original = await readDomain()
  const span = ([start, end]) => end - start
  await chart
    .locator('.example-controls')
    .getByRole('button', { name: '放大', exact: true })
    .click()
  await page.waitForFunction((width) => {
    const [start, end] = window.nativeExample.snapshot().charts[0].targets[0].viewport.xDomain
    return end - start < width
  }, span(original))
  const zoomed = await readDomain()
  await chart
    .locator('.example-controls')
    .getByRole('button', { name: '缩小', exact: true })
    .click()
  await page.waitForFunction((width) => {
    const [start, end] = window.nativeExample.snapshot().charts[0].targets[0].viewport.xDomain
    return end - start > width
  }, span(zoomed))
  await chart
    .locator('.example-controls')
    .getByRole('button', { name: '重置视口', exact: true })
    .click()
  await page.waitForFunction(
    (domain) => JSON.stringify(window.nativeExample.snapshot().domain) === JSON.stringify(domain),
    original,
  )
  await chart
    .locator('.example-controls')
    .getByRole('button', { name: '显示全部', exact: true })
    .click()
  await page.waitForFunction(() =>
    window.nativeExample.snapshot().charts[0].targets.every((target) => !target.available.fit),
  )
  // A core toolbar request must round-trip through framework-controlled state.
  await chart.locator('.example-host').hover()
  await chart.locator('[data-command="pan"]').click()
  await page.waitForFunction(() => window.nativeExample.snapshot().charts[0].mode === 'pan')
  assert.equal(
    await chart
      .locator('.example-controls')
      .getByRole('button', { name: '平移模式', exact: true })
      .getAttribute('aria-pressed'),
    'true',
  )
  await chart
    .locator('.example-controls')
    .getByRole('button', { name: '切换通道 2', exact: true })
    .click()
  await page.waitForFunction(() =>
    document.querySelector('.example-state')?.textContent.includes('隐藏 1'),
  )
  await chart.locator('.waveform-legend__item[data-series-id="b"]').click()
  await page.waitForFunction(() =>
    document.querySelector('.example-state')?.textContent.includes('隐藏 0'),
  )
  await chart
    .locator('.example-controls')
    .getByRole('button', { name: '标注模式', exact: true })
    .click()
  await page.waitForFunction(() => window.nativeExample.snapshot().charts[0].mode === 'annotation')
  await chart.locator('.waveform-chart__overlay').click({ position: { x: 100, y: 100 } })
  await page.getByLabel('标注文本', { exact: true }).fill('示例受控标注')
  await page.getByRole('spinbutton', { name: '标注横轴时间', exact: true }).fill('1250')
  await page.getByRole('button', { name: '保存标注', exact: true }).click()
  await chart.locator('.waveform-annotation__text').filter({ hasText: '示例受控标注' }).waitFor()
  assert.match(await chart.locator('.example-state').textContent(), /标注 1/)
  await chart.locator('.waveform-annotation__box').click({ button: 'right' })
  await page.getByRole('menuitem', { name: '编辑标注', exact: true }).click()
  await page.getByLabel('标注文本', { exact: true }).fill('编辑后的标注')
  await page.getByRole('button', { name: '保存标注', exact: true }).click()
  await chart.locator('.waveform-annotation__text').filter({ hasText: '编辑后的标注' }).waitFor()

  const exports = []
  for (const format of ['SVG', 'PNG']) {
    const pending = page.waitForEvent('download')
    await chart
      .locator('.example-controls')
      .getByRole('button', { name: `导出 ${format}`, exact: true })
      .click()
    const download = await pending
    assert.equal(download.suggestedFilename(), `waveform-example.${format.toLowerCase()}`)
    assert.equal(await download.failure(), null)
    const contents = await readFile(await download.path())
    if (format === 'SVG') {
      assert.match(contents.toString('utf8'), /编辑后的标注/)
      assert.doesNotMatch(contents.toString('utf8'), /<foreignObject|<button/)
    } else {
      assert.equal(contents.subarray(1, 4).toString(), 'PNG')
      assert.ok(contents.readUInt32BE(16) > 0)
      assert.ok(contents.readUInt32BE(20) > 0)
    }
    await page.waitForFunction(
      (format) =>
        document.querySelector('.example-export-status')?.textContent === `已导出 ${format}`,
      format,
    )
    exports.push({ format, bytes: contents.length })
  }
  assert.equal(await page.evaluate(() => window.exampleObjectUrls.size), 0)
  await chart
    .locator('.example-controls')
    .getByRole('button', { name: '清空标注', exact: true })
    .click()
  await chart.locator('.waveform-annotation__box').waitFor({ state: 'detached' })
  await chart
    .locator('.example-controls')
    .getByRole('button', { name: '缩放模式', exact: true })
    .click()
  await page.waitForFunction(() => window.nativeExample.snapshot().charts[0].mode === 'zoom')
  return {
    zoom: true,
    controlledMode: true,
    controlledVisibility: true,
    annotations: true,
    exports,
  }
}

export async function verifyExampleInstances(page) {
  await page.getByRole('button', { name: '第二个图表', exact: true }).click()
  await page.waitForFunction(() => window.nativeExample.snapshot().registered === 2)
  const charts = page.locator('.example-chart')
  const first = charts.nth(0)
  const second = charts.nth(1)
  const before = await page.evaluate(() => window.nativeExample.snapshot().charts[1])
  await first
    .locator('.example-controls')
    .getByRole('button', { name: '放大', exact: true })
    .click()
  await first
    .locator('.example-controls')
    .getByRole('button', { name: '标注模式', exact: true })
    .click()
  await first
    .locator('.example-controls')
    .getByRole('button', { name: '切换通道 2', exact: true })
    .click()
  await page.waitForFunction(() => window.nativeExample.snapshot().charts[0].mode === 'annotation')
  assert.deepEqual(await page.evaluate(() => window.nativeExample.snapshot().charts[1]), before)
  assert.match(await second.locator('.example-state').textContent(), /标注 0.*隐藏 0.*zoom/)
  // Hold the documented font barrier so unmount happens during an actual pending export.
  let lateDownloads = 0
  const downloaded = () => lateDownloads++
  page.on('download', downloaded)
  await page.evaluate(() => {
    Object.defineProperty(document.fonts, 'ready', {
      configurable: true,
      value: new Promise((resolve) => (window.releaseExampleFonts = resolve)),
    })
  })
  await first
    .locator('.example-controls')
    .getByRole('button', { name: '导出 PNG', exact: true })
    .click()
  await page.waitForFunction(() =>
    document.querySelector('.example-export-status')?.textContent.includes('正在导出'),
  )
  await page.getByRole('button', { name: '挂载 / 卸载', exact: true }).click()
  await page.waitForFunction(() => window.nativeExample.snapshot().registered === 1)
  await page.evaluate(async () => {
    window.releaseExampleFonts()
    Reflect.deleteProperty(document.fonts, 'ready')
    await new Promise((resolve) =>
      window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)),
    )
  })
  page.off('download', downloaded)
  assert.equal(lateDownloads, 0)
  assert.equal(await page.evaluate(() => window.exampleObjectUrls.size), 0)
  assert.deepEqual(await page.evaluate(() => window.nativeExample.snapshot().charts[0]), before)
  await page.getByRole('button', { name: '第二个图表', exact: true }).click()
  await page.waitForFunction(() => window.nativeExample.snapshot().registered === 0)
  const empty = await page.evaluate(() => window.nativeExample.snapshot())
  assert.equal(empty.roots, 0)
  assert.equal(empty.creates, empty.disposals)
  assert.equal(await page.locator('dialog, .waveform-annotation-context-menu').count(), 0)
  await page.getByRole('button', { name: '挂载 / 卸载', exact: true }).click()
  await page.waitForFunction(() => window.nativeExample.snapshot().registered === 1)
  return {
    simultaneous: 2,
    isolated: true,
    disposedIndependently: true,
    pendingExportCancelled: true,
    lateDownloads,
    empty,
    remounted: true,
  }
}
