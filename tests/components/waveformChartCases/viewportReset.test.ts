import { describe, expect, it } from 'vitest'

import { flushAnimationFrames } from '@tests/support/setup'
import { flushVueChartUpdates, gridSeries, mountSizedChart } from '@tests/support/waveformChart'

describe('WaveformChart viewport reset', () => {
  const niceExplicitStrategy = {
    type: 'nice' as const,
    bounds: 'end' as const,
    tickCount: 10,
    includeExplicit: true,
  }

  it('ignores shared viewport double-clicks and resets using the toolbar button', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 2, y: 1 },
        ],
      },
      { displayMode: 'separated', toolbar: true },
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
    await flushVueChartUpdates()
    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).not.toBe('0')
    const startBefore = wrapper.get('.waveform-chart__axis-endpoint--start').text()
    const endBefore = wrapper.get('.waveform-chart__axis-endpoint--end').text()

    overlay.element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))
    await flushVueChartUpdates()

    expect(wrapper.emitted('zoom-reset')).toBeUndefined()
    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).toBe(startBefore)
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe(endBefore)

    await wrapper.get('[data-command="reset"]').trigger('click')
    await flushVueChartUpdates()
    expect(wrapper.emitted('zoom-reset')).toEqual([
      [expect.objectContaining({ source: 'toolbar', action: 'reset' })],
    ])
    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).toBe('0')
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('2000')
  })

  it('ignores independent track double-clicks and resets all current-page tracks', async () => {
    const wrapper = await mountSizedChart(gridSeries(2), {
      displayMode: 'independent',
      toolbar: true,
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
      await flushVueChartUpdates()
    }
    const startsBeforeReset = wrapper.findAll('.waveform-chart__axis-endpoint--start')
    expect(startsBeforeReset[0].text()).not.toBe('0')
    expect(startsBeforeReset[1].text()).not.toBe('0')
    const secondTrackStart = startsBeforeReset[1].text()
    const firstTrackStart = startsBeforeReset[0].text()

    overlays[0].element.dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true, cancelable: true }),
    )
    await flushVueChartUpdates()

    expect(wrapper.emitted('zoom-reset')).toBeUndefined()
    expect(wrapper.findAll('.waveform-chart__axis-endpoint--start')[0].text()).toBe(firstTrackStart)
    expect(wrapper.findAll('.waveform-chart__axis-endpoint--start')[1].text()).toBe(
      secondTrackStart,
    )

    expect(wrapper.find('select[aria-label="操作图框"]').exists()).toBe(false)
    await wrapper.get('[data-command="reset"]').trigger('click')
    await flushVueChartUpdates()

    const startsAfterReset = wrapper.findAll('.waveform-chart__axis-endpoint--start')
    expect(startsAfterReset[0].text()).toBe('0')
    expect(startsAfterReset[1].text()).toBe('0')
    expect(wrapper.emitted('zoom-reset')).toEqual([
      [
        expect.objectContaining({
          trackIndex: 0,
          seriesIds: ['channel-0'],
          source: 'toolbar',
          action: 'reset',
        }),
      ],
      [
        expect.objectContaining({
          trackIndex: 1,
          seriesIds: ['channel-1'],
          source: 'toolbar',
          action: 'reset',
        }),
      ],
    ])
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
    await flushVueChartUpdates()
    expect(wrapper.findAll('.waveform-chart__axis-endpoint--start')[0].text()).not.toBe('0')

    const chart = wrapper.vm as unknown as { resetViewport: () => void }
    chart.resetViewport()
    await flushVueChartUpdates()

    expect(wrapper.findAll('.waveform-chart__axis-endpoint--start')[0].text()).toBe('0')
    expect(wrapper.findAll('.waveform-chart__axis-endpoint--end')[0].text()).toBe('1000')
  })

  it('keeps a controlled shared viewport when the data reference changes', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
      { displayMode: 'separated' },
    )
    const chart = wrapper.vm as unknown as {
      setViewportDomain: (domain: [number, number], trackIndex?: number) => void
    }
    chart.setViewportDomain([0.25, 0.75])
    await flushVueChartUpdates()

    const startBefore = Number(wrapper.get('.waveform-chart__axis-endpoint--start').text())
    const endBefore = Number(wrapper.get('.waveform-chart__axis-endpoint--end').text())
    expect(startBefore).toBeGreaterThan(0)
    expect(endBefore).toBeLessThan(1000)

    await wrapper.setProps({
      data: {
        kind: 'points',
        points: [
          { x: 0, y: 10 },
          { x: 1, y: 11 },
        ],
      },
    })
    await flushVueChartUpdates()

    expect(Number(wrapper.get('.waveform-chart__axis-endpoint--start').text())).toBeCloseTo(
      startBefore,
      10,
    )
    expect(Number(wrapper.get('.waveform-chart__axis-endpoint--end').text())).toBeCloseTo(
      endBefore,
      10,
    )
  })

  it('keeps independently controlled track viewports when the data reference changes', async () => {
    const wrapper = await mountSizedChart(gridSeries(2), {
      displayMode: 'independent',
      grid: { rowCount: 1, columnCount: 2 },
    })
    const chart = wrapper.vm as unknown as {
      setViewportDomain: (domain: [number, number], trackIndex?: number) => void
    }
    chart.setViewportDomain([0.2, 0.8], 0)
    chart.setViewportDomain([0.1, 0.9], 1)
    await flushVueChartUpdates()

    const endpoints = () =>
      wrapper.findAll('.waveform-chart__track').map((track) => ({
        start: track.get('.waveform-chart__axis-endpoint--start').text(),
        end: track.get('.waveform-chart__axis-endpoint--end').text(),
      }))
    const endpointsBefore = endpoints()
    expect(Number(endpointsBefore[0].start)).toBeGreaterThan(0)
    expect(Number(endpointsBefore[0].end)).toBeLessThan(1000)
    expect(Number(endpointsBefore[1].start)).toBeGreaterThan(0)
    expect(Number(endpointsBefore[1].end)).toBeLessThan(1000)

    await wrapper.setProps({ data: gridSeries(2) })
    await flushVueChartUpdates()

    const endpointsAfter = endpoints()
    endpointsAfter.forEach((endpoint, index) => {
      expect(Number(endpoint.start)).toBeCloseTo(Number(endpointsBefore[index].start), 10)
      expect(Number(endpoint.end)).toBeCloseTo(Number(endpointsBefore[index].end), 10)
    })
  })

  it('ignores invalid domains and applies viewport constraints', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
      { displayMode: 'separated', minZoomSpan: 0.2 },
    )
    const chart = wrapper.vm as unknown as {
      setViewportDomain: (domain: [number, number], trackIndex?: number) => void
    }
    chart.setViewportDomain([Number.NaN, 0.5])
    await flushVueChartUpdates()
    expect(wrapper.get('.waveform-chart__axis-endpoint--start').text()).toBe('0')
    expect(wrapper.get('.waveform-chart__axis-endpoint--end').text()).toBe('1000')

    chart.setViewportDomain([0.49, 0.51])
    await flushVueChartUpdates()
    const start = Number(wrapper.get('.waveform-chart__axis-endpoint--start').text())
    const end = Number(wrapper.get('.waveform-chart__axis-endpoint--end').text())
    expect(end - start).toBeGreaterThanOrEqual(200)
  })

  it('resets shared and independent explicit domains to their included nice bounds', async () => {
    const shared = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 4.999999, y: 1 },
        ],
      },
      { initialXDomain: [0, 4.999999], xDomainStrategy: niceExplicitStrategy },
    )
    const independent = await mountSizedChart(gridSeries(2), {
      displayMode: 'independent',
      initialXDomains: { 'channel-0': [0, 4.999999] },
      xDomainStrategy: niceExplicitStrategy,
    })

    ;(shared.vm as unknown as { resetViewport: () => void }).resetViewport()
    ;(independent.vm as unknown as { resetViewport: () => void }).resetViewport()
    await flushVueChartUpdates()

    expect(shared.get('.waveform-chart__axis-endpoint--start').text()).toBe('0')
    expect(shared.get('.waveform-chart__axis-endpoint--end').text()).toBe('5000')
    const firstTrack = independent.findAll('.waveform-chart__track')[0]
    expect(firstTrack.get('.waveform-chart__axis-endpoint--start').text()).toBe('0')
    expect(firstTrack.get('.waveform-chart__axis-endpoint--end').text()).toBe('5000')
  })
})
