import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { flushAnimationFrames, pendingAnimationFrameCount } from '../../test/setup'
import WaveformChart from '../WaveformChart.vue'

import { gridSeries, mountSizedChart } from '../../test/waveformChart'

describe('WaveformChart', () => {
  it('suppresses native context menus across the waveform component', async () => {
    const wrapper = await mountSizedChart(gridSeries(2), {
      title: { text: '波形标题' },
      grid: { rowCount: 1, columnCount: 1, showPagination: true },
    })

    for (const selector of [
      '.waveform-chart__title-area',
      '.waveform-chart__grid',
      '.waveform-chart__overlay',
      '.waveform-chart__pagination',
    ]) {
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
      const dispatched = wrapper.get(selector).element.dispatchEvent(event)

      expect(dispatched).toBe(false)
      expect(event.defaultPrevented).toBe(true)
    }

    const sharedWrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
      { displayMode: 'separated' },
    )
    const sharedEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    const sharedDispatched = sharedWrapper
      .get('.waveform-chart__overlay--shared')
      .element.dispatchEvent(sharedEvent)

    expect(sharedDispatched).toBe(false)
    expect(sharedEvent.defaultPrevented).toBe(true)
  })

  it('preserves native context menus for editable controls', async () => {
    const wrapper = await mountSizedChart({ kind: 'samples', values: [0, 1], sampleRate: 1 })
    const editableElements = [
      document.createElement('input'),
      document.createElement('textarea'),
      document.createElement('div'),
    ]
    editableElements[2]?.setAttribute('contenteditable', 'true')

    for (const element of editableElements) {
      wrapper.element.appendChild(element)
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
      const dispatched = element.dispatchEvent(event)

      expect(dispatched).toBe(true)
      expect(event.defaultPrevented).toBe(false)
    }
  })

  it('applies size fallbacks for minimum, negative, and non-finite values', async () => {
    const minimumWrapper = mount(WaveformChart, {
      props: {
        data: { kind: 'samples', values: [0, 1], sampleRate: 1 },
        width: -20,
        height: -20,
      },
    })

    expect(minimumWrapper.attributes('style')).toContain('width: 0px')
    expect(minimumWrapper.attributes('style')).toContain('height: 180px')
    expect(minimumWrapper.get('.waveform-chart__svg').attributes('height')).toBe('180')

    const adaptiveWrapper = mount(WaveformChart, {
      props: {
        data: { kind: 'samples', values: [0, 1], sampleRate: 1 },
        width: Number.POSITIVE_INFINITY,
        height: Number.NaN,
      },
    })

    expect(adaptiveWrapper.attributes('style')).toContain('width: 100%')
    expect(adaptiveWrapper.attributes('style')).toContain('height: 100%')
  })

  it('keeps a 100k-point SVG path bounded by the plot width', async () => {
    const sourcePoints = Array.from({ length: 100_000 }, (_, index) => ({
      x: index / 1_000,
      y: index === 50_001 ? 100 : Math.sin(index / 50),
    }))
    const wrapper = await mountSizedChart(
      { kind: 'points', points: sourcePoints },
      { rendering: { downsampleThreshold: 1_000, maxPointsPerPixel: 4 } },
    )
    const overlayWidth = Number(wrapper.get('.waveform-chart__overlay').attributes('width'))
    const path = wrapper.get('.waveform-chart__line').attributes('d') ?? ''
    const renderedPointCount = path.match(/[ML]/g)?.length ?? 0

    expect(renderedPointCount).toBeGreaterThan(0)
    expect(renderedPointCount).toBeLessThanOrEqual(Math.floor(overlayWidth * 4) + 2)
    expect(path).toContain(',0')
  })

  it('bounds dense decorations by pixel spacing while keeping one SVG path per series', async () => {
    const sourcePoints = Array.from({ length: 1_000 }, (_, index) => ({
      x: index,
      y: Math.sin(index / 20),
      error: 0.1,
    }))
    const wrapper = await mountSizedChart(
      {
        kind: 'series',
        series: [
          {
            id: 'dense-decorations',
            name: '密集标记',
            pointType: 'triangle',
            errorBar: { visible: true },
            data: { kind: 'points', points: sourcePoints },
          },
        ],
      },
      { rendering: { pointMinSpacing: 10, errorBarMinSpacing: 12 } },
    )
    const overlayWidth = Number(wrapper.get('.waveform-chart__overlay').attributes('width'))
    const pointPaths = wrapper.findAll('.waveform-chart__point')
    const errorBarPaths = wrapper.findAll('.waveform-chart__error-bar')
    const pointCount = pointPaths[0]?.attributes('d')?.match(/M/g)?.length ?? 0
    const errorBarCount = (errorBarPaths[0]?.attributes('d')?.match(/M/g)?.length ?? 0) / 3

    expect(pointPaths).toHaveLength(1)
    expect(errorBarPaths).toHaveLength(1)
    expect(pointCount).toBeLessThanOrEqual(Math.ceil(overlayWidth / 10) + 2)
    expect(errorBarCount).toBeLessThanOrEqual(Math.ceil(overlayWidth / 12) + 2)
  })

  it('renders explicit points and supports a single point', async () => {
    const wrapper = await mountSizedChart({ kind: 'points', points: [{ x: 3, y: 8 }] })

    expect(wrapper.get('.waveform-chart__line').attributes('d')).toContain('M')
    expect(wrapper.find('.waveform-chart__empty').exists()).toBe(false)
  })

  it('shows an empty state for empty and invalid data', async () => {
    const wrapper = await mountSizedChart({ kind: 'samples', values: [1], sampleRate: -1 })

    expect(wrapper.get('.waveform-chart__empty').text()).toContain('暂无有效波形数据')
    expect(wrapper.find('.waveform-chart__line').exists()).toBe(false)
  })

  it('emits the nearest point on hover and clears it on leave', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { grid: { rowCount: 1, columnCount: 1 } },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    const overlayWidth = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: 290 }),
    })

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 700, clientY: 120, bubbles: true }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.emitted('point-hover')?.at(-1)).toEqual([{ x: 1, y: 5 }])
    expect(wrapper.find('.waveform-chart__tooltip').exists()).toBe(true)
    expect(wrapper.get('.waveform-tooltip__series-label').text()).toContain('未配置炮号：')
    const crosshairLines = wrapper.findAll('.waveform-chart__crosshair line')
    expect(crosshairLines).toHaveLength(1)
    expect(crosshairLines[0].attributes('x1')).toBe(crosshairLines[0].attributes('x2'))
    expect(crosshairLines[0].attributes('y1')).toBe('0')
    expect(wrapper.find('.waveform-chart__crosshair circle').exists()).toBe(false)

    await overlay.trigger('pointerleave')
    expect(wrapper.emitted('point-hover')?.at(-1)).toEqual([null])
  })

  it('clears hover when the pointer leaves the chart and restores it only after a new plot move', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { grid: { rowCount: 1, columnCount: 1 } },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    const overlayWidth = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: 290 }),
    })

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: overlayWidth, clientY: 120, bubbles: true }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.find('.waveform-chart__tooltip').exists()).toBe(true)

    await wrapper.trigger('pointerleave')
    expect(wrapper.find('.waveform-chart__tooltip').exists()).toBe(false)
    expect(wrapper.find('.waveform-chart__crosshair').exists()).toBe(false)
    expect(wrapper.emitted('point-hover')?.at(-1)).toEqual([null])

    await wrapper.trigger('pointerenter')
    expect(wrapper.find('.waveform-chart__tooltip').exists()).toBe(false)

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 0, clientY: 120, bubbles: true }),
    )
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.find('.waveform-chart__tooltip').exists()).toBe(true)
  })

  it('hides the numeric tooltip and crosshair when showTooltip is disabled', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { grid: { rowCount: 1, columnCount: 1 }, showTooltip: false },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    const overlayWidth = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: 290 }),
    })

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 700, clientY: 120, bubbles: true }),
    )
    flushAnimationFrames()
    await flushPromises()

    expect(wrapper.find('.waveform-chart__tooltip').exists()).toBe(false)
    expect(wrapper.find('.waveform-chart__crosshair').exists()).toBe(false)

    await wrapper.setProps({ showTooltip: true })
    await flushPromises()
    expect(wrapper.find('.waveform-chart__tooltip').exists()).toBe(true)
    expect(wrapper.find('.waveform-chart__crosshair').exists()).toBe(true)
  })

  it('coalesces pointer moves per frame and cancels pending hover work', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { grid: { rowCount: 1, columnCount: 1 } },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    const overlayWidth = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: 290 }),
    })
    const emittedBeforeMove = wrapper.emitted('point-hover')?.length ?? 0

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 0, clientY: 100, bubbles: true }),
    )
    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: overlayWidth, clientY: 120, bubbles: true }),
    )

    expect(pendingAnimationFrameCount()).toBe(1)
    expect(wrapper.emitted('point-hover')?.length ?? 0).toBe(emittedBeforeMove)
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.emitted('point-hover')).toHaveLength(emittedBeforeMove + 1)
    expect(wrapper.emitted('point-hover')?.at(-1)).toEqual([{ x: 1, y: 5 }])

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 0, clientY: 100, bubbles: true }),
    )
    expect(pendingAnimationFrameCount()).toBe(1)
    await overlay.trigger('pointerleave')
    const emittedAfterLeave = wrapper.emitted('point-hover')?.length ?? 0
    expect(pendingAnimationFrameCount()).toBe(0)
    flushAnimationFrames()
    await flushPromises()
    expect(wrapper.emitted('point-hover')).toHaveLength(emittedAfterLeave)
    expect(wrapper.emitted('point-hover')?.at(-1)).toEqual([null])

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: overlayWidth, clientY: 100, bubbles: true }),
    )
    expect(pendingAnimationFrameCount()).toBe(1)
    wrapper.unmount()
    expect(pendingAnimationFrameCount()).toBe(0)
  })

  it('isolates hover rendering from the chart, track, and waveform path subtrees', async () => {
    const wrapper = await mountSizedChart(
      {
        kind: 'points',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
      { grid: { rowCount: 1, columnCount: 1 } },
    )
    const overlay = wrapper.get('.waveform-chart__overlay')
    const overlayWidth = Number(overlay.attributes('width'))
    Object.defineProperty(overlay.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: overlayWidth, height: 290 }),
    })

    const track = wrapper.getComponent({ name: 'WaveformTrack' })
    const seriesLayer = wrapper.getComponent({ name: 'WaveformSeriesLayer' })
    const chartUpdate = vi.spyOn(wrapper.vm.$, 'update')
    const trackUpdate = vi.spyOn(track.vm.$, 'update')
    const seriesLayerUpdate = vi.spyOn(seriesLayer.vm.$, 'update')
    const pathBeforeHover = wrapper.get('.waveform-chart__line').element

    overlay.element.dispatchEvent(
      new MouseEvent('pointermove', { clientX: overlayWidth, clientY: 120, bubbles: true }),
    )
    flushAnimationFrames()
    await flushPromises()

    expect(wrapper.get('.waveform-tooltip__series-label').text()).toContain('未配置炮号：')
    expect(wrapper.findAll('.waveform-chart__crosshair line')).toHaveLength(1)
    expect(wrapper.get('.waveform-chart__line').element).toBe(pathBeforeHover)
    expect(chartUpdate).not.toHaveBeenCalled()
    expect(trackUpdate).not.toHaveBeenCalled()
    expect(seriesLayerUpdate).not.toHaveBeenCalled()
  })
})
