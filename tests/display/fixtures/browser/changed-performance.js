export default () => {
  const chart = window.charts[0]
  const samples = []
  for (let run = 0; run < 7; run++) {
    const sets = Array.from({ length: 20 }, (_, n) =>
      Array.from({ length: 1000 }, (_, i) => ({ x: i, y: Math.sin(i / 20 + n / 10 + run) })),
    )
    const start = performance.now()
    for (const data of sets) chart.updateData(data)
    const elapsed = performance.now() - start
    if (run >= 2) samples.push(elapsed)
  }
  return {
    instances: window.charts.length,
    points: 1000,
    updatesPerRun: 20,
    warmupRuns: 2,
    samplesMs: samples,
    nodes: document.querySelectorAll('*').length,
    svg: document.querySelectorAll('svg').length,
  }
}
