/* global window, document */
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

export async function verifyPackageNativeControls(url) {
  const evidence =
    process.env.WAVEFORM_PACKAGE_EVIDENCE_DIR ??
    'openspec/changes/remove-waveform-antd-dependency/evidence'
  mkdirSync(evidence, { recursive: true })
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 850 } })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(url)
    await page.locator('.waveform-pagination').waitFor()
    assert.equal(await page.evaluate(() => window.packageControls.nativeEntryIdentity), true)
    assert.deepEqual(await page.evaluate(() => window.packageControls.verifyWasm()), [0, 1, 2, 3])
    const worker = await page.evaluate(() => window.packageControls.verifyWorkerWasm())
    assert.equal(worker.backend, 'wasm')
    assert.ok(worker.points > 0 && worker.points < 2000)
    await page.getByRole('button', { name: '下一页', exact: true }).click()
    await page.waitForFunction(
      () => document.querySelector('[aria-current="page"]')?.textContent === '2',
    )
    assert.equal(await page.locator('[aria-current="page"]').textContent(), '2')
    await page.getByRole('button', { name: '上一页', exact: true }).click()
    await page.waitForFunction(
      () => document.querySelector('[aria-current="page"]')?.textContent === '1',
    )
    await page.locator('.waveform-chart__overlay').click({ position: { x: 350, y: 100 } })
    await page.getByRole('button', { name: '标注边框色', exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: '保存标注' }).isDisabled(), true)
    const time = page.getByRole('spinbutton', { name: '标注横轴时间' })
    await time.fill('1200')
    await page.getByLabel('标注文本').fill('消费页新增标注')
    await page.getByRole('button', { name: '标注边框色', exact: true }).click()
    await page.getByLabel('标注边框色精确值', { exact: true }).fill('#123456')
    await page.getByLabel('标注边框色透明度', { exact: true }).fill('37')
    await page.getByRole('button', { name: '保存标注' }).click()
    await page.locator('dialog').waitFor({ state: 'detached' })
    const created = await page.evaluate(() => window.packageControls.annotations()[0])
    assert.equal(created.text, '消费页新增标注')
    assert.equal(created.x, 1)
    assert.match(created.style.borderColor, /^rgba\(/)
    assert.equal(created.style.borderColor, 'rgba(18, 52, 86, 0.37)')
    await page.locator('.waveform-annotation__box').click({ button: 'right' })
    await page.getByRole('menuitem', { name: '编辑标注', exact: true }).click()
    await page.getByLabel('标注文本').fill('消费页编辑标注')
    await page.getByRole('button', { name: '保存标注' }).click()
    await page.locator('dialog').waitFor({ state: 'detached' })
    assert.equal(
      await page.evaluate(() => window.packageControls.annotations()[0].text),
      '消费页编辑标注',
    )
    await page.locator('.waveform-annotation__box').click({ button: 'right' })
    await page.getByRole('menuitem', { name: '编辑标注', exact: true }).click()
    await page.getByRole('button', { name: '标注边框色', exact: true }).waitFor()
    await time.fill('1000000')
    await page.getByLabel('标注文本').focus()
    await page.getByRole('alert').filter({ hasText: '范围' }).waitFor()
    assert.equal(await page.getByRole('button', { name: '保存标注' }).isDisabled(), true)
    await page.screenshot({ path: `${evidence}/packed-consumer-desktop.png` })
    await page.keyboard.press('Escape')
    await page.setViewportSize({ width: 360, height: 844 })
    await page.evaluate(() => window.packageControls.resize(312))
    await page.locator('.waveform-annotation__box').click({ button: 'right' })
    await page.getByRole('menuitem', { name: '编辑标注', exact: true }).click()
    await page.getByRole('button', { name: '标注边框色', exact: true }).waitFor()
    await page.screenshot({ path: `${evidence}/packed-consumer-small.png` })
    await page.evaluate(() => window.packageControls.dispose())
    assert.equal(await page.locator('dialog').count(), 0)
    assert.equal(await page.evaluate(() => document.body.style.overflow), '')
    assert.deepEqual(errors, [])
    console.log(
      'Packed consumer browser: root/native function and instance identity, pagination, annotation CRUD, full-data snapping, colors, validation, small viewport and cleanup passed.',
    )
  } finally {
    await browser.close()
  }
}
