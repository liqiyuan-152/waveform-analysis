/* global window, document */
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium, firefox, webkit } from 'playwright'

const base = process.env.NATIVE_CONTROLS_URL ?? 'http://127.0.0.1:5178'
const evidence = 'openspec/changes/remove-waveform-antd-dependency/evidence'
mkdirSync(evidence, { recursive: true })
const browser = await chromium.launch()
const reports = []
try {
  for (const antd of [true, false]) {
    const page = await browser.newPage({ viewport: { width: 1100, height: 850 } })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    const prefix = antd ? 'after' : 'independent'
    const url = `${base}/tests/browser/native-controls.html${antd ? '?antd' : ''}`
    const shot = async (name) => {
      await page.waitForTimeout(250)
      await page.screenshot({ path: `${evidence}/${prefix}-${name}.png` })
    }
    await page.goto(url)
    await page.locator('.waveform-pagination').waitFor()
    await shot('pagination-first')
    assert.equal(await page.getByRole('button', { name: '上一页', exact: true }).isDisabled(), true)
    await page.getByRole('button', { name: '第 1 页', exact: true }).hover()
    await shot('pagination-hover')
    await page.getByRole('button', { name: '向后 5 页' }).click()
    assert.equal(await page.locator('[aria-current="page"]').textContent(), '6')
    await shot('pagination-middle')
    await page.getByRole('button', { name: '第 12 页', exact: true }).click()
    assert.equal(await page.getByRole('button', { name: '下一页', exact: true }).isDisabled(), true)
    await shot('pagination-last')
    await page.locator('#open-editor').click()
    await page.locator('.current-color').first().waitFor()
    assert.equal(
      await page.getByLabel('标注文本').evaluate((node) => node === document.activeElement),
      true,
    )
    const desktop = await page.locator('.waveform-modal').boundingBox()
    assert.equal(desktop.width, 440)
    assert.equal(desktop.y, 100)
    assert.ok(
      Math.abs(desktop.height - 587.90625) < 1,
      `Unexpected editor height: ${desktop.height}`,
    )
    await shot('editor-edit')
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press(i % 2 ? 'Shift+Tab' : 'Tab')
      assert.equal(await page.evaluate(() => !!document.activeElement.closest('dialog')), true)
    }
    const time = page.getByRole('spinbutton', { name: '标注横轴时间' })
    await time.focus()
    await shot('input-focus')
    await time.fill('1000')
    await time.press('ArrowUp')
    assert.equal(await time.inputValue(), '1000.001')
    await time.fill('')
    await page.getByLabel('标注文本').focus()
    assert.equal(await page.getByRole('alert').textContent(), '请输入有效的时间')
    assert.equal(await page.getByRole('button', { name: '保存标注' }).isDisabled(), true)
    await shot('input-error')
    await time.fill('1000')
    await page.getByLabel('标注文本').focus()
    await page.locator('.current-color').first().click()
    await page.locator('.vc-colorpicker').waitFor()
    const popup = await page.locator('.vc-colorpicker').evaluate((node) => {
      const r = node.getBoundingClientRect()
      return {
        inDialog: !!node.closest('dialog'),
        hittable: node.contains(document.elementFromPoint(r.x + 20, r.y + 20)),
      }
    })
    assert.equal(popup.inDialog && popup.hittable, true)
    await shot('color-popup')
    await page.keyboard.press('Escape')
    await page.locator('.vc-colorpicker').waitFor({ state: 'detached' })
    assert.equal(await page.locator('dialog[open]').count(), 1)
    await page.keyboard.press('Escape')
    await page.locator('dialog').waitFor({ state: 'detached' })
    assert.equal(
      await page.locator('#open-editor').evaluate((node) => node === document.activeElement),
      true,
    )
    assert.equal(await page.evaluate(() => document.body.style.overflow), '')
    await page.evaluate(() => window.nativeControls.configure({ mode: 'add' }))
    await page.locator('#open-editor').click()
    await page.locator('.current-color').first().waitFor()
    await shot('editor-add')
    await page.getByLabel('标注文本').fill('快捷保存')
    await page.getByLabel('标注文本').press('Control+Enter')
    await page.locator('dialog').waitFor({ state: 'detached' })
    assert.equal(
      await page.evaluate(() =>
        window.nativeControls.events.some(([event]) => event === 'confirm'),
      ),
      true,
    )
    await page.setViewportSize({ width: 390, height: 844 })
    await page.reload()
    await page.waitForFunction(() => !!window.nativeControls)
    await page.evaluate(() => window.nativeControls.configure({ width: 342 }))
    assert.equal((await page.locator('.waveform-pagination').boundingBox()).height, 32)
    await shot('pagination-small')
    await page.getByRole('button', { name: '向后 5 页' }).click()
    assert.equal((await page.locator('.waveform-pagination').boundingBox()).height, 32)
    await shot('pagination-small-middle')
    await page.getByRole('button', { name: '第 1 页', exact: true }).click()
    await page.locator('#open-editor').click()
    await page.locator('.current-color').first().waitFor()
    const small = await page.locator('.waveform-modal').boundingBox()
    assert.equal(small.width, 374)
    assert.equal(small.y, 108)
    assert.ok(Math.abs(small.height - 617.1875) < 1)
    await shot('editor-small')
    await page.keyboard.press('Escape')
    await page.locator('dialog').waitFor({ state: 'detached' })
    // Typical host resets must not change component geometry or leak to host controls.
    await page.addStyleTag({
      content:
        'button,input { padding: 20px; color: red; background: pink; border: 4px solid red; border-radius: 20px; font: 24px serif; text-transform: uppercase; }',
    })
    const hostBefore = await page.locator('#open-editor').boundingBox()
    await page.locator('#open-editor').click()
    await page.locator('.current-color').first().waitFor()
    assert.equal((await time.boundingBox()).height, 30)
    assert.equal((await page.getByRole('button', { name: '保存标注' }).boundingBox()).height, 32)
    await shot('host-reset')
    await page.keyboard.press('Escape')
    assert.deepEqual(await page.locator('#open-editor').boundingBox(), hostBefore)
    assert.deepEqual(errors, [])
    reports.push({
      antd,
      desktop,
      small,
      popup,
      errors,
      checks:
        'pagination, focus containment/restore, time stepping/validation, popup Escape, shortcut save, small viewport, host resets',
    })
    await page.close()
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(base)
  await page.locator('.waveform-chart').first().waitFor()
  assert.ok((await page.locator('.ant-input-number, .ant-select, .ant-btn').count()) > 0)
  await page.screenshot({ path: `${evidence}/demo-desktop.png` })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: `${evidence}/demo-small.png` })
  await page.close()
  // Native modality is supplied by the browser, so verify it beyond jsdom and Chromium.
  for (const [engine, type] of Object.entries({ firefox, webkit })) {
    const other = await type.launch()
    try {
      const page = await other.newPage({ viewport: { width: 1100, height: 850 } })
      await page.goto(`${base}/tests/browser/native-controls.html`)
      await page.locator('#open-editor').focus()
      await page.locator('#open-editor').press('Enter')
      await page.locator('.current-color').first().waitFor()
      await page.getByRole('spinbutton', { name: '标注横轴时间' }).press('ArrowUp')
      await page.locator('.current-color').first().click()
      await page.locator('.vc-colorpicker').waitFor()
      await page.keyboard.press('Escape')
      await page.locator('.vc-colorpicker').waitFor({ state: 'detached' })
      assert.equal(await page.locator('dialog[open]').count(), 1)
      await page.evaluate(() => window.nativeControls.openSecond())
      await page.locator('dialog[open]').nth(1).waitFor()
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Tab')
        assert.equal(
          await page.evaluate(
            () =>
              document.activeElement.closest('dialog') ===
              [...document.querySelectorAll('dialog')].at(-1),
          ),
          true,
        )
      }
      await page.evaluate(() => window.nativeControls.closeFirst())
      await page.waitForFunction(() => document.querySelectorAll('dialog').length === 1)
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden')
      await page.keyboard.press('Escape')
      await page.locator('dialog').waitFor({ state: 'detached' })
      assert.equal(await page.evaluate(() => document.body.style.overflow), '')
      assert.equal(
        await page.locator('#open-editor').evaluate((node) => node === document.activeElement),
        true,
      )
      reports.push({
        engine,
        checks:
          'native focus containment, popup Escape, nested dialogs, out-of-order cleanup and focus/scroll restore',
      })
    } finally {
      await other.close()
    }
  }
  writeFileSync(`${evidence}/browser-verification.json`, JSON.stringify(reports, null, 2))
  console.log('Native controls browser verification passed (with/without antd and demo).')
} finally {
  await browser.close()
}
