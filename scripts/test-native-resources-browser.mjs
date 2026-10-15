import assert from 'node:assert/strict'
import { chromium, firefox, webkit } from 'playwright'
import { build, preview } from 'vite'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// Installed before production modules load. Track explicit resource ownership without retaining
// chart nodes or callbacks that would otherwise be collectable.
function instrument() {
  const { window, document } = globalThis
  const frames = new Set()
  const timers = new Set()
  const intervals = new Set()
  const observers = new Map()
  const workers = new Set()
  const listeners = []
  let createdWorkers = 0
  let createdObservers = 0
  const original = {
    request: window.requestAnimationFrame.bind(window),
    cancel: window.cancelAnimationFrame.bind(window),
    timeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    interval: window.setInterval.bind(window),
    clearInterval: window.clearInterval.bind(window),
    add: EventTarget.prototype.addEventListener,
    remove: EventTarget.prototype.removeEventListener,
  }
  window.requestAnimationFrame = (callback) => {
    const id = original.request((time) => {
      frames.delete(id)
      callback(time)
    })
    frames.add(id)
    return id
  }
  window.cancelAnimationFrame = (id) => {
    frames.delete(id)
    original.cancel(id)
  }
  window.setTimeout = (callback, delay, ...args) => {
    if (typeof callback !== 'function') throw new Error('Unexpected string timer')
    const id = original.timeout(() => {
      timers.delete(id)
      callback(...args)
    }, delay)
    timers.add(id)
    return id
  }
  window.clearTimeout = (id) => {
    timers.delete(id)
    original.clearTimeout(id)
  }
  window.setInterval = (callback, delay, ...args) => {
    const id = original.interval(callback, delay, ...args)
    intervals.add(id)
    return id
  }
  window.clearInterval = (id) => {
    intervals.delete(id)
    original.clearInterval(id)
  }
  const Observer = window.ResizeObserver
  window.ResizeObserver = class extends Observer {
    constructor(callback) {
      super(callback)
      createdObservers++
      observers.set(this, new Set())
    }
    observe(target, options) {
      if (!observers.has(this)) observers.set(this, new Set())
      observers.get(this).add(new WeakRef(target))
      super.observe(target, options)
    }
    unobserve(target) {
      for (const ref of observers.get(this))
        if (ref.deref() === target) observers.get(this).delete(ref)
      super.unobserve(target)
    }
    disconnect() {
      observers.delete(this)
      super.disconnect()
    }
  }
  const NativeWorker = window.Worker
  window.Worker = class extends NativeWorker {
    constructor(...args) {
      super(...args)
      createdWorkers++
      workers.add(this)
    }
    terminate() {
      workers.delete(this)
      super.terminate()
    }
  }
  const capture = (options) => (typeof options === 'boolean' ? options : !!options?.capture)
  EventTarget.prototype.addEventListener = function (type, callback, options) {
    if ((this === window || this === document) && callback) {
      if (options?.once || options?.signal) throw new Error('Untracked global listener lifetime')
      if (
        !listeners.some(
          (entry) =>
            entry.target === this &&
            entry.type === type &&
            entry.callback === callback &&
            entry.capture === capture(options),
        )
      )
        listeners.push({ target: this, type, callback, capture: capture(options) })
    }
    return original.add.call(this, type, callback, options)
  }
  EventTarget.prototype.removeEventListener = function (type, callback, options) {
    const index = listeners.findIndex(
      (entry) =>
        entry.target === this &&
        entry.type === type &&
        entry.callback === callback &&
        entry.capture === capture(options),
    )
    if (index >= 0) listeners.splice(index, 1)
    return original.remove.call(this, type, callback, options)
  }
  globalThis.resourceProbe = {
    allocated: () => ({ workers: createdWorkers, observers: createdObservers }),
    // This wait bypasses instrumentation and is not counted as a chart timer.
    idle: () => new Promise((resolve) => original.timeout(resolve, 250)),
    snapshot: () => ({
      frames: frames.size,
      timers: timers.size,
      intervals: intervals.size,
      observers: observers.size,
      workers: workers.size,
      globalListeners: listeners.length,
    }),
  }
}

const evidence = resolve('openspec/changes/decouple-waveform-engine-from-vue/evidence')
await mkdir(evidence, { recursive: true })
const outDir = await mkdtemp(join(tmpdir(), 'waveform-native-resources-'))
await build({
  build: {
    outDir,
    rolldownOptions: { input: resolve('tests/browser/native-resource-lifecycle.html') },
  },
})
const server = await preview({ build: { outDir }, preview: { port: 5199, strictPort: true } })
const report = { startedAt: new Date().toISOString(), node: process.version, browsers: [] }
let failed = false
try {
  for (const [name, driver] of Object.entries({ chromium, firefox, webkit })) {
    let browser
    const result = { name, errors: [], cycles: [], heap: 'unavailable', detachedDOM: 'unavailable' }
    try {
      browser = await driver.launch()
      result.version = browser.version()
      const page = await browser.newPage()
      page.on('pageerror', (error) => result.errors.push(error.message))
      await page.addInitScript(instrument)
      await page.goto('http://localhost:5199/tests/browser/native-resource-lifecycle.html')
      await page.waitForFunction(() => !!globalThis.nativeResourceLifecycle)
      // Warm shared WASM/font/browser allocations before the retained-heap baseline.
      for (let index = 0; index < 3; index++)
        await page.evaluate((index) => globalThis.nativeResourceLifecycle.cycle(index), index)
      await page.evaluate(() => globalThis.resourceProbe.idle())
      const cdp = name === 'chromium' ? await page.context().newCDPSession(page) : undefined
      const memory = async () => {
        if (!cdp) return undefined
        await cdp.send('HeapProfiler.collectGarbage')
        const heap = await cdp.send('Runtime.getHeapUsage')
        const dom = await cdp.send('Memory.getDOMCounters')
        return { heap: heap.usedSize, ...dom }
      }
      const baseline = await page.evaluate(() => globalThis.resourceProbe.snapshot())
      const memoryBefore = await memory()
      for (let index = 0; index < 30; index++) {
        const cycle = await page.evaluate(
          (index) => globalThis.nativeResourceLifecycle.cycle(index),
          index,
        )
        await page.evaluate(() => globalThis.resourceProbe.idle())
        const resources = await page.evaluate(() => globalThis.resourceProbe.snapshot())
        assert.deepEqual(resources, baseline, `${name}: resource residue at cycle ${index}`)
        assert.equal(cycle.roots, 0)
        result.cycles.push({ index, resources })
      }
      const memoryAfter = await memory()
      result.baseline = baseline
      result.allocated = await page.evaluate(() => globalThis.resourceProbe.allocated())
      assert.ok(result.allocated.workers >= 66, 'Worker path was not exercised by every chart')
      assert.ok(result.allocated.observers >= 66, 'Observer path was not exercised by every chart')
      assert.equal(
        result.allocated.workers,
        result.allocated.observers,
        'Healthy sampling transports must survive data replacement within each chart',
      )
      if (memoryBefore && memoryAfter) {
        const growth = memoryAfter.heap - memoryBefore.heap
        result.heap = { before: memoryBefore.heap, after: memoryAfter.heap, growth }
        assert.ok(
          !(growth > memoryBefore.heap * 0.1 && growth > 5 * 1024 * 1024),
          'Retained heap regression',
        )
        // Total nodes after forced GC also include detached nodes; equality is stricter than
        // merely counting connected chart roots. Browser-internal documents stay in the baseline.
        result.detachedDOM = {
          before: memoryBefore,
          after: memoryAfter,
          method: 'total DOM nodes after forced GC',
        }
        assert.equal(memoryAfter.nodes, memoryBefore.nodes, 'Retained DOM nodes grew')
        assert.equal(
          memoryAfter.jsEventListeners,
          memoryBefore.jsEventListeners,
          'Retained DOM listeners grew',
        )
      }
      assert.deepEqual(result.errors, [])
      result.status = 'passed'
    } catch (error) {
      failed = true
      result.status = 'failed'
      result.reason = String(error)
    } finally {
      await browser?.close()
    }
    report.browsers.push(result)
    await writeFile(
      join(evidence, 'native-resources-browser.json'),
      JSON.stringify(report, null, 2),
    )
  }
} finally {
  report.finishedAt = new Date().toISOString()
  await writeFile(join(evidence, 'native-resources-browser.json'), JSON.stringify(report, null, 2))
  await new Promise((resolve, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : resolve())),
  )
}
console.log(JSON.stringify(report, null, 2))
if (failed) process.exitCode = 1
