import { init } from '../../src/native'
import '../../src/styles/native.css'

async function until(predicate: () => boolean) {
  const started = performance.now()
  while (!predicate()) {
    if (performance.now() - started > 4000) throw new Error('native animation probe timed out')
    await new Promise(requestAnimationFrame)
  }
}

async function probe(width: number, reduced: boolean) {
  const host = document.createElement('div')
  host.style.width = `${width}px`
  host.style.height = '360px'
  document.body.append(host)
  const data = (y = 1) => ({
    kind: 'points' as const,
    points: [
      { x: 0, y: 0 },
      { x: 1, y },
    ],
  })
  const chart = init(host, {
    data: data(),
    yDomain: [-1, 3],
    animation: { duration: 500, easing: 'linear' },
    animationUpdate: { duration: 500, easing: 'linear' },
    rendering: { sampling: { mode: 'raw' } },
    grid: { rowCount: 1, columnCount: 1 },
  })
  const rendered: number[] = [],
    finished: number[] = []
  const finishedCount = () => finished.length
  chart.on('rendered', ({ revision }) => rendered.push(revision))
  chart.on('finished', ({ revision }) => finished.push(revision))
  const clip = () => host.querySelector('.waveform-chart__series clipPath rect')
  try {
    await until(() => rendered.length > 0)
    if (!reduced) {
      await until(() => !!clip())
      const initial = Number(clip()!.getAttribute('width'))
      await until(() => Number(clip()?.getAttribute('width')) > initial + 5)
      if (finished.length) throw new Error('finished emitted during entrance')
    }
    const svg = await chart.exportImage({ format: 'svg' })
    if ((await svg.text()).includes('waveform-native-animation-'))
      throw new Error('export retained an entrance clip')
    if (finishedCount() !== 1 || new Set(rendered).size !== 1)
      throw new Error('entrance frames changed business revision or failed to finish')
    if (reduced && clip()) throw new Error('reduced motion retained animated geometry')
    const previous = host.querySelector('.waveform-chart__line')!.getAttribute('d')
    const beforeUpdate = rendered.length
    chart.setOption({ data: data(2) })
    await until(() => rendered.length > beforeUpdate)
    if (!reduced && finished.length !== 1) throw new Error('update finished prematurely')
    await chart.exportImage({ format: 'svg' })
    if (host.querySelector('.waveform-chart__line')!.getAttribute('d') === previous)
      throw new Error('data update did not draw latest geometry')
    chart.setOption({
      data: {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 0.5, y: 3 },
          { x: 1, y: 1 },
        ],
      },
    })
    if (!reduced) await until(() => host.querySelectorAll('.waveform-chart__series').length === 2)
    await chart.exportImage({ format: 'svg' })
    if (host.querySelectorAll('.waveform-chart__series').length !== 1)
      throw new Error('crossfade did not release old geometry')
    if (finishedCount() !== 3) throw new Error('finished did not cover all settled revisions')
    chart.dispose()
    if (host.childElementCount) throw new Error('dispose retained native nodes')
    return { width, reduced, renderedFrames: rendered.length, finishedRevisions: finished }
  } finally {
    chart.dispose()
    host.remove()
  }
}

declare global {
  var nativeAnimationInstanceProbe: typeof probe
}
globalThis.nativeAnimationInstanceProbe = probe
