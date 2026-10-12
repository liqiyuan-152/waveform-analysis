import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mountSizedChart } from '@tests/support/waveformChart'

const data = {
  kind: 'points' as const,
  points: Array.from({ length: 101 }, (_, i) => ({ x: i / 10, y: Math.sin(i) })),
}

describe('toolbar integration with remote and integer viewports', () => {
  it.each(['independent', 'compact'] as const)(
    'zooms outside the loaded interval and resets in %s mode',
    async (displayMode) => {
      const w = await mountSizedChart(data, {
        displayMode,
        toolbar: true,
        initialXDomain: [2, 8],
        panXDomain: [-100, 100],
        xDomainStrategy: { type: 'data' },
      })
      try {
        await flushPromises()
        await w.get('[data-command="zoom-out"]').trigger('click')
        const domain = () => w.vm.getControlState().targets[0]!.viewport.xDomain
        expect(domain()[0]).toBeCloseTo(-1)
        expect(domain()[1]).toBeCloseTo(11)
        expect(w.emitted('zoom-end')?.at(-1)?.[0]).toMatchObject({ source: 'toolbar' })
        expect(w.vm.setViewportDomain([40, 50], {}).status).toBe('applied')
        expect(domain()[0]).toBeCloseTo(40)
        expect(domain()[1]).toBeCloseTo(50)
        w.vm.zoomOut()
        expect(domain()[0]).toBeCloseTo(35)
        expect(domain()[1]).toBeCloseTo(55)
        w.vm.resetViewport({})
        expect(domain()).toEqual([2, 8])
        w.vm.fitToData()
        expect(domain()).toEqual([0, 10])
      } finally {
        w.unmount()
      }
    },
  )

  it('aligns command viewports in display units and reports actual seconds', async () => {
    const w = await mountSizedChart(data, {
      toolbar: true,
      integerZoom: true,
      timeUnit: 's',
      xDomainStrategy: { type: 'data' },
    })
    try {
      const result = w.vm.setViewportDomain([2.2, 4.1], {})
      expect(result.targets[0]?.after?.xDomain).toEqual([2, 5])
      expect(w.emitted('zoom-end')?.at(-1)?.[0]).toMatchObject({ start: 2, end: 5 })
      await flushPromises()
      await w.get('[data-command="zoom-out"]').trigger('click')
      expect(w.vm.getControlState().targets[0]?.viewport.xDomain).toEqual([0, 7])
    } finally {
      w.unmount()
    }
  })
})
