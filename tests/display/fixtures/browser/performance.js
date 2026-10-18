export default () => {
  const chart = window.charts[0]
  const samples = []
  for (let run = 0; run < 5; run++) {
    const data = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: Math.sin(i / 20 + run) }))
    const start = performance.now()
    for (let n = 0; n < 20; n++) chart.updateData(data)
    samples.push(performance.now() - start)
  }
  return {
    instances: window.charts.length,
    points: 1000,
    updatesPerRun: 20,
    samplesMs: samples,
    nodes: document.querySelectorAll('*').length,
    svg: document.querySelectorAll('svg').length,
  }
}
