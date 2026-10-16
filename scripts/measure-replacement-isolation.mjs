import { preview } from 'vite'
import { chromium } from 'playwright'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const directories = process.argv.slice(2)
if (directories.length !== 2) throw new Error('Pass baseline and optimized frozen directories.')
const browser = await chromium.launch({ args: ['--js-flags=--expose-gc'] })
const report = {
  browser: browser.version(),
  warmups: 5,
  runs: 5,
  rows: [],
  errors: [],
  note: 'Independent full replacement after mount and explicit GC; excludes the preceding partial update. This supplementary diagnostic does not replace the sequential matrix or measure total process memory.',
}
try {
  for (const [index, outDir] of directories.entries()) {
    const qualityFile = (await readdir(join(outDir, 'assets'))).find(
      (name) => name.startsWith('quality-') && name.endsWith('.js'),
    )
    const quality = await readFile(join(outDir, 'assets', qualityFile), 'utf8')
    const alias = quality.match(
      /([\w$]+)\([\w$]+,\{data:\{kind:`series`,series:t\},width:1200/,
    )?.[1]
    let entry
    for (const match of quality.matchAll(/import\{([^}]+)\}from"([^"]+)"/g)) {
      for (const binding of match[1].split(',')) {
        const [exportName, local = exportName] = binding.split(' as ')
        if (local === alias) entry = { url: `/assets/${match[2].slice(2)}`, exportName }
      }
    }
    if (!entry) throw new Error('Cannot locate init in frozen measurement bundle.')
    const server = await preview({
      configFile: false,
      build: { outDir },
      preview: { port: 5212, strictPort: true },
    })
    try {
      const page = await browser.newPage()
      page.on('pageerror', (error) => report.errors.push(error.message))
      await page.goto('http://localhost:5212/tests/browser/update-quality.html')
      for (const points of [100_000, 1_000_000]) {
        const samples = []
        for (let run = -report.warmups; run < report.runs; run++) {
          const result = await page.evaluate(
            async ({ entry, points }) => {
              const init = (await import(entry.url))[entry.exportName]
              const frame = () =>
                new Promise((resolve) => globalThis.requestAnimationFrame(resolve))
              const stable = async (chart) => {
                for (let attempt = 0; attempt < 100; attempt++) {
                  try {
                    await chart.exportImage({ format: 'svg' })
                    return
                  } catch (error) {
                    if (error.code !== 'export-stale') throw error
                    await frame()
                  }
                }
                throw new Error('Stability deadline exceeded')
              }
              const make = (phase) => ({
                kind: 'series',
                series: Array.from({ length: 8 }, (_, channel) => ({
                  id: `s${channel}`,
                  name: `通道 ${channel}`,
                  data: {
                    kind: 'points',
                    points: Array.from({ length: points }, (_, i) => ({
                      x: i / (points - 1),
                      y: Math.sin(i * 0.01 + phase + channel),
                    })),
                  },
                })),
              })
              const initial = make(0),
                replacement = make(0.5)
              const chart = init(globalThis.document.getElementById('benchmark'), {
                data: initial,
                width: 1200,
                height: 720,
                animationEnabled: false,
                grid: { rowCount: 8, columnCount: 1 },
                rendering: { sampling: { mode: 'auto', maxPointCount: 1200 } },
              })
              try {
                await stable(chart)
                const measure = async (data) => {
                  globalThis.gc()
                  let firstSvgMs
                  const start = performance.now()
                  const observer = new globalThis.MutationObserver((records) => {
                    if (
                      firstSvgMs === undefined &&
                      records.some((record) => record.target.matches('.waveform-chart__line'))
                    )
                      firstSvgMs = performance.now() - start
                  })
                  observer.observe(globalThis.document.querySelector('svg.waveform-chart__svg'), {
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['d'],
                  })
                  try {
                    chart.setOption({ data })
                    const synchronousMs = performance.now() - start
                    await stable(chart)
                    if (firstSvgMs === undefined) throw new Error('No observable geometry update')
                    return { synchronousMs, firstSvgMs, stableMs: performance.now() - start }
                  } finally {
                    observer.disconnect()
                  }
                }
                const full = await measure(replacement)
                const single = await measure({
                  kind: 'series',
                  series: [initial.series[0], ...replacement.series.slice(1)],
                })
                return { full, single }
              } finally {
                chart.dispose()
                await frame()
                globalThis.gc()
              }
            },
            { entry, points },
          )
          if (run >= 0) samples.push(result)
        }
        report.rows.push({
          label: index === 0 ? 'baseline' : 'optimized',
          outDir,
          entry,
          series: 8,
          points,
          input: 'objects',
          samples,
        })
      }
      await page.close()
    } finally {
      await new Promise((resolve) => server.httpServer.close(resolve))
    }
  }
} finally {
  await writeFile(
    'openspec/changes/optimize-native-waveform-update-and-quality/evidence/replacement-isolation.json',
    JSON.stringify(report, null, 2) + '\n',
  )
  await browser.close()
}
if (report.errors.length) throw new Error(report.errors.join('\n'))
