import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mountSizedChart } from '@tests/support/waveformChart'
import { flushAnimationFrames, resizeObservers } from '@tests/support/setup'
import type { WaveformData } from '@/types'

const data = (emptyIds: string[] = [], grouped = false): WaveformData => ({
  kind: 'series',
  series: ['short', 'long'].map((id) => ({
    id,
    name: id,
    trackId: grouped ? 'shared-frame' : id,
    pointType: 'circle',
    errorBar: { visible: true },
    data: {
      kind: 'points',
      points: emptyIds.includes(id)
        ? []
        : Array.from({ length: id === 'short' ? 11 : 101 }, (_, i) => ({
            x: 10 + i / 10,
            y: 100 + i,
            error: 1,
          })),
    },
  })),
})

const modes = ['independent', 'separated', 'compact'] as const

describe('empty windows retain chart frames', () => {
  for (const displayMode of modes) {
    it.each([false, true])(
      `retains axes, viewport and geometry through empty and restored windows (${displayMode}, remote=%s)`,
      async (remote) => {
        const wrapper = await mountSizedChart(data(), {
          displayMode,
          animationEnabled: false,
          interactionMode: 'zoom',
          initialXDomain: [10, 20],
          ...(remote ? { panXDomain: [10, 20] } : {}),
          minVisiblePoints: 2,
          minZoomSpan: 0.01,
          grid: { rowCount: 2, columnCount: 1, fillIncompleteLastRow: true, hideEmptyTracks: true },
        })
        const overlay = wrapper.get('.waveform-chart__overlay')
        const width = Number(overlay.attributes('width'))
        const height = Number(overlay.attributes('height'))
        Object.defineProperty(overlay.element, 'getBoundingClientRect', {
          value: () => ({ left: 0, top: 0, width, height }),
        })
        for (const [type, ratio] of [
          ['pointerdown', 0.02],
          ['pointerup', 0.08],
        ] as const) {
          const event = new MouseEvent(type, {
            button: 0,
            clientX: width * ratio,
            clientY: height / 2,
            bubbles: true,
          })
          Object.defineProperty(event, 'pointerId', { value: 1 })
          overlay.element.dispatchEvent(event)
        }
        await flushPromises()
        const before = wrapper.vm.getControlState().targets.map((target) => target.viewport)
        const frames = () =>
          wrapper.findAll('.waveform-chart__track').map((track) => ({
            id: track.attributes('data-track-id'),
            transform: track.attributes('transform'),
            width: track.attributes('data-track-width'),
            height: track.attributes('data-track-height'),
            axes: track.findAll('.waveform-chart__axis--y').map((axis) => axis.text()),
          }))
        const originalFrames = frames()
        for (const ids of [['short'], ['short', 'long']]) {
          await wrapper.setProps({ data: data(ids) })
          await flushPromises()
          expect(frames()).toEqual(originalFrames)
          expect(wrapper.vm.getControlState().targets.map((target) => target.viewport)).toEqual(
            before,
          )
          for (const id of ids) {
            const track = wrapper.get(`[data-track-id="${id}"]`)
            expect(track.find('.waveform-chart__plot-frame').exists()).toBe(true)
            expect(track.find('.waveform-chart__line').exists()).toBe(false)
            expect(track.find('.waveform-chart__points path').exists()).toBe(false)
            expect(track.find('.waveform-track__error-bar').exists()).toBe(false)
          }
        }
        const wheel = async (deltaY: number) => {
          overlay.element.dispatchEvent(
            new WheelEvent('wheel', {
              deltaY,
              clientX: width / 2,
              clientY: height / 2,
              bubbles: true,
              cancelable: true,
            }),
          )
          flushAnimationFrames()
          await flushPromises()
        }
        const span = () => {
          const domain = wrapper.vm.getControlState().targets[0].viewport.xDomain
          return domain[1] - domain[0]
        }
        const originalSpan = span()
        await wheel(-1000)
        expect(span()).toBeLessThan(originalSpan)
        await wheel(1000)
        expect(span()).toBeCloseTo(originalSpan)
        expect(wrapper.vm.zoomIn().status).toBe('applied')
        await flushPromises()
        expect(wrapper.vm.zoomOut().status).toBe('applied')
        await flushPromises()
        wrapper.vm.resetViewport()
        await flushPromises()
        expect(wrapper.vm.getControlState().targets[0].viewport.xDomain).toEqual([10, 20])
        await wrapper.setProps({ data: data() })
        await flushPromises()
        expect(wrapper.findAll('.waveform-chart__line')).toHaveLength(2)
        expect(frames()).toEqual(originalFrames)
        wrapper.unmount()
      },
    )

    it(`keeps frames during repeated zoom completely outside a channel (${displayMode})`, async () => {
      const wrapper = await mountSizedChart(data(), {
        displayMode,
        initialXDomain: [10, 20],
        animationEnabled: false,
      })
      const overlay = wrapper.get('.waveform-chart__overlay')
      const width = Number(overlay.attributes('width'))
      for (const [type, ratio] of [
        ['pointerdown', 0.7],
        ['pointerup', 0.9],
      ] as const) {
        const event = new MouseEvent(type, {
          button: 0,
          clientX: width * ratio,
          clientY: 50,
          bubbles: true,
        })
        Object.defineProperty(event, 'pointerId', { value: 1 })
        overlay.element.dispatchEvent(event)
      }
      await flushPromises()
      for (let step = 0; step < 40; step++) {
        overlay.element.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY: -1000,
            clientX: width / 2,
            clientY: 50,
            bubbles: true,
            cancelable: true,
          }),
        )
        flushAnimationFrames()
        await flushPromises()
        expect(wrapper.findAll('.waveform-chart__plot-frame')).toHaveLength(2)
      }
      const domain = wrapper.emitted('zoom-change')?.at(-1)?.[0] as [number, number]
      expect(domain[0]).toBeGreaterThan(11)
      expect(wrapper.get('[data-track-id="short"]').find('.waveform-chart__line').exists()).toBe(
        false,
      )
      wrapper.unmount()
    })
  }

  it('retains implicit data domains, grouped axes and frames at a small size', async () => {
    const wrapper = await mountSizedChart(data([], true), {
      animationEnabled: false,
      displayMode: 'independent',
      overlayMode: 'multi-axis',
      minVisiblePoints: 2,
      xDomainStrategy: { type: 'data' },
    })
    resizeObservers.at(-1)?.resize(320, 300)
    await flushPromises()
    const before = wrapper.vm.getControlState()
    await wrapper.setProps({ data: data(['short', 'long'], true) })
    await flushPromises()
    expect(wrapper.vm.getControlState()).toEqual(before)
    expect(wrapper.findAll('.waveform-chart__plot-frame')).toHaveLength(2)
    expect(wrapper.findAll('.waveform-chart__line')).toHaveLength(0)
    wrapper.unmount()
  })

  it('preserves pagination for empty channels but permits explicit removal and clearing', async () => {
    const wrapper = await mountSizedChart(data(), {
      animationEnabled: false,
      grid: { rowCount: 1 },
    })
    const pagination = wrapper.get('.waveform-chart__pagination')
    const before = pagination.text()
    await wrapper.setProps({ data: data(['short', 'long']) })
    await flushPromises()
    expect(pagination.text()).toBe(before)
    expect(wrapper.emitted('page-change')).toBeUndefined()
    const single = data(['short'])
    if (single.kind !== 'series') throw new Error('Expected series')
    await wrapper.setProps({ data: { ...single, series: single.series.slice(0, 1) } })
    await flushPromises()
    expect(wrapper.find('[data-track-id="long"]').exists()).toBe(false)
    await wrapper.setProps({ data: { kind: 'series', series: [] } })
    await flushPromises()
    expect(wrapper.vm.getControlState().targets).toEqual([])
    expect(wrapper.find('.waveform-chart__plot-frame').exists()).toBe(false)
    wrapper.unmount()
  })

  it('clears old geometry immediately even when update animation is enabled', async () => {
    const wrapper = await mountSizedChart(data(), { animation: { enabled: false } })
    await wrapper.setProps({ data: data(['short']) })
    await flushPromises()
    expect(wrapper.get('[data-track-id="short"]').find('.waveform-chart__line').exists()).toBe(
      false,
    )
    expect(wrapper.get('[data-track-id="short"]').find('.waveform-track__error-bar').exists()).toBe(
      false,
    )
    wrapper.unmount()
  })
})
