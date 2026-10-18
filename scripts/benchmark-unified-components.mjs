/* global document, window, requestAnimationFrame, MutationObserver */
import { build, preview } from 'vite'
import { chromium } from 'playwright'
import { resolve } from 'node:path'
import { realpathSync } from 'node:fs'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'

const baseline = process.argv.includes('--baseline')
const evidence = resolve('openspec/changes/integrate-waveform-display-and-component-demos/evidence')
const analysisRoot = realpathSync(baseline ? process.env.BASELINE_ANALYSIS_ROOT : '.')
const displayRoot = realpathSync(baseline ? '../waveform-display' : '.')
const root = realpathSync(await mkdtemp(resolve(tmpdir(), 'waveform-performance-')))
const analysisPath = resolve(analysisRoot, baseline ? 'src/index.ts' : 'src/analysis.ts')
const displayPath = resolve(displayRoot, baseline ? 'src/index.ts' : 'src/display.ts')
await writeFile(resolve(root, 'index.html'), '<script type="module" src="/entry.js"></script>')
await writeFile(
  resolve(root, 'entry.js'),
  `import * as analysis from ${JSON.stringify(analysisPath)}; import { Waveform } from ${JSON.stringify(displayPath)}; window.components = { analysis, Waveform };`,
)
await build({
  configFile: false,
  root,
  logLevel: 'error',
  resolve: { alias: { '@': resolve(analysisRoot, 'src') } },
})
const server = await preview({ configFile: false, root, preview: { host: '127.0.0.1', port: 0 } })
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('requestfailed', (request) =>
    errors.push(request.url() + ': ' + request.failure()?.errorText),
  )
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(response.url() + ': ' + response.status())
  })
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto(server.resolvedUrls.local[0])
  await page.waitForFunction(() => window.components)
  const result = await page.evaluate(async () => {
    const { analysis, Waveform } = window.components
    document.body.replaceChildren()
    const samples = []
    for (const count of [1000, 6000, 12000]) {
      for (const mode of ['analysis', 'display', 'both']) {
        for (let run = -2; run < 3; run++) {
          const hosts = [0, 1].map(() => {
            const node = document.createElement('div')
            node.style.cssText = 'width:1100px;height:360px'
            document.body.append(node)
            return node
          })
          const points = Array.from({ length: count }, (_, i) => ({
            x: i / count,
            y: Math.sin(i / 20),
          }))
          const start = performance.now()
          const a =
            mode !== 'display'
              ? analysis.init(hosts[0], {
                  data: { kind: 'points', points },
                  width: 1100,
                  height: 360,
                  animationEnabled: true,
                  animationThreshold: 50000,
                  animation: { duration: 400 },
                  animationUpdate: { duration: 400 },
                })
              : undefined
          const d =
            mode !== 'analysis'
              ? new Waveform(hosts[1], points, {
                  responsive: { enabled: false },
                  yAxis: { min: -2, max: 2 },
                  width: 1100,
                  height: 360,
                  animationEnabled: true,
                  animationThreshold: 50000,
                  animation: { duration: 400 },
                  animationUpdate: { duration: 400 },
                })
              : undefined
          const initMs = performance.now() - start
          // Only frames with presentation mutations belong to animation measurements.
          // This excludes idle RAFs after completion and captures each phase separately.
          async function measure(phase, action) {
            const frames = []
            let mutations = 0,
              previous
            const observer = new MutationObserver((records) => {
              mutations += records.length
            })
            hosts.forEach((host) =>
              observer.observe(host, { attributes: true, childList: true, subtree: true }),
            )
            action?.()
            const start = performance.now()
            let activeFrames = 0
            await new Promise((resolve) => {
              const tick = (time) => {
                if (mutations > 0) {
                  activeFrames++
                  if (previous !== undefined) frames.push(time - previous)
                  previous = time
                } else previous = undefined
                mutations = 0
                if (time - start < 650) requestAnimationFrame(tick)
                else resolve()
              }
              requestAnimationFrame(tick)
            })
            observer.disconnect()
            const expectedFallback = mode === 'display' && count === 12000
            if (!expectedFallback && frames.length < 5)
              throw new Error(
                `Insufficient active animation samples: ${mode}/${count}/${phase}: ${frames.length}, displayRunning=${d?.animation.isRunning()}`,
              )
            frames.sort((a, b) => a - b)
            return {
              expectedFallback,
              activeFrames,
              samples: frames.length,
              p95Ms: expectedFallback ? null : frames[Math.ceil(frames.length * 0.95) - 1],
            }
          }
          const entrance = await measure('entrance')
          const changed = points.map((p) => ({ x: p.x, y: p.y * 0.7 }))
          const update = await measure('update', () => {
            a?.setOption({ data: { kind: 'points', points: changed } })
            d?.updateData(changed)
          })
          const heap = performance.memory?.usedJSHeapSize
          a?.dispose()
          d?.destroy()
          const remainingSvg = document.querySelectorAll('svg').length
          if (remainingSvg !== 0) throw new Error('Component left SVG before host removal')
          hosts.forEach((node) => node.remove())
          if (run >= 0)
            samples.push({
              count,
              mode,
              run,
              initMs,
              entrance,
              update,
              frameP95Ms: entrance.p95Ms === null ? null : Math.max(entrance.p95Ms, update.p95Ms),
              heap,
              remainingSvg,
            })
        }
      }
    }
    return {
      userAgent: navigator.userAgent,
      warmups: 2,
      repeats: 3,
      viewport: [1280, 900],
      samples,
    }
  })
  assert.deepEqual(errors, [], 'Performance run had browser/resource errors')
  result.build = 'Vite production, default sampling backend, 400ms entrance and update'
  result.initMetric = 'constructor return, not first rendered frame'
  result.errors = errors
  await mkdir(evidence, { recursive: true })
  await writeFile(
    resolve(evidence, `${baseline ? 'baseline' : 'integrated'}-performance.json`),
    JSON.stringify(result, null, 2) + '\n',
  )
  console.log(`Saved ${result.samples.length} performance observations`)
} finally {
  await browser.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
}
