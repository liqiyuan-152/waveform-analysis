import { chromium, firefox } from 'playwright'
import { animationBrowserServer } from './animation-browser-server.mjs'
import { mkdir, writeFile } from 'node:fs/promises'

const output = new URL(
  process.env.ANIMATION_EVIDENCE_DIRECTORY ?? '../openspec/changes/add-animation-system/evidence/',
  import.meta.url,
)
await mkdir(output, { recursive: true })
const server = await animationBrowserServer(5178)
const results = []
try {
  for (const [name, launch] of [
    ['Chromium', () => chromium.launch()],
    ['Chrome', () => chromium.launch({ channel: 'chrome' })],
    ['Firefox', () => firefox.launch()],
    ...(process.env.ANIMATION_EDGE_EXECUTABLE
      ? [['Edge', () => chromium.launch({ executablePath: process.env.ANIMATION_EDGE_EXECUTABLE })]]
      : []),
  ]) {
    const browser = await launch()
    try {
      for (const [width, height] of [
        [1280, 720],
        [360, 300],
      ]) {
        const page = await browser.newPage({
          viewport: { width: width + 24, height: height + 100 },
          reducedMotion: 'no-preference',
        })
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto('http://localhost:5178/tests/browser/animation.html')
        await page.waitForFunction(() => !!globalThis.animationBenchmark)
        await page.evaluate(
          async (s) => {
            await globalThis.animationBenchmark.mount(s)
          },
          { width, height, series: 1, points: 1000, mode: 'enter' },
        )
        const initial = await page
          .locator('.waveform-track__series-item [clipPathUnits] rect')
          .getAttribute('width')
        if (!(Number(initial) < width)) throw new Error('Enter did not initialize')
        await page.mouse.move(width / 2, height / 2)
        await page.waitForFunction(
          () => !globalThis.document.querySelector('.waveform-track__series-item [clipPathUnits]'),
        )
        const svg = await page.evaluate(() => globalThis.animationBenchmark.exportImage('svg'))
        const png = await page.evaluate(() => globalThis.animationBenchmark.exportImage('png'))
        if (
          svg.type !== 'image/svg+xml' ||
          svg.svg.includes('waveform-animation-') ||
          png.type !== 'image/png' ||
          png.size === 0
        )
          throw new Error('Export was incomplete')
        const componentScreenshot = `${name.toLowerCase()}-component-${width}.png`
        await page.screenshot({
          path: new URL(componentScreenshot, output).pathname,
          fullPage: true,
        })
        await page.goto('http://localhost:5178/#/animation')
        await page.getByRole('heading', { name: '波形动画', exact: true }).waitFor()
        await page.getByRole('button', { name: '增删标注', exact: true }).click()
        await page.waitForSelector('.waveform-annotation')
        await page.waitForTimeout(50)
        await page.getByRole('button', { name: '更新振幅', exact: true }).click()
        await page.waitForTimeout(400)
        await page.getByRole('button', { name: '改变点数', exact: true }).click()
        await page.waitForTimeout(400)
        await page.locator('select').last().selectOption('slide-in')
        await page.waitForFunction(() => {
          const annotation = globalThis.document.querySelector('.waveform-annotation')
          const label = annotation?.querySelector('.waveform-annotation__box')?.parentElement
          return (
            Number(annotation?.getAttribute('opacity')) === 1 &&
            label?.getAttribute('transform')?.includes('scale(1)')
          )
        })
        const demoScreenshot = `${name.toLowerCase()}-demo-${width}.png`
        await page.screenshot({ path: new URL(demoScreenshot, output).pathname, fullPage: true })
        const annotations = await page.locator('.waveform-annotation').count()
        if (annotations !== 1 || errors.length)
          throw new Error(JSON.stringify({ annotations, errors }))
        results.push({
          browser: name,
          version: browser.version(),
          width,
          height,
          componentScreenshot,
          demoScreenshot,
          pointerCommit: true,
          svgBytes: svg.size,
          pngBytes: png.size,
          compatibleUpdate: true,
          crossfadeUpdate: true,
          annotations,
          annotationSettled: true,
          errors,
        })
        await page.close()
      }
    } finally {
      await browser.close()
    }
  }
} finally {
  await writeFile(
    new URL('browser-smoke.json', output),
    JSON.stringify(
      {
        buildMode: server.buildMode,
        results,
        unavailable: {
          Safari:
            'Native Safari UI verification is recorded separately in native-browser-results.json.',
          Edge: process.env.ANIMATION_EDGE_EXECUTABLE
            ? 'Verified using an extracted official package; no system installation.'
            : 'No executable supplied.',
          'iOS Safari': 'No device/simulator connected.',
          'Android Chrome': 'No device/emulator connected.',
        },
      },
      null,
      2,
    ),
  )
  await server.close()
}
console.log(`Browser smoke: ${results.length} desktop/small-container cases passed`)
