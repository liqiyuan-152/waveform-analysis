import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, firefox } from 'playwright'
import { animationBrowserServer } from './animation-browser-server.mjs'
import { animationBuildInputs } from './animation-build-inputs.mjs'

const output = new URL(
  '../openspec/changes/add-animation-system/evidence/pagination/',
  import.meta.url,
)
await mkdir(output, { recursive: true })
const server = await animationBrowserServer(5179)
const report = {
  buildMode: server.buildMode,
  buildInputsSha256: animationBuildInputs().sha256,
  results: [],
  errors: [],
}
const save = () =>
  writeFile(new URL('browser-results.json', output), JSON.stringify(report, null, 2) + '\n')
async function snapshot(page) {
  return page.evaluate(() => {
    const series = [...globalThis.document.querySelectorAll('.waveform-track__series-item')]
    return {
      opacity: Number(series[0]?.getAttribute('opacity') ?? 1),
      series: [...globalThis.document.querySelectorAll('.waveform-chart__line')].map((line) =>
        line.getAttribute('data-series-id'),
      ),
      annotationOpacity: Number(
        globalThis.document.querySelector('.waveform-annotation')?.getAttribute('opacity') ?? 1,
      ),
      path: globalThis.document.querySelector('.waveform-chart__line')?.getAttribute('d'),
      enterClips: globalThis.document.querySelectorAll(
        '.waveform-track__series-item [clipPathUnits]',
      ).length,
      axesOpacity: [...globalThis.document.querySelectorAll('.waveform-chart__track')].map(
        (track) => track.getAttribute('opacity'),
      ),
    }
  })
}
async function settle(page) {
  await page.waitForFunction(() =>
    [...globalThis.document.querySelectorAll('.waveform-track__series-item')].every(
      (item) => Number(item.getAttribute('opacity') ?? 1) === 1,
    ),
  )
}
try {
  for (const [name, launch] of [
    ['Chromium', () => chromium.launch()],
    ['Chrome', () => chromium.launch({ channel: 'chrome' })],
    ['Firefox', () => firefox.launch()],
  ]) {
    const browser = await launch()
    try {
      for (const width of [1280, 360]) {
        const page = await browser.newPage({
          viewport: { width: width + 40, height: 780 },
          reducedMotion: 'no-preference',
        })
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto('http://localhost:5179/tests/browser/animation.html')
        await page.waitForFunction(() => !!globalThis.animationBenchmark)
        await page.evaluate(
          (width) =>
            globalThis.animationBenchmark.mount({
              width,
              height: 360,
              series: 3,
              points: 300,
              mode: 'static',
              enabled: true,
              duration: 600,
              pageSize: 1,
              annotated: true,
            }),
          width,
        )
        await page.locator('.ant-pagination-next button').click()
        const initial = await snapshot(page)
        assert.deepEqual(initial.series, ['s1'])
        assert(initial.opacity < 0.5)
        assert.equal(initial.enterClips, 0)
        await page.waitForFunction(() => {
          const value = Number(
            globalThis.document
              .querySelector('.waveform-track__series-item')
              ?.getAttribute('opacity'),
          )
          return value > 0.15 && value < 0.9
        })
        const middle = await snapshot(page)
        assert(middle.opacity > 0 && middle.opacity < 1)
        assert.equal(middle.opacity, middle.annotationOpacity)
        assert.equal(initial.path, middle.path)
        assert(middle.axesOpacity.every((value) => value === null))
        await page.screenshot({
          path: new URL(`${name.toLowerCase()}-component-${width}-fade.png`, output).pathname,
        })
        await settle(page)
        await page.locator('.ant-pagination-next button').dispatchEvent('click')
        await page.locator('.ant-pagination-prev button').dispatchEvent('click')
        await settle(page)
        assert.deepEqual((await snapshot(page)).series, ['s1'])
        await page.locator('.ant-pagination-next button').dispatchEvent('click')
        await page.locator('.ant-pagination-next button').dispatchEvent('pointermove')
        const pointer = await snapshot(page)
        assert(pointer.opacity < 1)
        await page.locator('svg.waveform-chart__svg').dispatchEvent('pointermove')
        await settle(page)
        const png = await page.evaluate(() => globalThis.animationBenchmark.exportImage('png'))
        const svg = await page.evaluate(() => globalThis.animationBenchmark.exportImage('svg'))
        assert.equal(png.type, 'image/png')
        assert(png.size > 0)
        assert.equal(svg.type, 'image/svg+xml')
        await page.screenshot({
          path: new URL(`${name.toLowerCase()}-component-${width}-settled.png`, output).pathname,
        })
        const resources = await page.evaluate(() => globalThis.animationBenchmark.unmount())
        assert.equal(resources.tasks, 0)
        assert.equal(resources.elements, 0)
        await page.goto('http://localhost:5179/#/animation')
        await page.getByRole('heading', { name: '波形动画', exact: true }).waitFor()
        await page.getByRole('button', { name: '增删标注', exact: true }).click()
        await page.locator('.waveform-annotation').waitFor()
        await page.locator('.ant-pagination-next button').click()
        const demoInitial = await snapshot(page)
        assert.deepEqual(demoInitial.series, ['signal-1'])
        assert(demoInitial.opacity < 1)
        await settle(page)
        assert.equal((await snapshot(page)).annotationOpacity, 1)
        await page.screenshot({
          path: new URL(`${name.toLowerCase()}-demo-${width}.png`, output).pathname,
          fullPage: true,
        })
        await page.getByLabel('更新 / 切页', { exact: true }).uncheck()
        await page.locator('.ant-pagination-next button').click()
        assert.equal((await snapshot(page)).opacity, 1)
        assert.deepEqual((await snapshot(page)).series, ['signal-2'])
        assert.deepEqual(errors, [])
        report.results.push({
          browser: name,
          version: browser.version(),
          width,
          initial,
          middle,
          rapidPaginationPassed: true,
          pointerGuardPassed: true,
          svgBytes: svg.size,
          pngBytes: png.size,
          resources,
          demoInitial,
          disabledDemoPassed: true,
          errors,
        })
        await save()
        console.log(`${name} ${width}: component/demo pagination passed`)
        await page.close()
      }
    } finally {
      await browser.close()
    }
  }
} catch (error) {
  report.errors.push(String(error))
  throw error
} finally {
  await save()
  await server.close()
}
