// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { Waveform } from '../../../src/display/index'

it('returns isolated effective public options, preserving functions and rejecting destroyed reads', () => {
  const host = document.createElement('div')
  const format = (n: number) => `${n} units`
  const input = { yAxes: [{ id: 'a', color: 'red' }], xAxis: { tickFormat: format } }
  const chart = new Waveform(host, [], input)
  input.yAxes[0].color = 'blue'
  const snapshot = chart.getOptions()
  expect(snapshot.xAxis?.tickCount).toBe(8)
  expect(snapshot.xAxis?.tickFormat).toBe(format)
  snapshot.yAxes![0].color = 'green'
  expect(chart.getOptions().yAxes![0].color).toBe('red')
  chart.updateOptions({ title: { text: 'New title' } })
  expect(chart.getOptions().title?.text).toBe('New title')
  expect(chart.getOptions().yAxes![0].color).toBe('red')
  chart.destroy()
  expect(() => chart.getOptions()).toThrow('destroyed')
})
