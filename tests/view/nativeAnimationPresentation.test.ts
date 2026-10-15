import { afterEach, describe, expect, it } from 'vitest'
import { ChartModel } from '@/model/ChartModel'
import { ChartLayoutEngine } from '@/layout/ChartLayoutEngine'
import { SvgChartRenderer } from '@/rendering/SvgChartRenderer'
import {
  projectTrack,
  staticTrack,
  transitionTrack,
} from '@/components/animation/trackPresentation'

const renderers: SvgChartRenderer[] = []
afterEach(() => {
  renderers.splice(0).forEach((renderer) => renderer.dispose())
  document.body.replaceChildren()
})

function fixture() {
  const host = document.createElement('div')
  document.body.append(host)
  const model = new ChartModel({
    data: {
      kind: 'points',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    },
    grid: { rowCount: 1, columnCount: 1 },
  })
  const renderer = new SvgChartRenderer(host)
  renderers.push(renderer)
  const engine = new ChartLayoutEngine(model)
  const layout = () => engine.calculate(800, 400)
  const render = (track: ReturnType<typeof projectTrack>) =>
    renderer.render({ ...layout(), trackLayouts: [track] }, model.options.value)
  return { host, model, renderer, layout, render }
}

describe('native animation presentation rendering', () => {
  it('retains both incompatible geometries during crossfade and removes the old one at completion', () => {
    const { host, model, layout, render } = fixture()
    const from = staticTrack(layout().trackLayouts[0], [])
    render(projectTrack(from))
    const retained = host.querySelector('.waveform-chart__series')!
    model.setOption({
      data: {
        kind: 'points',
        points: [
          { x: 0, y: 1 },
          { x: 0.5, y: 3 },
          { x: 1, y: 2 },
        ],
      },
    })
    const to = staticTrack(layout().trackLayouts[0], [])
    render(projectTrack(transitionTrack(from, to, 0.25, false)))
    const series = [...host.querySelectorAll('.waveform-chart__series')]
    expect(series).toHaveLength(2)
    expect(series.map((node) => node.getAttribute('opacity'))).toEqual(['0.75', '0.25'])
    expect(series[1]).toBe(retained)
    expect(series[0].querySelector('path')?.getAttribute('d')).not.toBe(
      series[1].querySelector('path')?.getAttribute('d'),
    )
    render(projectTrack(transitionTrack(from, to, 1, true)))
    expect(host.querySelectorAll('.waveform-chart__series')).toHaveLength(1)
    expect(host.querySelector('.waveform-chart__series')).toBe(retained)
    expect(series[0].isConnected).toBe(false)
  })

  it('updates an entrance clip in place and releases it when finished or disposed', () => {
    const { host, renderer, layout, render } = fixture()
    const state = staticTrack(layout().trackLayouts[0], [])
    const id = state.target.seriesPaths[0].series.id
    state.clips.set(id, { id: 'native-animation-test', x: 10, width: 0 })
    render(projectTrack(state))
    const series = host.querySelector('.waveform-chart__series')!
    const rect = series.querySelector('clipPath rect')!
    expect(series.getAttribute('clip-path')).toBe('url(#native-animation-test)')
    expect(rect.getAttribute('height')).toBe(String(state.target.height))
    expect(rect.getAttribute('width')).toBe('0')
    state.clips.set(id, { id: 'native-animation-next', x: 20, width: 120 })
    render(projectTrack(state))
    expect(series.querySelector('clipPath rect')).toBe(rect)
    expect(rect.getAttribute('width')).toBe('120')
    expect(rect.getAttribute('x')).toBe('20')
    expect(series.querySelector('clipPath')?.id).toBe('native-animation-next')
    expect(series.getAttribute('clip-path')).toBe('url(#native-animation-next)')
    state.clips.clear()
    render(projectTrack(state))
    expect(series.hasAttribute('clip-path')).toBe(false)
    expect(series.querySelector('defs')).toBeNull()
    state.clips.set(id, { id: 'native-animation-dispose', x: 0, width: 0 })
    render(projectTrack(state))
    renderer.dispose()
    expect(host.querySelector('clipPath')).toBeNull()
    expect(rect.isConnected).toBe(false)
  })
})
