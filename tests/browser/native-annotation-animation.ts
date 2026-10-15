import { init } from '../../src/native'
import '../../src/styles/native.css'

async function until(predicate: () => boolean) {
  const started = performance.now()
  while (!predicate()) {
    if (performance.now() - started > 5000) throw new Error('Annotation animation probe timed out')
    await new Promise(requestAnimationFrame)
  }
}

async function probe(
  width: number,
  displayMode: 'independent' | 'separated' | 'compact',
  reduced: boolean,
) {
  const host = document.createElement('div')
  host.style.width = `${width}px`
  host.style.height = '360px'
  document.body.append(host)
  const annotation = { id: 'note', seriesId: 'a', x: 1, y: 1, text: '标注动画' }
  const chart = init(host, {
    displayMode,
    annotations: [annotation],
    data: {
      kind: 'series',
      series: [
        {
          id: 'a',
          name: 'A',
          data: {
            kind: 'points',
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ],
          },
        },
      ],
    },
    animation: { duration: 250, easing: 'linear' },
    animationAnnotation: { duration: 400, easing: 'linear', type: 'slide-in' },
    rendering: { sampling: { mode: 'raw' } },
    grid: { rowCount: 1, columnCount: 1 },
  })
  const revisions: number[] = [],
    finished: number[] = []
  chart.on('rendered', ({ revision }) => revisions.push(revision))
  chart.on('finished', ({ revision }) => finished.push(revision))
  const count = () => finished.length
  const node = () => host.querySelector<SVGGElement>('.waveform-annotation')
  const opacity = () => Number(node()?.getAttribute('opacity'))
  try {
    await until(() => !!node())
    if (!reduced) {
      if (opacity() !== 0) throw new Error('Annotation did not wait for series entrance')
      await until(() => opacity() > 0 && opacity() < 1)
      if (count()) throw new Error('Finished preceded annotation final frame')
    }
    await until(() => count() === 1)
    if (opacity() !== 1 || new Set(revisions).size !== 1)
      throw new Error('Appearance failed to settle on one revision')
    const original = node()
    chart.setOption({ annotations: [] })
    if (!reduced) {
      await until(() => node()?.getAttribute('data-leaving') === 'true')
      if (node() !== original || node()?.style.pointerEvents !== 'none')
        throw new Error('Leaving snapshot not retained or remains interactive')
      await until(() => opacity() > 0 && opacity() < 1)
      if (count() !== 1) throw new Error('Leave finished before removal')
    }
    await until(() => count() === 2)
    if (node()) throw new Error('Leave retained annotation node')
    chart.setOption({ annotations: [{ ...annotation, text: '恢复' }] })
    await until(() => count() === 3)
    if (opacity() !== 1 || !node()?.textContent?.includes('恢复'))
      throw new Error('Reappearance did not settle')
    chart.dispose()
    if (host.childElementCount) throw new Error('Dispose retained SVG resources')
    return { width, displayMode, reduced, renderedFrames: revisions.length, finished }
  } finally {
    chart.dispose()
    host.remove()
  }
}

declare global {
  var nativeAnnotationAnimationProbe: typeof probe
}
globalThis.nativeAnnotationAnimationProbe = probe
