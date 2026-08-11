import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { flushAnimationFrames } from '../../test/setup'
import { gridSeries, mountSizedChart } from '../../test/waveformChart'

describe('WaveformChart viewport reset', () => {
  it('resets a shared viewport on double-click and emits a global payload', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 2, y: 1 },
        ],
      },
      { displayMode: 'separated' },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    const width = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height: 290 }),
    })
    overlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -4000,
        clientX: width / 2,
        clientY: 145,
        bubbles: true,
        cancelable: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).not.toBe('0')

    overlay.element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))
    await flushPromises()

    expect(wrapper.emitted('zoom-reset')).toEqual([[{}]])
    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).toBe('0')
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('2000')
  })

  it('resets only the double-clicked independent track and identifies it', async () => {
    const wrapper = await mountSizedChart(gridSeries(2), {
      displayMode: 'independent',
      grid: { rowCount: 1, columnCount: 2 },
    })
    const overlays = wrapper.findAll('.waveform-chart__overlay--independent')
    for (const overlay of overlays) {
      const width = Number(overlay.attributes('width'))
      Object.defineProperty(overlay.element, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width, height: 260 }),
      })
      overlay.element.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: -4000,
          clientX: width / 2,
          clientY: 130,
          bubbles: true,
          cancelable: true,
        }),
      )
      flushAnimationFrames()
      await flushPromises()
    }
    const startsBeforeReset = wrapper.findAll('.waveform-chart__axis-endpoint--start')
    expect(startsBeforeReset[0].text()).not.toBe('0')
    expect(startsBeforeReset[1].text()).not.toBe('0')
    const secondTrackStart = startsBeforeReset[1].text()

    overlays[0].element.dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true, cancelable: true }),
    )
    await flushPromises()

    const startsAfterReset = wrapper.findAll('.waveform-chart__axis-endpoint--start')
    expect(startsAfterReset[0].text()).toBe('0')
    expect(startsAfterReset[1].text()).toBe(secondTrackStart)
    expect(wrapper.emitted('zoom-reset')).toEqual([[{ trackIndex: 0, seriesIds: ['channel-0'] }]])
  })

  it('keeps the exposed no-argument resetViewport global', async () => {
    const wrapper = await mountSizedChart(gridSeries(2), {
      displayMode: 'independent',
      grid: { rowCount: 1, columnCount: 2 },
    })
    const overlay = wrapper.findAll('.waveform-chart__overlay--independent')[0]
    const width = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width, height: 260 }),
    })
    overlay.element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -4000,
        clientX: width / 2,
        clientY: 130,
        bubbles: true,
        cancelable: true,
      }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.findAll('.waveform-chart__axis-endpoint--start')[0].text()).not.toBe('0')

    const chart = wrapper.vm as unknown as { resetViewport: () => void }
    chart.resetViewport()
    await flushPromises()

    expect(wrapper.findAll('.waveform-chart__axis-endpoint--start')[0].text()).toBe('0')
    expect(wrapper.findAll('.waveform-chart__axis-endpoint--end')[0].text()).toBe('1000')
  })
})
