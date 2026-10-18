import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { build, preview } from 'vite'
import { chromium } from 'playwright'

export async function verifyUnifiedBrowserConsumer(root) {
  writeFileSync(
    join(root, 'display-only.html'),
    '<!doctype html><meta charset="UTF-8"><div id="display" style="width:100%;height:320px"></div><script type="module" src="/display-only.js"></script>',
  )
  writeFileSync(
    join(root, 'display-only.js'),
    `
import { Waveform } from 'waveform-analysis/display'
window.chart = new Waveform(document.getElementById('display'), [{x:0,y:0},{x:1,y:1}], {width:'100%',height:320,padding:{right:24}})
window.ready = true
`,
  )
  writeFileSync(
    join(root, 'index.html'),
    '<main><div id="analysis"></div><div id="display"></div></main><script type="module" src="/browser.js"></script>',
  )
  writeFileSync(
    join(root, 'browser.js'),
    `
import { init, Waveform } from 'waveform-analysis'
import * as analysisEntry from 'waveform-analysis/analysis'
import { Waveform as Display } from 'waveform-analysis/display'
import 'waveform-analysis/style.css'
const hosts = ['analysis', 'display'].map(id => document.getElementById(id))
hosts.forEach(host => host.style.cssText = 'height:320px;width:100%;margin-bottom:16px')
const data = Array.from({length:100}, (_, i) => ({x:i/100, y:Math.sin(i/8)}))
let analysis, display
window.mountCharts = () => {
  analysis = init(hosts[0], {data:{kind:'points',points:data},height:320,grid:{rowCount:1,columnCount:1}})
  display = new Waveform(hosts[1],data,{width:'100%',height:320,animationEnabled:true,padding:{right:24}})
  if (analysisEntry.init(hosts[0]) !== analysis || analysisEntry.getInstanceByDom(hosts[0]) !== analysis) throw new Error('Analysis registry split')
  if (Display !== Waveform || Display.getInstanceByDom(hosts[1]) !== display) throw new Error('Display registry split')
}
window.unmountCharts = () => { analysisEntry.dispose(hosts[0]); display.destroy() }
window.updateCharts = () => {
  display.animation.pause()
  analysis.setOption({data:{kind:'points',points:data.map(p=>({...p,y:p.y*0.5}))}})
  display.updateData(data.map(p=>({...p,y:p.y*0.75})))
  display.animation.resume()
}
window.mountCharts()
window.ready = true
`,
  )
  await build({
    configFile: false,
    root,
    logLevel: 'error',
    build: {
      outDir: 'browser-dist',
      rolldownOptions: { input: [join(root, 'index.html'), join(root, 'display-only.html')] },
    },
  })
  const server = await preview({
    configFile: false,
    root,
    build: { outDir: 'browser-dist' },
    preview: { host: '127.0.0.1', port: 4193 },
  })
  const browser = await chromium.launch()
  const results = []
  try {
    for (const width of [1280, 360]) {
      const page = await browser.newPage({ viewport: { width, height: 800 } })
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.addInitScript(`
const pending = new Set(), observers = new Set()
const request = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window)
window.requestAnimationFrame = callback => { const id = request(time => {pending.delete(id);callback(time)}); pending.add(id); return id }
window.cancelAnimationFrame = id => {pending.delete(id);cancel(id)}
const Original = window.ResizeObserver
window.ResizeObserver = class extends Original {
  observe(...args) { observers.add(this); super.observe(...args) }
  disconnect() { observers.delete(this); super.disconnect() }
}
window.resources = () => ({frames:pending.size,observers:observers.size,svg:document.querySelectorAll('svg').length})
`)
      await page.goto(server.resolvedUrls.local[0])
      await page.waitForFunction('window.ready === true')
      await page.waitForTimeout(1200)
      const evidence = process.env.WAVEFORM_EVIDENCE_DIR
      if (evidence) {
        mkdirSync(join(evidence, 'browser'), { recursive: true })
        await page.screenshot({ path: join(evidence, 'browser', `packed-components-${width}.png`) })
      }
      await page.evaluate('window.updateCharts()')
      await page.waitForTimeout(400)
      await page.evaluate('window.unmountCharts()')
      const cdp = await page.context().newCDPSession(page)
      // Warm constructors, lazy text measurement and animation paths before the
      // retained-heap series; record only after GC at the same lifecycle boundary.
      for (let i = 0; i < 12; i++) {
        await page.evaluate('window.mountCharts(); window.updateCharts()')
        await page.waitForTimeout(50)
        await page.evaluate('window.unmountCharts()')
      }
      await cdp.send('HeapProfiler.collectGarbage')
      const heaps = [(await cdp.send('Runtime.getHeapUsage')).usedSize]
      for (let i = 0; i < 12; i++) {
        await page.evaluate('window.mountCharts()')
        await page.waitForTimeout(50)
        await page.evaluate('window.updateCharts()')
        await page.evaluate('window.unmountCharts()')
        await page.waitForTimeout(50)
        assert.deepEqual(await page.evaluate('window.resources()'), {
          frames: 0,
          observers: 0,
          svg: 0,
        })
        await cdp.send('HeapProfiler.collectGarbage')
        heaps.push((await cdp.send('Runtime.getHeapUsage')).usedSize)
      }
      await page.waitForTimeout(100)
      const resources = await page.evaluate('window.resources()')
      assert.deepEqual(resources, { frames: 0, observers: 0, svg: 0 })
      assert.deepEqual(errors, [])
      // Same absolute noise allowance as the predeclared memory budget. Preserve the
      // full post-GC trend so a single favorable final sample cannot hide growth.
      const retainedGrowth = Math.max(...heaps.slice(1)) - heaps[0]
      assert.ok(retainedGrowth <= 8_000_000, `Retained heap grew by ${retainedGrowth} bytes`)
      results.push({
        width,
        resources,
        errors,
        heapWarmups: 12,
        postGcHeaps: heaps,
        retainedGrowth,
      })
      await cdp.detach()
      await page.close()
      const standalone = await browser.newPage({ viewport: { width, height: 800 } })
      standalone.on('pageerror', (error) => errors.push(error.message))
      await standalone.goto(server.resolvedUrls.local[0] + 'display-only.html')
      await standalone.waitForFunction('window.ready === true')
      assert.equal(await standalone.locator('link[rel="stylesheet"], style').count(), 0)
      assert.ok(await standalone.locator('#display svg').isVisible())
      assert.ok((await standalone.locator('#display svg path[d]').count()) > 0)
      await standalone.evaluate('window.chart.destroy()')
      assert.equal(await standalone.locator('#display svg').count(), 0)
      assert.deepEqual(errors, [])
      results.at(-1).standaloneDisplayWithoutCss = true
      await standalone.close()
    }
    if (process.env.WAVEFORM_EVIDENCE_DIR)
      writeFileSync(
        join(process.env.WAVEFORM_EVIDENCE_DIR, 'packed-browser.json'),
        JSON.stringify(results, null, 2) + '\n',
      )
    console.log('Packed components: cross-entry registry, rendering and resource release passed')
  } finally {
    await browser.close()
    await new Promise((resolve) => server.httpServer.close(resolve))
  }
}
