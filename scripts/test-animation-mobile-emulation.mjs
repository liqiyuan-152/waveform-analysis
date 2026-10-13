import { chromium, devices, webkit } from 'playwright'
import { animationBrowserServer } from './animation-browser-server.mjs'
import { mkdir, writeFile } from 'node:fs/promises'

const server = await animationBrowserServer(5182)
const evidence = new URL(
  process.env.ANIMATION_EVIDENCE_DIRECTORY ?? '../openspec/changes/add-animation-system/evidence/',
  import.meta.url,
)
await mkdir(evidence, { recursive: true })
const results = []
try {
  for (const [name, engine, device] of [
    ['iphone-webkit-emulation', webkit, devices['iPhone 13']],
    ['pixel-chromium-emulation', chromium, devices['Pixel 7']],
  ]) {
    const browser = await engine.launch()
    try {
      const context = await browser.newContext({ ...device, reducedMotion: 'no-preference' })
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto('http://localhost:5182/tests/browser/animation.html')
      await page.waitForFunction(() => !!globalThis.animationBenchmark)
      await page.evaluate(() =>
        globalThis.animationBenchmark.mount({
          width: 360,
          height: 300,
          series: 1,
          points: 1000,
          mode: 'enter',
        }),
      )
      await page.touchscreen.tap(180, 150)
      await page.waitForFunction(
        () => !globalThis.document.querySelector('.waveform-track__series-item [clipPathUnits]'),
      )
      const svg = await page.evaluate(() => globalThis.animationBenchmark.exportImage('svg'))
      const png = await page.evaluate(() => globalThis.animationBenchmark.exportImage('png'))
      if (!png.size || svg.svg.includes('waveform-animation-'))
        throw new Error('Incomplete mobile export')
      await page.screenshot({ path: new URL(`${name}-component.png`, evidence).pathname })
      await page.goto('http://localhost:5182/#/animation')
      await page.getByRole('heading', { name: '波形动画', exact: true }).waitFor()
      await page.getByRole('button', { name: '增删标注', exact: true }).tap()
      await page.waitForSelector('.waveform-annotation', { timeout: 10000 })
      await page.getByRole('button', { name: '更新振幅', exact: true }).tap()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: '改变点数', exact: true }).tap()
      await page.waitForTimeout(1600)
      await page.waitForFunction(() => {
        const annotation = globalThis.document.querySelector('.waveform-annotation')
        const label = annotation?.querySelector('.waveform-annotation__box')?.parentElement
        return (
          Number(annotation?.getAttribute('opacity')) === 1 &&
          label?.getAttribute('transform')?.includes('scale(1)')
        )
      })
      await page.screenshot({
        path: new URL(`${name}-demo.png`, evidence).pathname,
        fullPage: true,
      })
      if ((await page.locator('.waveform-annotation').count()) !== 1 || errors.length)
        throw new Error(
          JSON.stringify({
            annotations: await page.locator('.waveform-annotation').count(),
            errors,
          }),
        )
      results.push({
        name,
        browserVersion: browser.version(),
        device,
        touchTakeover: true,
        annotationSettled: true,
        svgBytes: svg.size,
        pngBytes: png.size,
        errors,
      })
    } finally {
      await browser.close()
    }
  }
} finally {
  await writeFile(
    new URL('mobile-emulation-results.json', evidence),
    JSON.stringify(
      {
        buildMode: server.buildMode,
        methodology:
          'Desktop engines with mobile viewport, UA, scale factor and touch emulation. This does not replace physical iOS Safari/Android Chrome verification.',
        results,
      },
      null,
      2,
    ),
  )
  await server.close()
}
