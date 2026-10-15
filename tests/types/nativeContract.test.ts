import { describe, expect, expectTypeOf, it } from 'vitest'
import type {
  WaveformChartAction,
  WaveformChartEvents,
  WaveformChartInitOptions,
  WaveformChartInstance,
  WaveformChartOptions,
  WaveformControlResult,
  WaveformAnnotation,
  WaveformChartErrorCode,
} from '@/index'
import { init } from '@/native'

/** Checked by vue-tsc; never called, so no fake runtime instance is required. */
function checkInstance(chart: WaveformChartInstance) {
  chart.on('annotation-update', (annotation, previous) => {
    expectTypeOf(annotation).toEqualTypeOf<WaveformAnnotation>()
    expectTypeOf(previous).toEqualTypeOf<WaveformAnnotation>()
  })
  chart.on('page-change', (page, pageCount) => {
    expectTypeOf(page).toEqualTypeOf<number>()
    expectTypeOf(pageCount).toEqualTypeOf<number>()
  })
  chart.off('page-change')
  chart.off('page-change', (page, pageCount) => void [page, pageCount])
  const code: WaveformChartErrorCode = 'invalid-option'
  // @ts-expect-error Configuration errors have a closed set of stable codes.
  const invalidCode: WaveformChartErrorCode = 'unknown-error'
  // @ts-expect-error DOM factories accept an HTMLElement, not a framework ref object.
  init({ current: document.createElement('div') })
  // @ts-expect-error Selectors are not accepted by the DOM factory.
  init('#chart')
  // @ts-expect-error off handlers obey the same event tuple contract as on.
  chart.off('page-change', (page: string) => void page)
  const legacyReset: void = chart.resetViewport(0)
  const legacyDomain: void = chart.setViewportDomain([0, 1], 0)
  const result: WaveformControlResult = chart.resetViewport({ trackId: 'track' })
  const image: Promise<Blob> = chart.exportImage({ format: 'svg' })
  chart.dispatchAction({ type: 'set-domain', domain: [0, 1], target: { trackId: 'track' } })
  chart.dispatchAction({ type: 'set-mode', mode: 'pan' })
  // @ts-expect-error Unknown events cannot silently accept an untyped callback.
  chart.on('unknown', () => undefined)
  // @ts-expect-error Domain is required for a set-domain action.
  chart.dispatchAction({ type: 'set-domain' })
  // @ts-expect-error Export has its own asynchronous method.
  chart.dispatchAction({ type: 'export' })
  // @ts-expect-error A mode action cannot carry a viewport domain.
  chart.dispatchAction({ type: 'set-mode', domain: [0, 1] })
  // @ts-expect-error The page-change callback takes numbers.
  chart.on('page-change', (page: string) => void page)
  return { legacyReset, legacyDomain, result, image, code, invalidCode }
}
void checkInstance

describe('native public contract', () => {
  it('allows empty creation and separates environment configuration', () => {
    const options: WaveformChartOptions = { annotations: [] }
    const initOptions: WaveformChartInitOptions = { autoResize: false }
    const action: WaveformChartAction = { type: 'fit', target: { trackId: 'a' } }
    expect(options.annotations).toEqual([])
    expect(initOptions.autoResize).toBe(false)
    expect(action.type).toBe('fit')
    expectTypeOf<WaveformChartEvents['page-change']>().toEqualTypeOf<
      [page: number, pageCount: number]
    >()
  })
})
