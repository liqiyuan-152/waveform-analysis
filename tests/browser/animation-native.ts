import { animationBenchmark } from './animation'

const result = document.getElementById('result')!
const button = document.getElementById('run') as HTMLButtonElement
button.onclick = async () => {
  button.disabled = true
  const width = Number(new URLSearchParams(location.search).get('width') ?? 1280)
  const scenario = { width, height: width < 500 ? 300 : 720, series: 1, points: 1000 }
  const evidence: Record<string, unknown> = { userAgent: navigator.userAgent, ...scenario }
  try {
    result.textContent = '正在验证真实动画及导出…'
    await animationBenchmark.mount({ ...scenario, mode: 'enter' })
    const clip = () => document.querySelector('.waveform-track__series-item [clipPathUnits] rect')
    const initial = Number(clip()?.getAttribute('width'))
    await new Promise(requestAnimationFrame)
    if (!(initial < width && Number(clip()?.getAttribute('width')) > initial))
      throw new Error('入场裁剪没有推进')
    const svg = await animationBenchmark.exportImage('svg')
    const png = await animationBenchmark.exportImage('png')
    if (svg.type !== 'image/svg+xml' || svg.svg?.includes('waveform-animation-') || !png.size)
      throw new Error('导出未完整提交终态')
    evidence.exports = { svgBytes: svg.size, pngBytes: png.size }
    for (const mode of ['compatible', 'crossfade'] as const) {
      const observed = await animationBenchmark.observe({ ...scenario, mode })
      if (!observed.maxActiveTasks) throw new Error(`${mode} 未启动动画`)
      evidence[mode] = {
        activeTasks: observed.maxActiveTasks,
        finalTasks: observed.activeAfterObservation,
      }
    }
    evidence.passed = true
    result.textContent = `通过：入场逐帧推进、兼容更新、交叉淡化、SVG/PNG 最终态导出\n${JSON.stringify(evidence, null, 2)}`
    await animationBenchmark.mount({ ...scenario, mode: 'static' })
  } catch (error) {
    evidence.passed = false
    evidence.error = String(error)
    result.textContent = `失败：${String(error)}`
  } finally {
    await fetch('/animation-native-evidence', { method: 'POST', body: JSON.stringify(evidence) })
    button.disabled = false
  }
}
