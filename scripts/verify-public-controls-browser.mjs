/* global document, getComputedStyle, innerWidth, location */
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { preview } from 'vite'
import { chromium } from 'playwright'

const evidence = resolve('artifacts/public-controls')
await mkdir(evidence, { recursive: true })
const server = await preview({
  configFile: 'demo-app/vite.config.ts',
  preview: { host: '127.0.0.1', port: 4193 },
})
const browser = await chromium.launch()
try {
  for (const width of [1280, 360]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      colorScheme: 'light',
      reducedMotion: 'reduce',
    })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    const base = server.resolvedUrls.local[0]
    const themePicker = async (theme) => {
      if (width < 900) await page.locator('select[aria-label="界面主题"]').selectOption(theme)
      else
        await page
          .locator('.ant-segmented-item-label')
          .getByText(theme === 'dark' ? '深色' : '浅色', { exact: true })
          .click()
    }
    const menu = page.locator('.demo-shell__menu--controls')
    const slugs = ['input-number', 'select', 'color-picker', 'pagination', 'modal', 'popup']
    await page.goto(base + '#/controls')
    await page.waitForURL('**#/controls/input-number')
    await page.getByRole('heading', { name: 'InputNumber 数字输入框', exact: true }).waitFor()
    await menu.locator('summary').click()
    assert.equal(await menu.locator('a').count(), 6)
    await page.keyboard.press('Escape')
    assert.equal(await menu.getAttribute('open'), null)
    await menu.locator('summary').click()
    await page.mouse.click(width - 8, 850)
    assert.equal(await menu.getAttribute('open'), null)
    await menu.locator('summary').click()
    await page.locator('summary').getByText('波形分析', { exact: true }).click()
    assert.equal(await page.locator('.demo-shell__menu[open]').count(), 1)
    await page.keyboard.press('Escape')
    const input = page.locator('.waveform-number-input').first()
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.waitForFunction(
      () =>
        getComputedStyle(document.querySelector('.waveform-number-input')).backgroundColor ===
        'rgb(20, 20, 20)',
    )
    for (const theme of ['light', 'dark']) {
      await themePicker(theme)
      for (const slug of slugs) {
        await menu.locator('summary').click()
        await menu.locator(`a[href="#/controls/${slug}"]`).click()
        await page.waitForURL(`**#/controls/${slug}`)
        await page.locator('.control-example__card').first().waitFor()
        assert.equal(await menu.getAttribute('open'), null)
        assert.ok((await menu.locator('summary').getAttribute('class')).includes('is-active'))
        assert.equal(
          await menu.locator('a.router-link-exact-active').getAttribute('href'),
          `#/controls/${slug}`,
        )
        // Every route also supports refreshing/direct entry without mounting another demo.
        await page.reload()
        await page.locator('.control-example__card').first().waitFor()
        await page.getByLabel('示例主题', { exact: true }).selectOption('dark')
        await page.waitForFunction(() =>
          [...document.querySelectorAll('.control-example__grid [data-control-theme]')].every(
            (node) => node.dataset.controlTheme === 'dark',
          ),
        )
        await page.getByLabel('示例主题', { exact: true }).selectOption('light')
        await page.waitForFunction(() =>
          [...document.querySelectorAll('.control-example__grid [data-control-theme]')].every(
            (node) => node.dataset.controlTheme === 'light',
          ),
        )
        await page.getByLabel('示例主题', { exact: true }).selectOption('auto')
        await page.getByLabel('示例主题', { exact: true }).selectOption('global')
        if (slug === 'input-number') {
          await page.getByRole('spinbutton', { name: '数量', exact: true }).fill('25')
          await page.keyboard.press('Enter')
          assert.match(await page.getByRole('status').textContent(), /25/)
          assert.equal(
            await page.getByRole('spinbutton', { name: '禁用', exact: true }).isDisabled(),
            true,
          )
          assert.equal(
            await input.evaluate((element) => getComputedStyle(element).backgroundColor),
            theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(20, 20, 20)',
          )
        } else if (slug === 'select') {
          await page.getByRole('combobox', { name: '基本选择', exact: true }).click()
          await page.getByRole('option', { name: '选项 B', exact: true }).click()
          assert.match(await page.getByRole('status').textContent(), /b/)
          assert.equal(
            await page.getByRole('combobox', { name: '整体禁用', exact: true }).isDisabled(),
            true,
          )
        } else if (slug === 'color-picker') {
          await page.getByRole('button', { name: '基本颜色', exact: true }).click()
          await page.getByLabel('基本颜色精确值', { exact: true }).fill('123456')
          assert.match(await page.getByRole('status').textContent(), /123456/)
          await page.screenshot({
            path: resolve(evidence, `color-${theme}-${width}.png`),
            fullPage: true,
          })
          await page.keyboard.press('Escape')
        } else if (slug === 'pagination') {
          const first = page.locator('.control-example__card').first()
          await first.getByRole('button', { name: '向后 5 页', exact: true }).click()
          assert.equal(await first.locator('[aria-current="page"]').textContent(), '6')
          await page.getByRole('button', { name: '调整为 3 页', exact: true }).click()
          assert.equal(await first.locator('[aria-current="page"]').textContent(), '3')
          await page.getByRole('button', { name: '恢复 20 页', exact: true }).click()
        } else if (slug === 'modal') {
          await page.getByRole('button', { name: '打开 Modal', exact: true }).click()
          await page.getByRole('combobox', { name: '弹窗内选项' }).click()
          assert.equal(
            await page.locator('[role="listbox"]').getAttribute('data-control-theme'),
            theme,
          )
          await page.screenshot({
            path: resolve(evidence, `modal-${theme}-${width}.png`),
            fullPage: true,
          })
          await page.keyboard.press('Escape')
          await page.keyboard.press('Escape')
          await page.getByRole('dialog', { name: '基础弹窗' }).waitFor({ state: 'hidden' })
          await page.getByRole('button', { name: '打开关闭确认示例', exact: true }).click()
          await page.keyboard.press('Escape')
          assert.equal(
            await page.getByRole('dialog', { name: '关闭请求确认', exact: true }).isVisible(),
            true,
          )
          await page.getByRole('button', { name: '放弃并关闭', exact: true }).click()
          await page
            .getByRole('dialog', { name: '关闭请求确认', exact: true })
            .waitFor({ state: 'hidden' })
        } else {
          await page.getByRole('button', { name: '打开基本浮层', exact: true }).click()
          const popover = page.locator('.waveform-popover')
          assert.equal(await popover.getAttribute('data-arrow'), 'true')
          assert.equal(await popover.locator('.waveform-popover__title').textContent(), '标题')
          assert.equal(
            await popover.evaluate((node) => getComputedStyle(node).backgroundColor),
            theme === 'dark' ? 'rgb(31, 31, 31)' : 'rgb(255, 255, 255)',
          )
          const box = await popover.boundingBox()
          assert.ok(box.x >= 0 && box.x + box.width <= width)
          await page.screenshot({ path: resolve(evidence, `popover-open-${theme}-${width}.png`) })
          await page.getByRole('button', { name: '关闭浮层', exact: true }).click()
          assert.equal(await page.locator('.waveform-popup').count(), 0)
          await page.getByRole('button', { name: '悬停打开', exact: true }).hover()
          await popover.waitFor({ state: 'visible' })
          await popover.hover()
          assert.equal(await popover.isVisible(), true)
          await page.getByRole('heading', { level: 1 }).hover()
          await popover.waitFor({ state: 'hidden' })
          for (const direction of ['top', 'bottom', 'left', 'right']) {
            await page.getByRole('button', { name: direction, exact: true }).click()
            assert.match(await popover.getAttribute('data-side'), /^(top|bottom|left|right)$/)
            await page.keyboard.press('Escape')
          }
          await page.getByRole('button', { name: '打开自定义尺寸', exact: true }).click()
          assert.equal(await popover.getAttribute('data-arrow'), 'false')
          assert.ok(
            await popover
              .locator('.waveform-popover__content')
              .evaluate((node) => node.scrollHeight > node.clientHeight),
          )
          await page.keyboard.press('Escape')
        }
        await page.getByText('查看使用代码', { exact: true }).click()
        assert.match(
          await page.locator('.control-example__source pre').first().textContent(),
          new RegExp(`waveform-analysis/${slug}`),
        )
        await page.locator('.control-example__source pre').first().scrollIntoViewIfNeeded()
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
        await page.getByRole('heading', { level: 1 }).scrollIntoViewIfNeeded()
        await page.screenshot({
          path: resolve(evidence, `${slug}-${theme}-${width}.png`),
          fullPage: true,
        })
      }
    }
    // Route changes must clean top-layer dialogs and popup observers, even while open.
    for (let iteration = 0; iteration < 2; iteration++) {
      await page.evaluate(() => {
        location.hash = '/controls/modal'
      })
      await page.getByRole('button', { name: '打开 Modal', exact: true }).click()
      await page.getByRole('combobox', { name: '弹窗内选项' }).click()
      await page.evaluate(() => {
        location.hash = '/controls/popup'
      })
      await page.getByRole('button', { name: '打开基本浮层', exact: true }).waitFor()
      assert.equal(await page.locator('dialog, .waveform-select__popup').count(), 0)
      assert.equal(await page.evaluate(() => document.body.style.overflow), '')
      await page.getByRole('button', { name: '打开基本浮层', exact: true }).click()
      await page.evaluate(() => {
        location.hash = '/controls/input-number'
      })
      await page.getByRole('spinbutton', { name: '数量', exact: true }).waitFor()
      assert.equal(await page.locator('.waveform-popup').count(), 0)
    }
    await page.goto(server.resolvedUrls.local[0] + '#/animation')
    await page.getByRole('button', { name: '增删标注', exact: true }).click()
    await page.locator('.waveform-annotation__box').first().click({ button: 'right' })
    await page.getByRole('menuitem', { name: '编辑标注', exact: true }).click()
    const editor = page.locator('.waveform-annotation-editor-root')
    await editor.waitFor()
    assert.equal(await editor.getAttribute('data-control-theme'), 'dark')
    await page.getByLabel('标注文本').fill('主题测试草稿')
    await page.getByRole('button', { name: '标注边框色', exact: true }).click()
    await page.screenshot({ path: resolve(evidence, `analysis-dark-${width}.png`), fullPage: true })
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: '取 消', exact: true }).click()
    await editor.waitFor({ state: 'detached' })
    if (width < 900) await page.locator('select[aria-label="界面主题"]').selectOption('light')
    else await page.locator('.ant-segmented-item-label').getByText('浅色', { exact: true }).click()
    await page.locator('.waveform-annotation__box').first().click({ button: 'right' })
    await page.getByRole('menuitem', { name: '编辑标注', exact: true }).click()
    await editor.waitFor()
    assert.equal(await editor.getAttribute('data-control-theme'), 'light')
    await page.screenshot({
      path: resolve(evidence, `analysis-light-${width}.png`),
      fullPage: true,
    })
    await page.keyboard.press('Escape')
    await editor.waitFor({ state: 'detached' })
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log(
    'Public controls: system/light/dark themes, desktop/small layout, nested dialogs and interactions passed',
  )
} finally {
  await browser.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
}
