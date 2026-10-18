export default async () => {
  const { Waveform } = await import('/src/index.ts')
  const request = window.requestAnimationFrame,
    cancel = window.cancelAnimationFrame
  const realNow = performance.now.bind(performance)
  const ownNow = Object.getOwnPropertyDescriptor(performance, 'now')
  const frames = new Map()
  let serial = 0,
    now = 0
  Object.defineProperty(performance, 'now', { configurable: true, value: () => now })
  window.requestAnimationFrame = (callback) => {
    frames.set(++serial, callback)
    return serial
  }
  window.cancelAnimationFrame = (id) => frames.delete(id)
  const charts = [],
    hosts = [],
    costs = []
  const baseline = document.querySelectorAll('*').length
  const data = (phase) =>
    Array.from({ length: 1000 }, (_, x) => ({ id: String(x), x, y: Math.sin(x / 20 + phase) }))
  try {
    for (let i = 0; i < 5; i++) {
      const host = document.createElement('div')
      document.body.append(host)
      hosts.push(host)
      charts.push(
        new Waveform(host, data(0), {
          width: 800,
          height: 320,
          responsive: { enabled: false },
          layout: { autoPadding: false },
          padding: { left: 60, right: 60 },
          animationEnabled: true,
          animation: { duration: 0 },
          animationUpdate: { duration: 300, easing: 'linear' },
        }),
      )
    }
    const stableNodes = document.querySelectorAll('*').length
    let maxRAF = 0,
      maxNodes = stableNodes
    for (let run = 0; run < 5; run++) {
      charts.forEach((chart) => chart.updateData(data(run + 1)))
      const start = realNow()
      for (let frame = 0; frame < 20; frame++) {
        now += 16.67
        maxRAF = Math.max(maxRAF, frames.size)
        const pending = [...frames.values()]
        frames.clear()
        pending.forEach((callback) => callback(now))
        maxNodes = Math.max(maxNodes, document.querySelectorAll('*').length)
      }
      costs.push(realNow() - start)
      charts.forEach((chart) => chart.animation.finish())
    }
    const finalNodes = document.querySelectorAll('*').length
    charts.forEach((chart) => chart.destroy())
    hosts.forEach((host) => host.remove())
    return {
      instances: 5,
      pointsPerInstance: 1000,
      updates: 5,
      simulatedFramesPerUpdate: 20,
      elapsedMs: costs,
      maxRAF,
      stableNodes,
      maxNodes,
      finalNodes,
      nodesAfterCleanup: document.querySelectorAll('*').length,
      baselineNodes: baseline,
      pendingAfterCleanup: frames.size,
    }
  } finally {
    charts.forEach((chart) => chart.destroy())
    hosts.forEach((host) => host.remove())
    window.requestAnimationFrame = request
    window.cancelAnimationFrame = cancel
    if (ownNow) Object.defineProperty(performance, 'now', ownNow)
    else delete performance.now
  }
}
