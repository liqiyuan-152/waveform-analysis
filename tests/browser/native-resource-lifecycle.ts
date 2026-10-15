import { init, getInstanceByDom } from '../../src/native'
import '../../src/styles/native.css'

// Allocate data once, outside measured create/interaction/dispose cycles.
const values = Float64Array.from({ length: 100000 }, (_, index) => Math.sin(index / 17))
const replacement = Float64Array.from(values, (value) => value * 2)

async function cycle(index: number) {
  const hosts = Array.from({ length: 2 }, () => {
    const host = document.createElement('div')
    host.style.cssText = 'width:360px;height:240px'
    host.append(document.createElement('span'))
    document.body.append(host)
    return host
  })
  const charts = hosts.map((host) =>
    init(host, {
      data: { kind: 'typed-samples', values, sampleRate: 1000 },
      animationEnabled: false,
      rendering: { sampling: { mode: 'wasm', maxPointCount: 128 } },
    }),
  )
  try {
    await Promise.all(charts.map((chart) => chart.exportImage({ format: 'svg' })))
    for (const chart of charts) {
      chart.zoomIn()
      chart.resetViewport()
      chart.setOption({
        data: { kind: 'typed-samples', values: replacement, sampleRate: 1000 },
      })
      chart.resize()
    }
    await Promise.all(charts.map((chart) => chart.exportImage({ format: 'svg' })))
    // Exercise destruction with in-flight sampling and export as well as stable destruction.
    charts[0]!.setOption({ data: { kind: 'typed-samples', values, sampleRate: 1000 } })
    const pending = charts[0]!.exportImage({ format: 'svg' }).then(
      () => 'resolved',
      (error: { code?: string }) => error.code,
    )
    charts[0]!.dispose()
    const cancellation = await pending
    if (cancellation !== 'export-cancelled')
      throw new Error(`Unexpected cancellation: ${cancellation}`)
  } finally {
    charts.forEach((chart) => chart.dispose())
    hosts.forEach((host) => host.remove())
  }
  for (const host of hosts)
    if (getInstanceByDom(host) || host.childElementCount !== 1)
      throw new Error(`Registry/host residue at cycle ${index}`)
  return { index, roots: document.querySelectorAll('.waveform-native-chart').length }
}

Object.assign(globalThis, { nativeResourceLifecycle: { cycle } })
