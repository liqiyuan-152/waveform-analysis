import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const evidence = resolve(
  process.env.WAVEFORM_SYNC_EVIDENCE_DIR || '/tmp/waveform-main-sync-browser',
)
await mkdir(evidence, { recursive: true })
const server = await createServer({ server: { port: 5198, strictPort: true } })
await server.listen()
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
const results = []
try {
  await page.goto('http://localhost:5198/tests/browser/native-instance-smoke.html')
  await page.waitForFunction(() => !!globalThis.nativeInstanceSmoke)
  await page.evaluate(async () => {
    const api = await import('/src/index.ts')
    const host = globalThis.document.querySelector('#chart')
    api.getInstanceByDom(host)?.dispose()
    globalThis.syncApi = api
  })
  for (const width of [1200, 360]) {
    const result = await page.evaluate(async (width) => {
      const { init, getInstanceByDom } = globalThis.syncApi
      const host = globalThis.document.querySelector('#chart')
      getInstanceByDom(host)?.dispose()
      host.style.cssText = `width:${width}px;height:480px`
      const data = {
        kind: 'series',
        series: Array.from({ length: 8 }, (_, index) => ({
          id: `series-${index}`,
          trackId: `track-${Math.floor(index / 4)}`,
          name: `Channel ${index + 1}`,
          unit: ['V', 'A', 'T', 'Pa'][index % 4],
          data: {
            kind: 'points',
            points: Array.from({ length: 101 }, (_, x) => ({
              x: x / 10,
              y: Math.sin(x) * 10 ** (index % 4),
            })),
          },
        })),
      }
      const chart = init(
        host,
        {
          data,
          width,
          height: 480,
          overlayMode: 'multi-axis',
          displayMode: 'independent',
          animationEnabled: false,
          xDomainStrategy: { type: 'data' },
          title: { text: 'Main sync · framework independent' },
          grid: { rowCount: 2, columnCount: 1 },
          toolbar: { display: 'always' },
          legend: { interactive: true },
          axes: { x: { splitNumber: 10 } },
        },
        { autoResize: false },
      )
      const stable = () => chart.exportImage({ format: 'svg' })
      await stable()
      const root = host.querySelector('.waveform-chart')
      const legendItem = root.querySelector('.waveform-legend__item[aria-pressed="true"]')
      if (!legendItem) throw new Error('Missing interactive legend item')
      const legendStyle = globalThis.getComputedStyle(legendItem)
      if (
        legendStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
        legendStyle.color !== 'rgb(52, 64, 84)'
      )
        throw new Error('Toolbar active styling leaked into the legend')
      const activeTool = root.querySelector('.waveform-toolbar button[aria-pressed="true"]')
      if (
        !activeTool ||
        globalThis.getComputedStyle(activeTool).backgroundColor !== 'rgba(186, 224, 255, 0.5)'
      )
        throw new Error('Active toolbar highlight missing')
      const geometry = () =>
        [...host.querySelectorAll('.waveform-chart__track')].map((track) => [
          track.getAttribute('transform'),
          track.getAttribute('data-track-width'),
          ...[...track.querySelectorAll('.waveform-track__axis--y')].map((axis) =>
            axis.getAttribute('transform'),
          ),
        ])
      const before = JSON.stringify(geometry())
      chart.zoomIn()
      await stable()
      if (JSON.stringify(geometry()) !== before)
        throw new Error('Viewport command changed axis layout')
      const svg = host.querySelector('.waveform-chart__svg')
      const svgWidth = Number(svg.getAttribute('width'))
      if (width === 360 && svgWidth <= width)
        throw new Error('Narrow multi-axis content did not scroll')
      if (host.querySelectorAll('.waveform-track__axis--y').length !== 8)
        throw new Error('Missing axes')
      for (const position of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
        chart.setOption({ toolbar: { display: 'always', position, offsetX: 0, offsetY: 0 } })
        await stable()
        const toggle = root.querySelector('[aria-label="图表工具"]')
        if (width < 440 && toggle.getAttribute('aria-expanded') === 'false') toggle.click()
        root.querySelector('[data-command="export"]').click()
        await new Promise((resolve) =>
          globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve)),
        )
        const bounds = root.getBoundingClientRect()
        for (const node of [
          root.querySelector('[role="toolbar"]'),
          root.querySelector('.waveform-toolbar__menu'),
        ]) {
          const box = node.getBoundingClientRect()
          if (
            box.left < bounds.left - 2 ||
            box.right > bounds.right + 2 ||
            box.top < bounds.top - 2 ||
            box.bottom > bounds.bottom + 2
          )
            throw new Error(`${position} toolbar or menu exceeds container`)
        }
        root.querySelector('[data-command="export"]').click()
      }
      root.scrollLeft = 100
      root.dispatchEvent(new Event('scroll'))
      const snapshot = await (await stable()).text()
      if (!snapshot.includes(`width="${svgWidth}"`))
        throw new Error('Export clipped scroll content')
      const state = chart.getControlState().targets.map((target) => target.viewport)
      chart.setOption({
        data: {
          ...data,
          series: data.series.map((series) => ({
            ...series,
            data: { kind: 'points', points: [] },
          })),
        },
      })
      await stable()
      if (host.querySelector('.waveform-chart__line:not([display="none"])'))
        throw new Error('Empty window retained old geometry')
      if (
        JSON.stringify(chart.getControlState().targets.map((target) => target.viewport)) !==
        JSON.stringify(state)
      )
        throw new Error('Empty window changed viewport')
      chart.setOption({ data, toolbar: { display: 'always' } })
      await stable()
      return { width, svgWidth, axes: host.querySelectorAll('.waveform-track__axis--y').length }
    }, width)
    results.push(result)
    await page.locator('#chart').screenshot({ path: resolve(evidence, `native-${width}.png`) })
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('http://localhost:5198/demo-app/index.html')
    await page.waitForSelector('.waveform-chart__line[d]:not([display="none"])')
    await page.waitForTimeout(500)
    const axes = await page.locator('.waveform-track__axis--y').count()
    if (!axes) throw new Error('Demo axes missing')
    const toolbar = page.locator('.waveform-toolbar--hover')
    const opacity = () => toolbar.evaluate((node) => globalThis.getComputedStyle(node).opacity)
    await page.mouse.move(0, 0)
    assert.equal(await opacity(), '0', 'Toolbar should be hidden outside the chart')
    await page.locator('.waveform-chart').hover({ position: { x: 3, y: 3 } })
    assert.equal(await opacity(), '1', 'Hover should reveal the toolbar')
    await page.mouse.move(0, 0)
    assert.equal(await opacity(), '0', 'Leaving the chart should hide the toolbar')
    await toolbar.locator('button:visible').first().focus()
    assert.equal(await opacity(), '1', 'Keyboard focus should reveal the toolbar')
    await page.evaluate(() => globalThis.document.activeElement.blur())
    await page.waitForFunction(
      () =>
        globalThis.getComputedStyle(globalThis.document.querySelector('.waveform-toolbar--hover'))
          .opacity === '0',
    )
    assert.equal(await opacity(), '0', 'Leaving keyboard focus should hide the toolbar')
    if (width > 440) {
      await page.locator('.waveform-chart').hover({ position: { x: 3, y: 3 } })
      await toolbar.locator('[data-command="export"]').click()
      await page.mouse.move(0, 0)
      await toolbar.locator('[data-command="export"]').evaluate((node) => node.blur())
      assert.equal(await opacity(), '1', 'An open export menu should keep the toolbar visible')
      await toolbar.locator('[data-command="export"]').evaluate((node) => node.click())
      assert.equal(await opacity(), '0', 'Closing the export menu should restore hover behavior')
    }
    if (width <= 520) {
      const overlaps = await page.evaluate(() => {
        const label = globalThis.document
          .querySelector('.waveform-chart__x-label')
          .getBoundingClientRect()
        const pagination = globalThis.document
          .querySelector('.waveform-chart__pagination')
          .getBoundingClientRect()
        return (
          label.bottom > pagination.top &&
          label.right > pagination.left &&
          label.left < pagination.right
        )
      })
      if (overlaps) throw new Error('Demo pagination overlaps the X-axis title')
    }
    await page.screenshot({ path: resolve(evidence, `demo-${width}.png`), fullPage: true })
    results.push({ demoWidth: width, axes })
  }
  if (errors.length) throw new Error(errors.join('\n'))
  await writeFile(resolve(evidence, 'report.json'), JSON.stringify({ results, errors }, null, 2))
  console.log(JSON.stringify({ evidence, results, errors }, null, 2))
} finally {
  await browser.close()
  await server.close()
}
